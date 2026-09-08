// Control panel — variable, depth, time, location selectors

import { useStore } from '../../store'

const VARIABLES = [
  { value: 'temperature', label: 'Temperature', unit: '°C' },
  { value: 'salinity', label: 'Salinity', unit: 'PSU' },
  { value: 'u_current', label: 'U Current', unit: 'm/s' },
  { value: 'v_current', label: 'V Current', unit: 'm/s' },
]

const DEPTHS = [0, 5, 10, 25, 50, 100, 200, 300, 500]

const panelStyle: React.CSSProperties = {
  position: 'absolute',
  top: 16,
  left: 16,
  background: 'rgba(10, 14, 23, 0.92)',
  border: '1px solid #1a3050',
  borderRadius: 10,
  padding: '16px 20px',
  zIndex: 10,
  minWidth: 260,
  backdropFilter: 'blur(8px)',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 600,
  color: '#5a8ab5',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: 4,
}

const selectStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 10px',
  borderRadius: 6,
  border: '1px solid #1a3050',
  background: '#0d1520',
  color: '#e0e6ed',
  fontSize: 13,
  outline: 'none',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 10px',
  borderRadius: 6,
  border: '1px solid #1a3050',
  background: '#0d1520',
  color: '#e0e6ed',
  fontSize: 13,
  outline: 'none',
}

const btnStyle = (active: boolean): React.CSSProperties => ({
  padding: '4px 10px',
  borderRadius: 6,
  border: `1px solid ${active ? '#00ccff' : '#1a3050'}`,
  background: active ? '#0a2a3a' : 'transparent',
  color: active ? '#00ccff' : '#5a7a95',
  fontSize: 12,
  cursor: 'pointer',
  fontWeight: active ? 700 : 400,
})

export default function ControlPanel() {
  const {
    variable, setVariable,
    depth, setDepth,
    time, setTime,
    latitude, setLatitude,
    longitude, setLongitude,
    loading,
    errors,
    modelField,
  } = useStore()

  return (
    <div style={panelStyle}>
      {/* Title */}
      <div style={{ marginBottom: 14, borderBottom: '1px solid #1a3050', paddingBottom: 10 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#00ccff', letterSpacing: '0.02em' }}>
          🌊 SAGARA
        </div>
        <div style={{ fontSize: 11, color: '#5a7a95', marginTop: 2 }}>
          Smart 3D Ocean Analytics
        </div>
      </div>

      {/* Variable */}
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Variable</label>
        <select
          style={selectStyle}
          value={variable}
          onChange={(e) => setVariable(e.target.value)}
        >
          {VARIABLES.map((v) => (
            <option key={v.value} value={v.value}>
              {v.label} ({v.unit})
            </option>
          ))}
        </select>
      </div>

      {/* Depth */}
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Depth: {depth} m</label>
        <input
          type="range"
          min={0}
          max={500}
          step={5}
          value={depth}
          onChange={(e) => setDepth(Number(e.target.value))}
          style={{ width: '100%', accentColor: '#00ccff' }}
        />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
          {DEPTHS.map((d) => (
            <button
              key={d}
              style={btnStyle(d === depth)}
              onClick={() => setDepth(d)}
            >
              {d}m
            </button>
          ))}
        </div>
      </div>

      {/* Time */}
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Time</label>
        <input
          type="datetime-local"
          style={inputStyle}
          value={time.slice(0, 16)}
          onChange={(e) => setTime(e.target.value ? e.target.value + ':00' : time)}
        />
      </div>

      {/* Location */}
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Location</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="number"
            step={0.1}
            style={{ ...inputStyle, width: '50%' }}
            value={latitude}
            onChange={(e) => setLatitude(Number(e.target.value))}
            placeholder="Lat"
          />
          <input
            type="number"
            step={0.1}
            style={{ ...inputStyle, width: '50%' }}
            value={longitude}
            onChange={(e) => setLongitude(Number(e.target.value))}
            placeholder="Lon"
          />
        </div>
      </div>

      {/* Status */}
      <div style={{ borderTop: '1px solid #1a3050', paddingTop: 10, marginTop: 4 }}>
        {loading.modelField && <StatusDot color="#ffaa00" text="Loading model..." />}
        {loading.observations && <StatusDot color="#ffaa00" text="Loading observations..." />}
        {loading.comparison && <StatusDot color="#ffaa00" text="Running comparison..." />}
        {loading.anomalies && <StatusDot color="#ffaa00" text="Scanning anomalies..." />}
        {errors.modelField && <StatusDot color="#ff3366" text={errors.modelField} />}
        {errors.observations && <StatusDot color="#ff3366" text={errors.observations} />}
        {errors.comparison && <StatusDot color="#ff3366" text={errors.comparison} />}
        {errors.anomalies && <StatusDot color="#ff3366" text={errors.anomalies} />}
        {modelField && (
          <StatusDot color="#00ff88" text={`${modelField.points.length} model points · ${modelField.unit}`} />
        )}
      </div>
    </div>
  )
}

function StatusDot({ color, text }: { color: string; text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
      <span style={{
        display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
        background: color, flexShrink: 0,
      }} />
      <span style={{ fontSize: 11, color: '#8aa0b8' }}>{text}</span>
    </div>
  )
}
