// Types matching the SAGARA backend API schemas

// --- Metadata ---
export interface SpatialCoverage {
  latitude_min: number
  latitude_max: number
  longitude_min: number
  longitude_max: number
}

export interface ModelDatasetMetadata {
  filename: string
  source: string
  variables: Record<string, string>
  variable_units: Record<string, string>
  spatial_coverage: SpatialCoverage
  depth_range_m: number[]
  time_steps: number
  notes: string[]
}

export interface ArgoDatasetMetadata {
  filename: string
  source: string
  fields: string[]
  qc_fields: string[]
}

export interface UnderwaterPlatformMetadata {
  filename: string
  source: string
  status: string
}

export interface DatasetsMetadata {
  model: ModelDatasetMetadata
  argo: ArgoDatasetMetadata
  underwater_platform: UnderwaterPlatformMetadata
}

export interface MetadataResponse {
  project: string
  version: string
  datasets: DatasetsMetadata
}

// --- Model Field ---
export interface ModelFieldPoint {
  latitude: number
  longitude: number
  value: number
}

export interface ModelFieldResponse {
  variable: string
  unit: string
  depth: number
  time: string
  source: string
  points: ModelFieldPoint[]
}

// --- Observations ---
export interface Observation {
  id: string
  latitude: number
  longitude: number
  depth: number
  time: string
  temperature: number | null
  salinity: number | null
}

export interface ObservationResponse {
  source: string
  mode: string
  count: number
  depth_units: string
  notes: string[]
  observations: Observation[]
}

// --- Comparison ---
export interface ComparisonLocation {
  latitude: number
  longitude: number
}

export interface ComparisonRequested {
  depth: number
  time: string
}

export interface ComparisonModelValue {
  value: number
  source: string
}

export interface ComparisonObservation {
  value: number
  source: string
  id: string
  latitude: number
  longitude: number
  depth: number
  time: string
}

export interface ComparisonMatch {
  distance_km: number
  depth_difference: number
  time_difference_days: number
}

export interface ComparisonResponse {
  variable: string
  unit: string
  location: ComparisonLocation
  requested: ComparisonRequested
  model: ComparisonModelValue
  observation: ComparisonObservation
  difference: number
  absolute_difference: number
  match: ComparisonMatch
  interpretation: string
  mode: string
  notes: string[]
}

// --- Anomaly ---
export interface AnomalyLocation {
  latitude: number
  longitude: number
}

export interface AnomalyObservation {
  id: string
  source: string
}

export interface AnomalyModelValue {
  source: string
}

export interface Anomaly {
  status: string
  indicator_type: string
  variable: string
  unit: string
  location: AnomalyLocation
  depth: number
  time: string
  observed_value: number
  expected_value: number
  difference: number
  absolute_difference: number
  threshold: number
  threshold_type: string
  observation: AnomalyObservation
  model: AnomalyModelValue
  message: string
}

export interface AnomalyResponse {
  count: number
  status: string
  indicator_type: string
  variable: string
  unit: string
  threshold: number
  threshold_type: string
  mode: string
  anomalies: Anomaly[]
  notes: string[]
}

// --- Validation (Forecast Truth Engine) ---
export interface ValidationMetrics {
  bias: number
  mae: number
  rmse: number
  pair_count: number
  model_mean: number
  observation_mean: number
}

export interface CollocationInfo {
  total_argo_candidates: number
  spatial_temporal_matched: number
  depth_matched: number
  valid_pairs: number
  rejected_by_land: number
  mean_depth_difference_dbar: number
  max_depth_difference_dbar: number
  mean_spatial_distance_km: number
  max_spatial_distance_km: number
  model_time_used: string
  observation_time_range: string[]
  depth_tolerance_dbar: number
  time_tolerance_days: number
}

export interface ValidationResponse {
  variable: string
  unit: string
  source_model: string
  source_observation: string
  mode: string
  metrics: ValidationMetrics
  collocation: CollocationInfo
  notes: string[]
}

// --- Alert (Forecast Truth Engine deterministic alert) ---
export interface AlertThreshold {
  metric: string
  value: number
  threshold: number
  passed: boolean
}

export interface AlertResult {
  variable: string
  unit: string
  risk_level: string
  reason: string
  thresholds_evaluated: AlertThreshold[]
  pair_count: number
  indicator_type: string
}

export interface AlertResponse {
  alerts: AlertResult[]
  overall_risk: string
  mode: string
  notes: string[]
}

// --- Chat (OceanAI) ---
export interface ChatContext {
  latitude?: number
  longitude?: number
  depth?: number
  variable?: string
}

export interface ChatRequest {
  question: string
  context?: ChatContext
}

export interface ChatResponse {
  answer: string
}
