// SAGARA API service — connects to all 5 backend endpoints

import type {
  MetadataResponse,
  ModelFieldResponse,
  ObservationResponse,
  ComparisonResponse,
  AnomalyResponse,
} from '../types/api'

const BASE_URL = ''  // Vite proxy handles /api → backend

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(body.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

// --- Health ---
export async function fetchHealth(): Promise<{ status: string; service: string }> {
  return fetchJson('/health')
}

// --- Metadata ---
export async function fetchMetadata(): Promise<MetadataResponse> {
  return fetchJson('/api/v1/metadata')
}

// --- Model Field ---
export interface ModelFieldParams {
  variable: string
  depth: number
  time: string
  lat_min?: number
  lat_max?: number
  lon_min?: number
  lon_max?: number
  max_points?: number
}

export async function fetchModelField(params: ModelFieldParams): Promise<ModelFieldResponse> {
  const qs = new URLSearchParams()
  qs.set('variable', params.variable)
  qs.set('depth', String(params.depth))
  qs.set('time', params.time)
  if (params.lat_min !== undefined) qs.set('lat_min', String(params.lat_min))
  if (params.lat_max !== undefined) qs.set('lat_max', String(params.lat_max))
  if (params.lon_min !== undefined) qs.set('lon_min', String(params.lon_min))
  if (params.lon_max !== undefined) qs.set('lon_max', String(params.lon_max))
  if (params.max_points !== undefined) qs.set('max_points', String(params.max_points))
  return fetchJson(`/api/v1/model-field?${qs}`)
}

// --- Observations ---
export interface ObservationParams {
  source?: string
  latitude?: number
  longitude?: number
  lat_min?: number
  lat_max?: number
  lon_min?: number
  lon_max?: number
  depth?: number
  depth_tolerance?: number
  time?: string
  time_tolerance_days?: number
  radius_km?: number
  variable?: string
  max_observations?: number
}

export async function fetchObservations(params: ObservationParams = {}): Promise<ObservationResponse> {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) qs.set(k, String(v))
  }
  return fetchJson(`/api/v1/observations?${qs}`)
}

// --- Comparison ---
export interface ComparisonParams {
  variable: string
  latitude: number
  longitude: number
  depth: number
  time: string
  max_distance_km?: number
  max_depth_diff?: number
  max_time_diff_days?: number
}

export async function fetchComparison(params: ComparisonParams): Promise<ComparisonResponse> {
  const qs = new URLSearchParams()
  qs.set('variable', params.variable)
  qs.set('latitude', String(params.latitude))
  qs.set('longitude', String(params.longitude))
  qs.set('depth', String(params.depth))
  qs.set('time', params.time)
  if (params.max_distance_km !== undefined) qs.set('max_distance_km', String(params.max_distance_km))
  if (params.max_depth_diff !== undefined) qs.set('max_depth_diff', String(params.max_depth_diff))
  if (params.max_time_diff_days !== undefined) qs.set('max_time_diff_days', String(params.max_time_diff_days))
  return fetchJson(`/api/v1/comparison?${qs}`)
}

// --- Anomalies ---
export interface AnomalyParams {
  variable: string
  latitude?: number
  longitude?: number
  radius_km?: number
  depth?: number
  depth_tolerance?: number
  time?: string
  time_tolerance_days?: number
  threshold?: number
  max_results?: number
}

export async function fetchAnomalies(params: AnomalyParams): Promise<AnomalyResponse> {
  const qs = new URLSearchParams()
  qs.set('variable', params.variable)
  for (const [k, v] of Object.entries(params)) {
    if (k !== 'variable' && v !== undefined) qs.set(k, String(v))
  }
  return fetchJson(`/api/v1/anomalies?${qs}`)
}
