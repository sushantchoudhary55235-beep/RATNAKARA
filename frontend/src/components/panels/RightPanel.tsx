// Right panel — tabs for Observations, Comparison, Anomalies

import { useStore } from '../../store'
import type { ObservationResponse, ComparisonResponse, AnomalyResponse } from '../../types/api'

const panelStyle: React.CSSProperties = {
  position: 'absolute',
  top: 16,
  right: 16,
  bottom: 16,
  width: 380,
  background: 'rgba(10, 14, 23, 0.92)',
  border: '1px solid #1a3050',
  borderRadius: 10,
  display: 'flex',
  flexDirection: 'column',
  zIndex: 10,
  backdropFilter: 'blur(8px)',
  overflow: 'hidden',
}

const tabBtn = (active: boolean): React.CSSProperties => ({
  flex: 1,
  padding: '10px 8px',
  border: 'none',
  borderBottom: active ? '2px solid #00ccff' : '2px solid transparent',
  background: active ? 'rgba(0,204,255,0.08)' : 'transparent',
  color: active ? '#00ccff' : '#5a7a95',
  fontSize: 12,
  fontWeight: active ? 700 : 500,
  cursor: 'pointer',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
})

const sectionStyle: React.CSSProperties = {
  padding: '12px 16px',
  borderBottom: '1px solid #141e2e',
}

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  color: '#5a8ab5',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  marginBottom: 4,
}

const valueStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: '#e0e6ed',
}

type Tab = 'observations' | 'comparison' | 'anomalies'

export default function RightPanel() {
  const {
    panelTab, setPanelTab, showPanel, togglePanel,
    observations, comparison, anomalies,
    selectedObservationId,
    variable, latitude, longitude, depth, time,
    loading, errors,
  } = useStore()

  if (!showPanel) {
    return (
      <button
        onClick={togglePanel}
        style={{
          position: 'absolute', top: 16, right: 16, zIndex: 10,
          background: 'rgba(10,14,23,0.92)', border: '1px solid #1a3050',
          borderRadius: 8, padding: '8px 14px', color: '#00ccff',
          cursor: 'pointer', fontSize: 13, fontWeight: 600,
        }}
      >
        ☰ Panels
      </button>
    )
  }

  return (
    <div style={panelStyle}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #1a3050' }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#e0e6ed' }}>Data Panels</span>
        <button onClick={togglePanel} style={{ background: 'none', border: 'none', color: '#5a7a95', cursor: 'pointer', fontSize: 16 }}>✕</button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #1a3050' }}>
        <button style={tabBtn(panelTab === 'observations')} onClick={() => setPanelTab('observations')}>
          Observations {observations ? `(${observations.count})` : ''}
        </button>
        <button style={tabBtn(panelTab === 'comparison')} onClick={() => setPanelTab('comparison')}>
          Compare
        </button>
        <button style={tabBtn(panelTab === 'anomalies')} onClick={() => setPanelTab('anomalies')}>
          Anomaly {anomalies ? `(${anomalies.count})` : ''}
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'thin' }}>
        {panelTab === 'observations' && (
          <ObservationsTab
            observations={observations}
            selectedId={selectedObservationId}
            loading={loading.observations}
            error={errors.observations}
          />
        )}
        {panelTab === 'comparison' && (
          <ComparisonTab
            comparison={comparison}
            loading={loading.comparison}
            error={errors.comparison}
            variable={variable}
            latitude={latitude}
            longitude={longitude}
            depth={depth}
            time={time}
          />
        )}
        {panelTab === 'anomalies' && (
          <AnomaliesTab
            anomalies={anomalies}
            loading={loading.anomalies}
            error={errors.anomalies}
            variable={variable}
          />
        )}
      </div>
    </div>
  )
}

// --- Observations Tab ---
function ObservationsTab({
  observations, selectedId, loading, error,
}: {
  observations: ObservationResponse | null
  selectedId: string | null
  loading: boolean
  error: string | null
}) {
  if (loading) return <EmptyState text="Loading observations..." />
  if (error) return <EmptyState text={`Error: ${error}`} color="#ff3366" />
  if (!observations) return <EmptyState text="Fetch observations to see data" />

  return (
    <div>
      <div style={sectionStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div>
            <div style={labelStyle}>Source</div>
            <div style={valueStyle}>{observations.source}</div>
          </div>
          <div>
            <div style={labelStyle}>Mode</div>
            <div style={{ ...valueStyle, color: observations.mode === 'real' ? '#00ff88' : '#ffaa00' }}>
              {observations.mode}
            </div>
          </div>
          <div>
            <div style={labelStyle}>Count</div>
            <div style={valueStyle}>{observations.count}</div>
          </div>
        </div>
      </div>
      {observations.observations.map((obs) => (
        <div
          key={obs.id}
          style={{
            ...sectionStyle,
            borderLeft: obs.id === selectedId ? '3px solid #00ccff' : '3px solid transparent',
            background: obs.id === selectedId ? 'rgba(0,204,255,0.05)' : 'transparent',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, color: '#00ccff', marginBottom: 4 }}>{obs.id}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 12, color: '#8aa0b8' }}>
            <span>Lat: {obs.latitude.toFixed(3)}°</span>
            <span>Lon: {obs.longitude.toFixed(3)}°</span>
            <span>Depth: {obs.depth.toFixed(1)} dbar</span>
            <span>{obs.time.slice(0, 10)}</span>
            <span>Temp: {obs.temperature !== null ? `${obs.temperature.toFixed(2)} °C` : '—'}</span>
            <span>Sal: {obs.salinity !== null ? `${obs.salinity.toFixed(2)} PSU` : '—'}</span>
          </div>
        </div>
      ))}
      {observations.notes.length > 0 && (
        <div style={sectionStyle}>
          <div style={labelStyle}>Notes</div>
          {observations.notes.map((n, i) => (
            <div key={i} style={{ fontSize: 11, color: '#5a7a95', marginBottom: 2 }}>• {n}</div>
          ))}
        </div>
      )}
    </div>
  )
}

// --- Comparison Tab ---
function ComparisonTab({
  comparison, loading, error, variable, latitude, longitude, depth, time,
}: {
  comparison: ComparisonResponse | null
  loading: boolean
  error: string | null
  variable: string
  latitude: number
  longitude: number
  depth: number
  time: string
}) {
  if (loading) return <EmptyState text="Running comparison..." />
  if (error) return <EmptyState text={`Error: ${error}`} color="#ff3366" />
  if (!comparison) {
    return (
      <div style={sectionStyle}>
        <div style={labelStyle}>Current selection</div>
        <div style={{ fontSize: 13, color: '#8aa0b8', lineHeight: 1.6 }}>
          Variable: <span style={{ color: '#e0e6ed' }}>{variable}</span><br />
          Location: <span style={{ color: '#e0e6ed' }}>{latitude.toFixed(2)}°, {longitude.toFixed(2)}°</span><br />
          Depth: <span style={{ color: '#e0e6ed' }}>{depth} m</span><br />
          Time: <span style={{ color: '#e0e6ed' }}>{time.slice(0, 10)}</span>
        </div>
        <div style={{ marginTop: 12, fontSize: 12, color: '#5a7a95' }}>
          Click "Compare" to run model-vs-observation comparison.
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Difference highlight */}
      <div style={{
        ...sectionStyle,
        textAlign: 'center',
        background: comparison.absolute_difference > 2
          ? 'rgba(255,51,102,0.08)'
          : comparison.absolute_difference > 0.5
          ? 'rgba(255,170,0,0.08)'
          : 'rgba(0,255,136,0.08)',
      }}>
        <div style={{ fontSize: 11, color: '#5a7a95', marginBottom: 4 }}>{comparison.interpretation}</div>
        <div style={{
          fontSize: 32, fontWeight: 800,
          color: comparison.absolute_difference > 2 ? '#ff3366' : comparison.absolute_difference > 0.5 ? '#ffaa00' : '#00ff88',
        }}>
          {comparison.difference > 0 ? '+' : ''}{comparison.difference.toFixed(3)} {comparison.unit}
        </div>
        <div style={{ fontSize: 11, color: '#5a7a95', marginTop: 2 }}>
          |Δ| = {comparison.absolute_difference.toFixed(3)}
        </div>
      </div>

      {/* Model vs Observation */}
      <div style={{ display: 'flex' }}>
        <div style={{ ...sectionStyle, flex: 1, borderRight: '1px solid #141e2e' }}>
          <div style={labelStyle}>Model</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#e0e6ed' }}>
            {comparison.model.value.toFixed(2)}
          </div>
          <div style={{ fontSize: 11, color: '#5a7a95' }}>{comparison.model.source}</div>
        </div>
        <div style={{ ...sectionStyle, flex: 1 }}>
          <div style={labelStyle}>Observation</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#e0e6ed' }}>
            {comparison.observation.value.toFixed(2)}
          </div>
          <div style={{ fontSize: 11, color: '#5a7a95' }}>{comparison.observation.source}</div>
          <div style={{ fontSize: 10, color: '#3a5a75', marginTop: 2 }}>{comparison.observation.id}</div>
        </div>
      </div>

      {/* Match details */}
      <div style={sectionStyle}>
        <div style={labelStyle}>Match Quality</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, fontSize: 12 }}>
          <MatchStat label="Distance" value={`${comparison.match.distance_km.toFixed(1)} km`} />
          <MatchStat label="Depth Δ" value={`${comparison.match.depth_difference.toFixed(1)} dbar`} />
          <MatchStat label="Time Δ" value={`${comparison.match.time_difference_days.toFixed(0)} days`} />
        </div>
      </div>

      {/* Notes */}
      {comparison.notes.length > 0 && (
        <div style={sectionStyle}>
          <div style={labelStyle}>Notes</div>
          {comparison.notes.map((n, i) => (
            <div key={i} style={{ fontSize: 11, color: '#5a7a95', marginBottom: 2 }}>• {n}</div>
          ))}
        </div>
      )}
    </div>
  )
}

function MatchStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: '#5a8ab5', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#e0e6ed' }}>{value}</div>
    </div>
  )
}

// --- Anomalies Tab ---
function AnomaliesTab({
  anomalies, loading, error, variable,
}: {
  anomalies: AnomalyResponse | null
  loading: boolean
  error: string | null
  variable: string
}) {
  if (loading) return <EmptyState text="Scanning anomalies..." />
  if (error) return <EmptyState text={`Error: ${error}`} color="#ff3366" />
  if (!anomalies) return <EmptyState text="Run anomaly scan to see results" />

  return (
    <div>
      {/* Overall status */}
      <div style={{
        ...sectionStyle,
        textAlign: 'center',
        background: anomalies.status === 'WARNING' ? 'rgba(255,51,102,0.08)' : 'rgba(0,255,136,0.05)',
      }}>
        <div style={{
          fontSize: 13, fontWeight: 700,
          color: anomalies.status === 'WARNING' ? '#ff3366' : '#00ff88',
        }}>
          {anomalies.status === 'WARNING' ? '⚠ WARNING' : '✓ NORMAL'}
        </div>
        <div style={{ fontSize: 11, color: '#5a7a95', marginTop: 4 }}>
          Threshold: {anomalies.threshold} {anomalies.unit} ({anomalies.threshold_type})
        </div>
        <div style={{ fontSize: 11, color: '#5a7a95' }}>
          {anomalies.count} anomaly candidate{anomalies.count !== 1 ? 's' : ''} detected
        </div>
      </div>

      {/* Anomaly list */}
      {anomalies.anomalies.map((a, i) => (
        <div key={i} style={{
          ...sectionStyle,
          borderLeft: a.status === 'WARNING' ? '3px solid #ff3366' : '3px solid #00ff88',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{
              fontSize: 11, fontWeight: 700,
              color: a.status === 'WARNING' ? '#ff3366' : '#00ff88',
            }}>
              {a.status}
            </span>
            <span style={{ fontSize: 11, color: '#5a7a95' }}>
              |Δ| = {a.absolute_difference.toFixed(3)} {a.unit}
            </span>
          </div>
          <div style={{ fontSize: 13, color: '#e0e6ed', marginBottom: 4 }}>
            {a.message}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 11, color: '#5a7a95' }}>
            <span>Lat: {a.location.latitude.toFixed(2)}°</span>
            <span>Lon: {a.location.longitude.toFixed(2)}°</span>
            <span>Obs: {a.observed_value.toFixed(2)}</span>
            <span>Model: {a.expected_value.toFixed(2)}</span>
            <span>Depth: {a.depth.toFixed(1)} dbar</span>
            <span>{a.time.slice(0, 10)}</span>
          </div>
        </div>
      ))}

      {/* Notes */}
      {anomalies.notes.length > 0 && (
        <div style={sectionStyle}>
          <div style={labelStyle}>Notes</div>
          {anomalies.notes.map((n, i) => (
            <div key={i} style={{ fontSize: 11, color: '#5a7a95', marginBottom: 2 }}>• {n}</div>
          ))}
        </div>
      )}
    </div>
  )
}

function EmptyState({ text, color = '#5a7a95' }: { text: string; color?: string }) {
  return (
    <div style={{ padding: 40, textAlign: 'center', color, fontSize: 13 }}>
      {text}
    </div>
  )
}
