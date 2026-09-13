import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/* RATNAKARA CURRENT FLOW — REAL DATA VERSION
   Uses actual U/V current vectors from the NetCDF model dataset
   to generate flow paths. It renders nothing when data is unavailable. */

const CURRENT_RADIUS = 2.044;
const PARTICLES_PER_CURRENT = 6;
const CURVE_SEGMENTS = 32;

function latLonToVector(lat, lon, radius = CURRENT_RADIUS) {
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lon + 70);
  return new THREE.Vector3(
    radius * Math.sin(phi) * Math.sin(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.cos(theta)
  );
}

function isLand(lat, lon) {
  if (lat >= 6 && lat <= 35 && lon >= 68 && lon <= 90) return true;
  if (lat >= 5.5 && lat <= 10.5 && lon >= 79 && lon <= 82.5) return true;
  if (lat >= 12 && lat <= 30 && lon >= 35 && lon <= 60) return true;
  if (lat >= -35 && lat <= 12 && lon >= 30 && lon <= 52) return true;
  if (lat >= -8 && lat <= 20 && lon >= 95 && lon <= 120) return true;
  if (lat >= -26 && lat <= -12 && lon >= 43 && lon <= 50) return true;
  return false;
}


/**
 * Build a spatial lookup from real U/V vectors for nearest-neighbour queries.
 */
function buildCurrentLookup(vectors) {
  if (!vectors || vectors.length === 0) return null;

  const map = new Map();
  for (const v of vectors) {
    const key = `${v.latitude.toFixed(1)},${v.longitude.toFixed(1)}`;
    if (!map.has(key)) {
      map.set(key, v);
    }
  }

  return function getVector(lat, lon) {
    const key = `${lat.toFixed(1)},${lon.toFixed(1)}`;
    if (map.has(key)) return map.get(key);

    let best = null;
    let bestDist = Infinity;
    for (const v of vectors) {
      const d = (v.latitude - lat) ** 2 + (v.longitude - lon) ** 2;
      if (d < bestDist) { bestDist = d; best = v; }
    }
    return bestDist < 25 ? best : null;
  };
}

/**
 * Trace flow paths through the real U/V current field.
 * Starting from seed points, follow the current direction to create
 * smooth flow lines that represent actual ocean circulation.
 */
function traceFlowPaths(vectors, stepDeg = 4.0, pathLength = 8, numSeeds = 20) {
  const lookup = buildCurrentLookup(vectors);
  if (!lookup) return [];

  /* Select seed points: ocean locations with significant current speed */
  const seeds = [];
  const latRange = { min: -30, max: 25 };
  const lonRange = { min: 50, max: 95 };

  for (let lat = latRange.min; lat <= latRange.max; lat += stepDeg * 2) {
    for (let lon = lonRange.min; lon <= lonRange.max; lon += stepDeg * 2) {
      const v = lookup(lat, lon);
      if (!v || isLand(lat, lon)) continue;
      const speed = Math.sqrt(v.u * v.u + v.v * v.v);
      if (speed > 0.05) {
        seeds.push({ lat, lon, speed });
      }
    }
  }

  /* Sort by speed descending, take top seeds */
  seeds.sort((a, b) => b.speed - a.speed);
  const selected = seeds.slice(0, numSeeds);

  /* Trace paths from each seed */
  const paths = [];
  for (const seed of selected) {
    const path = [];
    let lat = seed.lat;
    let lon = seed.lon;

    for (let step = 0; step < pathLength; step++) {
      if (isLand(lat, lon)) break;
      const v = lookup(lat, lon);
      if (!v) break;

      const speed = Math.sqrt(v.u * v.u + v.v * v.v);
      if (speed < 0.01) break;

      path.push({ latitude: lat, longitude: lon, u: v.u, v: v.v, speed });

      /* Move in the direction of the current */
      /* u = east-west (positive = east), v = north-south (positive = north) */
      lat += v.v * stepDeg * 0.5;
      lon += v.u * stepDeg * 0.5;
    }

    if (path.length >= 2) {
      paths.push(path);
    }
  }

  return paths;
}

/**
 * Create a curve from a traced flow path.
 */
function createDataDrivenCurve(path) {
  if (!path || path.length < 2) return null;
  const vectors = path
    .filter((p) => !isLand(p.latitude, p.longitude))
    .map((p) => latLonToVector(p.latitude, p.longitude));
  if (vectors.length < 2) return null;
  return new THREE.CatmullRomCurve3(vectors, false, "catmullrom", 0.5);
}

function CurrentLine({ curve, speed, phase }) {
  const lineRef = useRef(null);

  const geometry = useMemo(() => {
    if (!curve) return null;
    const pts = curve.getPoints(CURVE_SEGMENTS);
    const positions = [];
    for (const p of pts) positions.push(p.x, p.y, p.z);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    return geo;
  }, [curve]);

  const particleGeometry = useMemo(() => {
    if (!curve) return null;
    const positions = [];
    for (let i = 0; i < PARTICLES_PER_CURRENT; i++) {
      const t = (i / PARTICLES_PER_CURRENT + phase) % 1;
      const point = curve.getPoint(t);
      positions.push(point.x, point.y, point.z);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    return geo;
  }, [curve, phase]);

  useFrame((state) => {
    if (!lineRef.current || !curve || !particleGeometry) return;
    const time = state.clock.elapsedTime;
    const posAttr = particleGeometry.getAttribute("position");
    const progress = (time * speed + phase) % 1;
    for (let i = 0; i < PARTICLES_PER_CURRENT; i++) {
      const t = (progress + i / PARTICLES_PER_CURRENT) % 1;
      const point = curve.getPoint(t);
      posAttr.setXYZ(i, point.x, point.y, point.z);
    }
    posAttr.needsUpdate = true;
    lineRef.current.material.opacity = 0.18 + (Math.sin(time * 1.2 + phase) + 1) * 0.03;
  });

  if (!geometry || !particleGeometry) return null;

  return (
    <group>
      <line ref={lineRef} geometry={geometry}>
        <lineBasicMaterial color="#bdefff" transparent opacity={0.2} depthWrite={false} depthTest={true} toneMapped={false} />
      </line>
      <points geometry={particleGeometry}>
        <pointsMaterial color="#e6fbff" size={0.01} sizeAttenuation transparent opacity={0.7} depthWrite={false} depthTest={true} toneMapped={false} />
      </points>
    </group>
  );
}

export default function RatnakaraCurrents({ depth = 0, currentVectors = null }) {
  const currents = useMemo(() => {
    /* If real U/V vectors are available, trace flow paths from them */
    if (currentVectors && currentVectors.length > 0) {
      const paths = traceFlowPaths(currentVectors);
      if (paths.length > 0) {
        return paths.map((path, index) => {
          const avgSpeed = path.reduce((s, p) => s + p.speed, 0) / path.length;
          const curve = createDataDrivenCurve(path);
          if (!curve) return null;
          /* Scale speed for animation: real speeds are ~0.05-2.0 m/s,
             map to animation speed range 0.02-0.08 */
          const animSpeed = 0.02 + Math.min(avgSpeed, 2.0) * 0.03;
          return { id: index, curve, speed: animSpeed, phase: (index * 0.137) % 1 };
        }).filter(Boolean);
      }
    }

    return [];
  }, [currentVectors]);

  return (
    <group>
      {currents.map((current) => (
        <CurrentLine key={current.id} curve={current.curve} speed={current.speed} phase={current.phase} />
      ))}
    </group>
  );
}
