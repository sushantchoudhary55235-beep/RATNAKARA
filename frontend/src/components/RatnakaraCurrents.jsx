import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { isLandPoint } from "../data/landMask";

/* RATNAKARA CURRENT FLOW — REAL DATA VERSION
   Uses actual U/V current vectors from the NetCDF model dataset
   to generate flow paths. Falls back to synthetic paths when
   real data is not available. */

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

/*
  Shared coastline mask (src/data/landMask.js).
  The previous rectangle test treated the whole
  lat 6-35 / lon 68-90 box as land, which deleted every
  real-data flow path in the Arabian Sea and Bay of Bengal
  and left only the synthetic fallbacks visible.
*/
function isLand(lat, lon) {
  return isLandPoint(lat, lon);
}

/*
  Synthetic fallback currents were REMOVED: the currents layer
  now visualizes only real U/V model data. When no vectors are
  available (loading, API error, or empty response) the layer
  renders nothing instead of fabricated flow paths.
*/

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

      /*
        Follow the vector DIRECTION (u = east, v = north) with a
        fixed geographic step. Raw m/s values scaled by degrees
        made strong currents jump multiple degrees per step while
        weak currents barely moved; speed now only shortens the
        path so flow length still reflects magnitude.
      */
      const stepScale =
        stepDeg * Math.min(1, speed / 0.5);

      lat += (v.v / speed) * stepScale;
      lon += (v.u / speed) * stepScale;

      /* Keep the trace inside the dataset window. */
      if (lat < -40 || lat > 30 || lon < 30 || lon > 100) break;
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

  /* Dispose WebGL buffers when the layer unmounts
     so repeated toggling never leaks GPU memory. */
  useEffect(() => {
    return () => {
      if (geometry) geometry.dispose();
      if (particleGeometry) particleGeometry.dispose();
    };
  }, [geometry, particleGeometry]);

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

export default function RatnakaraCurrents({ currentVectors = null }) {
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

    /*
      No real vectors (loading, API error, or empty response):
      render nothing. The layer only ever shows real U/V data.
    */
    return [];

    /*
      currentVectors is refetched per depth by App.jsx, so a
      depth change always produces a new array identity and
      rebuilds the paths — no depth dep needed here.
    */
  }, [currentVectors]);

  return (
    <group>
      {currents.map((current) => (
        <CurrentLine key={current.id} curve={current.curve} speed={current.speed} phase={current.phase} />
      ))}
    </group>
  );
}
