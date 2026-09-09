import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/* RATNAKARA CURRENT FLOW — IMPROVED
   CatmullRomCurve3, ocean-only paths, data-driven direction */

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

const FLOW_FAMILIES = [
  { name: "arabian_sea_east", points: [{ lat: 10, lon: 52 }, { lat: 12, lon: 58 }, { lat: 14, lon: 64 }, { lat: 15, lon: 68 }, { lat: 13, lon: 72 }], speed: 0.04 },
  { name: "arabian_sea_north", points: [{ lat: 5, lon: 55 }, { lat: 8, lon: 60 }, { lat: 12, lon: 65 }, { lat: 16, lon: 68 }], speed: 0.035 },
  { name: "arabian_sea_south", points: [{ lat: 2, lon: 56 }, { lat: 4, lon: 62 }, { lat: 6, lon: 67 }, { lat: 8, lon: 72 }], speed: 0.038 },
  { name: "bengal_north", points: [{ lat: 5, lon: 85 }, { lat: 8, lon: 87 }, { lat: 12, lon: 88 }, { lat: 16, lon: 87 }, { lat: 18, lon: 86 }], speed: 0.032 },
  { name: "bengal_east", points: [{ lat: 3, lon: 88 }, { lat: 7, lon: 90 }, { lat: 12, lon: 92 }, { lat: 16, lon: 93 }], speed: 0.036 },
  { name: "bengal_west", points: [{ lat: 6, lon: 82 }, { lat: 10, lon: 83 }, { lat: 14, lon: 84 }, { lat: 17, lon: 83 }], speed: 0.03 },
  { name: "equatorial_east", points: [{ lat: -2, lon: 50 }, { lat: -1, lon: 58 }, { lat: 0, lon: 66 }, { lat: 1, lon: 74 }, { lat: 0, lon: 82 }, { lat: -1, lon: 90 }], speed: 0.045 },
  { name: "equatorial_south", points: [{ lat: -5, lon: 52 }, { lat: -4, lon: 60 }, { lat: -3, lon: 68 }, { lat: -4, lon: 76 }, { lat: -5, lon: 84 }], speed: 0.04 },
  { name: "south_east", points: [{ lat: -20, lon: 55 }, { lat: -18, lon: 62 }, { lat: -16, lon: 70 }, { lat: -15, lon: 78 }, { lat: -14, lon: 86 }], speed: 0.05 },
  { name: "south_mid", points: [{ lat: -25, lon: 58 }, { lat: -23, lon: 65 }, { lat: -21, lon: 72 }, { lat: -20, lon: 80 }, { lat: -19, lon: 88 }], speed: 0.048 },
  { name: "south_deep", points: [{ lat: -30, lon: 55 }, { lat: -28, lon: 63 }, { lat: -26, lon: 71 }, { lat: -25, lon: 79 }, { lat: -24, lon: 87 }], speed: 0.052 },
  { name: "cross_basin_1", points: [{ lat: 3, lon: 55 }, { lat: 5, lon: 65 }, { lat: 6, lon: 72 }, { lat: 4, lon: 80 }, { lat: 2, lon: 88 }], speed: 0.042 },
  { name: "cross_basin_2", points: [{ lat: -8, lon: 55 }, { lat: -6, lon: 63 }, { lat: -5, lon: 72 }, { lat: -6, lon: 80 }, { lat: -7, lon: 88 }], speed: 0.038 },
];

function createFlowCurve(family) {
  const oceanPoints = family.points.filter((p) => !isLand(p.lat, p.lon));
  if (oceanPoints.length < 2) return null;
  const vectors = oceanPoints.map((p) => latLonToVector(p.lat, p.lon));
  return new THREE.CatmullRomCurve3(vectors, false, "catmullrom", 0.5);
}

function createDataDrivenCurve(dataPoints) {
  if (!dataPoints || dataPoints.length < 2) return null;
  const vectors = dataPoints
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

export default function RatnakaraCurrents({ depth = 0, dataPoints = null }) {
  const currents = useMemo(() => {
    return FLOW_FAMILIES.map((family, index) => {
      const curve = dataPoints ? createDataDrivenCurve(dataPoints) : createFlowCurve(family);
      if (!curve) return null;
      return { id: index, curve, speed: family.speed, phase: (index * 0.137) % 1 };
    }).filter(Boolean);
  }, [dataPoints]);

  return (
    <group>
      {currents.map((current) => (
        <CurrentLine key={current.id} curve={current.curve} speed={current.speed} phase={current.phase} />
      ))}
    </group>
  );
}
