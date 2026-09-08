// SAGARA — Smart 3D Ocean Analytics & Reality Assessment
// Main application entry point

import { useEffect } from 'react'
import OceanVisualization from './components/visualization/OceanVisualization'
import ControlPanel from './components/controls/ControlPanel'
import ActionButtons from './components/controls/ActionButtons'
import RightPanel from './components/panels/RightPanel'
import { useStore } from './store'
import { fetchMetadata } from './services/api'

export default function App() {
  const { setMetadata, setVariable, setDepth, setTime, setLatitude, setLongitude } = useStore()

  // Load metadata on startup
  useEffect(() => {
    fetchMetadata().then(setMetadata).catch(console.error)
  }, [setMetadata])

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>
      {/* 3D Globe */}
      <OceanVisualization />

      {/* Left panel — controls */}
      <ControlPanel />

      {/* Bottom left — action buttons */}
      <ActionButtons />

      {/* Right panel — data panels */}
      <RightPanel />

      {/* Bottom center — brand watermark */}
      <div style={{
        position: 'absolute',
        bottom: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        fontSize: 11,
        color: '#2a4060',
        letterSpacing: '0.1em',
        pointerEvents: 'none',
      }}>
        SAGARA — SIH 2026 · PS 26067 · MoES / INCOIS
      </div>
    </div>
  )
}
