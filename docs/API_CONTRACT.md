# API Contract

This document defines the agreed-upon API contract between the frontend and backend.

> **Canonical API base: `/api/v1`.** All application endpoints (except `/health`)
> live under `/api/v1`. Earlier versions of this document referenced `/api/...`
> paths; those have been corrected to match the implementation.

## Endpoints

### Health Check
- **GET** `/health`
- **Response:** `{"status": "ok", "service": "SAGARA backend"}`

---

### Dataset Metadata
- **GET** `/api/v1/metadata`
- **Description:** Verified metadata for the local sample datasets.

### Model Field Data
- **GET** `/api/v1/model-field`
- **Description:** Retrieve ocean model field data (temperature, salinity, etc.)
- **Query Parameters:**
  - `variable` (string): Variable name (e.g., "temperature", "salinity")
  - `depth` (float): Depth level in meters
  - `lat_min`, `lat_max` (float): Latitude bounds
  - `lon_min`, `lon_max` (float): Longitude bounds
  - `time` (string): ISO 8601 timestamp

### Observations (Argo; glider reserved)
- **GET** `/api/v1/observations`
- **Description:** Retrieve in-situ observations from the real INCOIS Argo dataset.
  `source=glider` is reserved and returns 400 until verified glider data exists.
- **Query Parameters (all optional unless noted):**
  - `source` (string, default `argo`): `argo` | `all` (`glider` → 400, provenance unverified)
  - `latitude`, `longitude` (float): center point for radius filtering (validated −90..90 / −180..180; invalid → **400**)
  - `lat_min`, `lat_max`, `lon_min`, `lon_max` (float): geographic bounding box (invalid → **400**)
  - `depth` (float): target **pressure/depth proxy in dbar** — Argo PRES/PRES_ADJUSTED, NOT exact geometric depth. Tolerance filter: `|pres − depth| ≤ depth_tolerance`
  - `depth_tolerance` (float, default 25): dbar window for the depth filter
  - `time` (ISO 8601): temporal filter; observations within `time_tolerance_days` are returned
  - `time_tolerance_days` (float, default 30)
  - `radius_km` (float): Haversine radius around (`latitude`, `longitude`); requires both; max 2000 km
  - `variable` (string): `temperature` | `salinity` | `temp_sal` — keep only rows reporting that measurement
  - `max_observations` (int, default 5000, max 5000): deterministic downsampling above this limit
- **Response modes:**
  - `"mode": "real"` / `"source": "Argo"` — values from the real `data/sample/arabian_sea_argo.nc`
  - `"mode": "demo"` / `"source": "demo"` — dataset file missing; clearly-marked demo data (never mixed with real data)
- **Response:**

```json
{
  "source": "Argo",
  "mode": "real",
  "count": 1,
  "depth_units": "dbar (pressure/depth proxy)",
  "notes": ["...QC/pressure documentation..."],
  "observations": [
    {
      "id": "ARGO_2902093_C23_471111",
      "latitude": 17.05686,
      "longitude": 66.41908,
      "depth": 295.0,
      "time": "2013-07-13T03:24:00",
      "temperature": 14.992,
      "salinity": 35.867
    }
  ]
}
```

- **Data selection:** adjusted variables preferred (`TEMP_ADJUSTED`, `PSAL_ADJUSTED`,
  `PRES_ADJUSTED`) with raw fallback (`TEMP`, `PSAL`, `PRES`) when adjusted values
  are missing. QC: the dataset's own Argo flags are used; flags `4` (bad) and
  `9` (missing) are rejected for the affected measurement. Missing
  temperature/salinity are returned as `null` — never fabricated. Rows without
  valid coordinates are never returned.
- **Status codes:** 200 OK · 400 invalid parameters/coordinates · 404 no matching
  data · 422 validation error · 500 unexpected internal error

### Comparison (Model vs Reality)
- **GET** `/api/v1/comparison`
- **Description:** Compare the model value at a point against the nearest valid
  Argo observation. **Prototype analytical comparison — not official INCOIS
  validation.**
- **Required Parameters:**
  - `variable` (string): `temperature` | `salinity`. `u_current`/`v_current`
    return a clear **400** (Argo provides no real current observations; currents
    are not fabricated). Any other value → **400**.
  - `latitude` (float, −90..90; invalid → **400**)
  - `longitude` (float, −180..180; invalid → **400**)
  - `depth` (float, ≥ 0; invalid → **400**). Model side: nearest grid depth in m;
    Argo side: **pressure/depth proxy in dbar** — compared directly against PRES.
  - `time` (ISO 8601; validated → **422** on bad format)
- **Optional Matching Windows (deterministic nearest-neighbour matching):**
  - `max_distance_km` (default 500, Haversine radius)
  - `max_depth_diff` (default 100, dbar window on the pressure proxy)
  - `max_time_diff_days` (default 730 — the current model file has a single
    timestep, 2026-06-23, while the real Argo subset ends 2025-04-01; the
    selected observation's actual `time_difference_days` is always exposed so
    large offsets stay visible)
- **Matching method:** candidates = Argo rows with valid coordinates + a QC-passed
  value for the variable + inside all windows; deterministic score =
  `distance/max_distance + depth_diff/max_depth_diff + time_diff/max_time_diff`;
  minimum score wins (ties → lowest row index).
- **Response (200):**

```json
{
  "variable": "temperature",
  "unit": "°C",
  "location": {"latitude": 18.5, "longitude": 72.8},
  "requested": {"depth": 50, "time": "2026-06-23T00:00:00"},
  "model": {"value": 27.4, "source": "Copernicus Marine"},
  "observation": {
    "value": 26.8, "source": "Argo", "id": "ARGO_...",
    "latitude": 18.52, "longitude": 72.81,
    "depth": 50.2, "time": "2024-05-21T18:38:50"
  },
  "difference": 0.6,
  "absolute_difference": 0.6,
  "match": {"distance_km": 15.75, "depth_difference": 0.67, "time_difference_days": 10.223},
  "interpretation": "Model value is higher than observation",
  "mode": "real",
  "notes": ["...matching method, pressure/depth proxy, single model timestep, prototype-only disclaimer..."]
}
```

- `difference = model.value − observation.value`; `interpretation` is
  higher/lower/matches; `match` exposes exactly why the observation was selected.
- **Data honesty:** observation values come strictly from the real Argo dataset
  (adjusted variables preferred, raw fallback, dataset QC flags 4/9 rejected);
  unusable/null measurements are never fabricated — a comparison without a valid
  measurement returns **404**.
- **Missing datasets:** if the model or Argo file is absent, a clear **404**
  unavailable response is returned (real/demo data are never mixed for comparison).
- **Status codes:** 200 OK · 400 invalid/unsupported variable or coordinates ·
  404 no suitable observation / dataset unavailable · 422 request validation ·
  500 unexpected internal error

### Anomalies (Prototype Analytical Indicator)
- **GET** `/api/v1/anomalies`
- **Description:** Scan model-vs-observation differences and return prototype
  anomaly candidates. **SAGARA prototype analytical indicator — NOT an official
  INCOIS warning, forecast, or certified anomaly detection.** The threshold is a
  configurable prototype parameter, not a scientifically validated value.
- **Parameters:**
  - `variable` (required): `temperature` | `salinity`. `u_current`/`v_current`
    → clear **400** (no real Argo current observations exist; currents are never
    fabricated). Other values → **400**.
  - `latitude`, `longitude` (float, optional): circle center for radius filtering
    (validated −90..90 / −180..180; invalid → **400**; both required together)
  - `radius_km` (float, optional): Haversine radius in km; requires both center
    coordinates (invalid → **400**)
  - `depth` (float, optional): target **pressure/depth proxy in dbar** (tolerance filter)
  - `depth_tolerance` (float, default 25, dbar)
  - `time` (ISO 8601, optional): temporal filter for observations
  - `time_tolerance_days` (float, default 365)
  - `threshold` (float, optional, ≥ 0; negative → **400**): prototype analytical
    threshold override. Defaults: **temperature 2.0 °C, salinity 0.5 PSU** —
    demo/analytical values ONLY.
  - `max_results` (int, default 50, hard cap 500)
- **Status logic (per candidate):** `difference = observed − expected`
  (Argo − model); `absolute_difference = abs(difference)`;
  `WARNING` when `absolute_difference >= threshold`, else `NORMAL`. Only
  WARNING candidates are returned; overall `status` is `WARNING` when any
  candidate is WARNING, else `NORMAL`. Two states only — no CRITICAL/DANGER.
- **Response (200):**

```json
{
  "count": 1,
  "status": "WARNING",
  "indicator_type": "prototype_analytical_indicator",
  "variable": "temperature",
  "unit": "°C",
  "threshold": 2.0,
  "threshold_type": "prototype analytical threshold",
  "mode": "real",
  "anomalies": [
    {
      "status": "WARNING",
      "indicator_type": "prototype_analytical_indicator",
      "variable": "temperature",
      "unit": "°C",
      "location": {"latitude": 15.36, "longitude": 65.03},
      "depth": 49.33,
      "time": "2024-05-21T18:38:50",
      "observed_value": 29.738,
      "expected_value": 27.5,
      "difference": 2.238,
      "absolute_difference": 2.238,
      "threshold": 2.0,
      "threshold_type": "prototype analytical threshold",
      "observation": {"id": "ARGO_...", "source": "Argo"},
      "model": {"source": "Copernicus Marine"},
      "message": "Unusual temperature difference detected between model and observation. Observed value is higher than model value."
    }
  ],
  "notes": ["...prototype indicator, not official INCOIS warning, pressure/depth proxy, single model timestep, no fabricated values..."]
}
```

- **Data honesty:** values come strictly from the real local model + Argo
  datasets (adjusted variables preferred, dataset QC flags 4/9 rejected);
  land-masked model cells are skipped — nothing is fabricated. Missing datasets
  → clear **404** (real and demo data are never mixed for anomaly indicators).
- **Status codes:** 200 OK · 400 invalid/unsupported variable, coordinates,
  threshold, radius/center combination · 404 no matching observations or dataset
  unavailable · 422 request validation · 500 unexpected internal error

---

## Response Formats

Each endpoint returns a **purpose-built JSON structure** documented above. There
is no single wrapper envelope — every endpoint defines its own response schema.

### Common patterns

| Pattern | Where |
|---------|-------|
| `"mode": "real"` / `"demo"` | observations, comparison, anomalies — indicates whether the response comes from real local datasets or demo fallback |
| `"source": "Argo"` / `"demo"` | observations — data source |
| `"model": {"source": "Copernicus Marine"}` | comparison, anomalies — model source |
| `"notes": [...]` | observations, comparison, anomalies — scientific-honesty / processing notes |
| `"depth_units": "dbar (pressure/depth proxy)"` | observations — documents that depth is pressure-based |

### Error responses

All errors return a JSON body with a `detail` field:

```json
{"detail": "Human-readable error message"}
```

| HTTP Status | Meaning |
|-------------|---------|
| 400 | Invalid client parameter |
| 404 | Requested valid data does not exist |
| 422 | Request validation failure (missing required params, bad format) |
| 500 | Unexpected internal failure |
