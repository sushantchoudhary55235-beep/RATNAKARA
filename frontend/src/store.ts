// Global application state using Zustand

import { create } from 'zustand'
import type {
  ModelFieldResponse,
  ObservationResponse,
  ComparisonResponse,
  AnomalyResponse,
  MetadataResponse,
} from './types/api'

export interface AppState {
  // --- Selection state ---
  variable: string
  depth: number
  time: string
  latitude: number
  longitude: number

  // --- Data state ---
  metadata: MetadataResponse | null
  modelField: ModelFieldResponse | null
  observations: ObservationResponse | null
  comparison: ComparisonResponse | null
  anomalies: AnomalyResponse | null

  // --- Loading / error ---
  loading: {
    modelField: boolean
    observations: boolean
    comparison: boolean
    anomalies: boolean
  }
  errors: {
    modelField: string | null
    observations: string | null
    comparison: string | null
    anomalies: string | null
  }

  // --- UI state ---
  selectedObservationId: string | null
  panelTab: 'observations' | 'comparison' | 'anomalies'
  showPanel: boolean

  // --- Actions ---
  setVariable: (v: string) => void
  setDepth: (d: number) => void
  setTime: (t: string) => void
  setLatitude: (lat: number) => void
  setLongitude: (lon: number) => void
  setSelectedObservation: (id: string | null) => void
  setPanelTab: (tab: 'observations' | 'comparison' | 'anomalies') => void
  togglePanel: () => void

  setMetadata: (m: MetadataResponse) => void
  setModelField: (d: ModelFieldResponse | null) => void
  setObservations: (d: ObservationResponse | null) => void
  setComparison: (d: ComparisonResponse | null) => void
  setAnomalies: (d: AnomalyResponse | null) => void

  setLoading: (key: keyof AppState['loading'], v: boolean) => void
  setError: (key: keyof AppState['errors'], e: string | null) => void
}

export const useStore = create<AppState>((set) => ({
  // Defaults — Arabian Sea center
  variable: 'temperature',
  depth: 50,
  time: '2024-06-01T00:00:00',
  latitude: 15.5,
  longitude: 65.0,

  metadata: null,
  modelField: null,
  observations: null,
  comparison: null,
  anomalies: null,

  loading: { modelField: false, observations: false, comparison: false, anomalies: false },
  errors: { modelField: null, observations: null, comparison: null, anomalies: null },

  selectedObservationId: null,
  panelTab: 'observations',
  showPanel: true,

  setVariable: (variable) => set({ variable }),
  setDepth: (depth) => set({ depth }),
  setTime: (time) => set({ time }),
  setLatitude: (latitude) => set({ latitude }),
  setLongitude: (longitude) => set({ longitude }),
  setSelectedObservation: (selectedObservationId) => set({ selectedObservationId }),
  setPanelTab: (panelTab) => set({ panelTab }),
  togglePanel: () => set((s) => ({ showPanel: !s.showPanel })),

  setMetadata: (metadata) => set({ metadata }),
  setModelField: (modelField) => set({ modelField }),
  setObservations: (observations) => set({ observations }),
  setComparison: (comparison) => set({ comparison }),
  setAnomalies: (anomalies) => set({ anomalies }),

  setLoading: (key, v) => set((s) => ({ loading: { ...s.loading, [key]: v } })),
  setError: (key, e) => set((s) => ({ errors: { ...s.errors, [key]: e } })),
}))
