// Action buttons — fetch model data, observations, compare, detect anomalies

import { useStore } from '../../store'
import {
  fetchModelField,
  fetchObservations,
  fetchComparison,
  fetchAnomalies,
} from '../../services/api'

const btnBase: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: 8,
  border: '1px solid #1a3050',
  background: '#0d1520',
  color: '#e0e6ed',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  textAlign: 'left',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
}

const btnPrimary: React.CSSProperties = {
  ...btnBase,
  background: 'linear-gradient(135deg, #0a2a3a 0%, #0d1e35 100%)',
  border: '1px solid #00ccff44',
  color: '#00ccff',
}

const btnDanger: React.CSSProperties = {
  ...btnBase,
  border: '1px solid #ff336644',
  color: '#ff3366',
}

const btnSuccess: React.CSSProperties = {
  ...btnBase,
  border: '1px solid #00ff8844',
  color: '#00ff88',
}

export default function ActionButtons() {
  const {
    variable, depth, time, latitude, longitude,
    selectedObservationId,
    setModelField, setObservations, setComparison, setAnomalies,
    setLoading, setError,
  } = useStore()

  const handleFetchModel = async () => {
    setLoading('modelField', true)
    setError('modelField', null)
    try {
      const data = await fetchModelField({
        variable, depth, time,
        lat_min: latitude - 5,
        lat_max: latitude + 5,
        lon_min: longitude - 5,
        lon_max: longitude + 5,
        max_points: 2000,
      })
      setModelField(data)
    } catch (e: any) {
      setError('modelField', e.message)
    } finally {
      setLoading('modelField', false)
    }
  }

  const handleFetchObservations = async () => {
    setLoading('observations', true)
    setError('observations', null)
    try {
      const data = await fetchObservations({
        latitude,
        longitude,
        radius_km: 300,
        time,
        time_tolerance_days: 180,
        max_observations: 500,
      })
      setObservations(data)
    } catch (e: any) {
      setError('observations', e.message)
    } finally {
      setLoading('observations', false)
    }
  }

  const handleCompare = async () => {
    setLoading('comparison', true)
    setError('comparison', null)
    try {
      const data = await fetchComparison({
        variable: variable === 'u_current' || variable === 'v_current' ? 'temperature' : variable,
        latitude,
        longitude,
        depth,
        time,
      })
      setComparison(data)
    } catch (e: any) {
      setError('comparison', e.message)
    } finally {
      setLoading('comparison', false)
    }
  }

  const handleAnomalies = async () => {
    setLoading('anomalies', true)
    setError('anomalies', null)
    try {
      const data = await fetchAnomalies({
        variable: variable === 'u_current' || variable === 'v_current' ? 'temperature' : variable,
        latitude,
        longitude,
        radius_km: 200,
        depth,
        time,
        time_tolerance_days: 180,
      })
      setAnomalies(data)
    } catch (e: any) {
      setError('anomalies', e.message)
    } finally {
      setLoading('anomalies', false)
    }
  }

  return (
    <div style={{
      position: 'absolute',
      bottom: 16,
      left: 16,
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      zIndex: 10,
      width: 260,
    }}>
      <button style={btnPrimary} onClick={handleFetchModel}>
        🌊 Fetch Model Field
      </button>
      <button style={btnSuccess} onClick={handleFetchObservations}>
        📡 Fetch Argo Observations
      </button>
      <button style={btnPrimary} onClick={handleCompare}>
        ⚖️ Compare Model vs Observation
      </button>
      <button style={btnDanger} onClick={handleAnomalies}>
        ⚠️ Detect Anomalies
      </button>
    </div>
  )
}
