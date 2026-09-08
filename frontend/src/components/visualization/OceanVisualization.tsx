// 3D Ocean Visualization — renders model field grid + Argo observations + anomalies

import { useMemo, useRef, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Html, Line, Text } from '@react-three/drei'
import * as THREE from 'three'
import { useStore } from '../../store'
import type { ModelFieldPoint, Observation, Anomaly } from '../../types/api'

// --- Color mapping for ocean variables ---
function valueToColor(value: number, variable: string): THREE.Color {
  if (variable === 'temperature') {
    // Cold (blue) → Warm (red)
    const t = Math.max(0, Math.min(1, (value + 2) / 36)) // -2..34 °C mapped to 0..1
    return new THREE.Color().setHSL(0.66 - t * 0.66, 0.85, 0.45 + t * 0.15)
  }
  if (variable === 'salinity') {
    // Low salinity (purple) → High (orange)
    const t = Math.max(0, Math.min(1, (value - 33) / 5)) // 33..38 PSU mapped to 0..1
    return new THREE.Color().setHSL(0.75 - t * 0.7, 0.8, 0.5)
  }
  // Currents
  const t = Math.abs(value) * 50
  return new THREE.Color().setHSL(0.55, 0.9, Math.min(0.7, 0.3 + t))
}

// Convert lat/lon to 3D position on a sphere
function latLonToXYZ(lat: number, lon: number, radius: number): [number, number, number] {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lon + 180) * (Math.PI / 180)
  const x = -(radius * Math.sin(phi) * Math.cos(theta))
  const z = radius * Math.sin(phi) * Math.sin(theta)
  const y = radius * Math.cos(phi)
  return [x, y, z]
}

// --- Model field points as instanced mesh ---
function ModelFieldLayer() {
  const modelField = useStore((s) => s.modelField)
  const variable = useStore((s) => s.variable)
  const meshRef = useRef<THREE.InstancedMesh>(null)

  const { points, colors } = useMemo(() => {
    if (!modelField) return { points: [], colors: [] }
    const pts: THREE.Vector3[] = []
    const cls: THREE.Color[] = []
    for (const p of modelField.points) {
      const [x, y, z] = latLonToXYZ(p.latitude, p.longitude, 2.0)
      pts.push(new THREE.Vector3(x, y, z))
      cls.push(valueToColor(p.value, variable))
    }
    return { points: pts, colors: cls }
  }, [modelField, variable])

  useEffect(() => {
    if (!meshRef.current || points.length === 0) return
    const mesh = meshRef.current
    const dummy = new THREE.Object3D()
    const color = new THREE.Color()
    for (let i = 0; i < points.length; i++) {
      dummy.position.copy(points[i])
      dummy.scale.setScalar(0.008)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      color.copy(colors[i])
      mesh.setColorAt(i, color)
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [points, colors])

  if (points.length === 0) return null

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, points.length]}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial vertexColors toneMapped={false} />
    </instancedMesh>
  )
}

// --- Argo observation markers ---
function ArgoMarkers() {
  const observations = useStore((s) => s.observations)
  const selectedId = useStore((s) => s.selectedObservationId)
  const setSelected = useStore((s) => s.setSelectedObservation)

  const markers = useMemo(() => {
    if (!observations) return []
    return observations.observations
  }, [observations])

  if (markers.length === 0) return null

  return (
    <group>
      {markers.map((obs) => {
        const [x, y, z] = latLonToXYZ(obs.latitude, obs.longitude, 2.02)
        const isSelected = obs.id === selectedId
        return (
          <group key={obs.id} position={[x, y, z]}>
            <mesh
              onClick={(e) => {
                e.stopPropagation()
                setSelected(isSelected ? null : obs.id)
              }}
            >
              <sphereGeometry args={[isSelected ? 0.025 : 0.018, 8, 8]} />
              <meshBasicMaterial
                color={isSelected ? '#00ff88' : '#00ccff'}
                toneMapped={false}
              />
            </mesh>
            {isSelected && (
              <Html distanceFactor={5}>
                <div style={{
                  background: 'rgba(10,14,23,0.92)',
                  border: '1px solid #00ccff',
                  borderRadius: 6,
                  padding: '8px 12px',
                  color: '#e0e6ed',
                  fontSize: 12,
                  whiteSpace: 'nowrap',
                  transform: 'translateY(-40px)',
                  pointerEvents: 'none',
                }}>
                  <div style={{ fontWeight: 600, color: '#00ccff' }}>{obs.id}</div>
                  <div>Lat: {obs.latitude.toFixed(3)}° Lon: {obs.longitude.toFixed(3)}°</div>
                  <div>Depth: {obs.depth.toFixed(1)} dbar</div>
                  <div>Time: {obs.time}</div>
                  {obs.temperature !== null && <div>Temp: {obs.temperature.toFixed(2)} °C</div>}
                  {obs.salinity !== null && <div>Sal: {obs.salinity.toFixed(2)} PSU</div>}
                </div>
              </Html>
            )}
          </group>
        )
      })}
    </group>
  )
}

// --- Anomaly markers (WARNING = red pulsing) ---
function AnomalyMarkers() {
  const anomalies = useStore((s) => s.anomalies)
  const meshRef = useRef<THREE.Group>(null)

  useFrame(({ clock }) => {
    if (!meshRef.current) return
    const t = clock.getElapsedTime()
    const scale = 1 + 0.3 * Math.sin(t * 3)
    meshRef.current.children.forEach((child) => {
      child.scale.setScalar(scale)
    })
  })

  const markers = useMemo(() => {
    if (!anomalies) return []
    return anomalies.anomalies.filter((a) => a.status === 'WARNING')
  }, [anomalies])

  if (markers.length === 0) return null

  return (
    <group ref={meshRef}>
      {markers.map((anomaly, i) => {
        const [x, y, z] = latLonToXYZ(anomaly.location.latitude, anomaly.location.longitude, 2.05)
        return (
          <group key={i} position={[x, y, z]}>
            <mesh>
              <octahedronGeometry args={[0.03, 0]} />
              <meshBasicMaterial color="#ff3366" wireframe toneMapped={false} />
            </mesh>
            <Html distanceFactor={5}>
              <div style={{
                background: 'rgba(10,14,23,0.92)',
                border: '1px solid #ff3366',
                borderRadius: 6,
                padding: '6px 10px',
                color: '#ff3366',
                fontSize: 11,
                whiteSpace: 'nowrap',
                transform: 'translateY(-30px)',
                pointerEvents: 'none',
              }}>
                <div style={{ fontWeight: 700 }}>⚠ WARNING</div>
                <div>{anomaly.variable}: Δ {anomaly.absolute_difference.toFixed(2)} {anomaly.unit}</div>
                <div>Obs: {anomaly.observed_value.toFixed(2)} vs Model: {anomaly.expected_value.toFixed(2)}</div>
              </div>
            </Html>
          </group>
        )
      })}
    </group>
  )
}

// --- Ocean sphere background ---
function OceanSphere() {
  return (
    <mesh>
      <sphereGeometry args={[1.98, 64, 64]} />
      <meshBasicMaterial color="#0a1628" transparent opacity={0.85} />
    </mesh>
  )
}

// --- Globe grid lines (lat/lon) ---
function GlobeGrid() {
  const lines = useMemo(() => {
    const result: { points: [number, number, number][]; key: string }[] = []
    const r = 1.99

    // Latitude lines every 10°
    for (let lat = -80; lat <= 80; lat += 10) {
      const pts: [number, number, number][] = []
      for (let lon = -180; lon <= 180; lon += 5) {
        pts.push(latLonToXYZ(lat, lon, r))
      }
      result.push({ points: pts, key: `lat-${lat}` })
    }
    // Longitude lines every 10°
    for (let lon = -180; lon < 180; lon += 10) {
      const pts: [number, number, number][] = []
      for (let lat = -80; lat <= 80; lat += 5) {
        pts.push(latLonToXYZ(lat, lon, r))
      }
      result.push({ points: pts, key: `lon-${lon}` })
    }
    return result
  }, [])

  return (
    <group>
      {lines.map((line) => (
        <Line
          key={line.key}
          points={line.points}
          color="#1a3050"
          lineWidth={0.5}
          transparent
          opacity={0.4}
        />
      ))}
    </group>
  )
}

// --- Camera controller ---
function CameraSetup() {
  const { camera } = useThree()
  useEffect(() => {
    // Position camera looking at the Arabian Sea
    const [x, y, z] = latLonToXYZ(15, 65, 6)
    camera.position.set(x, y, z)
    camera.lookAt(0, 0, 0)
  }, [camera])
  return null
}

// --- Main exported component ---
export default function OceanVisualization() {
  return (
    <Canvas
      style={{ width: '100%', height: '100%' }}
      gl={{ antialias: true, alpha: false }}
    >
      <CameraSetup />
      <OrbitControls
        enablePan={false}
        minDistance={3}
        maxDistance={15}
        enableDamping
        dampingFactor={0.05}
      />
      <OceanSphere />
      <GlobeGrid />
      <ModelFieldLayer />
      <ArgoMarkers />
      <AnomalyMarkers />
    </Canvas>
  )
}
