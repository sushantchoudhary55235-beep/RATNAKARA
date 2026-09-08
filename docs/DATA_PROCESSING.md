# Data Processing Pipeline

> This document describes how raw scientific datasets are transformed into the normalized format used by the SAGARA backend and frontend.
>
> **Phase 1 verification (2026-09-06):** Updated to match the actual local files in `data/sample/`. Details that were previously assumed (Kelvin temperatures, 5–25°N coverage, JSON observation files) have been corrected to what the files actually contain.

---

## Pipeline Overview

```
Real Scientific Dataset
        ↓
Download small regional subset
        ↓
Raw file (NetCDF / CSV)
        ↓
Read using xarray / appropriate parser
        ↓
Validate coordinates
        ↓
Apply dataset-provided QC flags (observations)
        ↓
Normalize variable names
        ↓
Normalize units
        ↓
Spatial subset (per request / bounding box)
        ↓
Depth subset (per request)
        ↓
Time subset (available window)
        ↓
Cache locally (data/sample/)
        ↓
FastAPI serves processed data
        ↓
Frontend retrieves via REST API
        ↓
3D Visualization (Three.js / React Three Fiber)
        ↓
Model vs Observation Comparison
        ↓
Anomaly Analysis
```

---

## Actual Local Files

| File | Format | Source | Contents |
|------|--------|--------|----------|
| `data/sample/arabian_sea_model.nc` | NetCDF-4 | CMEMS GLORYS12V1 | Model fields, **single timestep** (2026-06-23) |
| `data/sample/arabian_sea_argo.nc` | NetCDF-4 (flat table) | INCOIS ERDDAP `Indian_ARGO_Floats` | Argo float observations, 2003–2025 |
| `data/sample/arabian_sea_glider.csv` | CSV (with units header row) | INCOIS Argo-style export | **Candidate** underwater-platform observations — unverified as glider data |

---

## Step 1: Data Acquisition

### CMEMS Model
- Access via CMEMS portal or Copernicus Marine Toolbox
- Subset before download and save as `data/sample/arabian_sea_model.nc`
- Actual file: -30–25°N, 45–100°E, 0–541 m depth, **one timestep**

### Argo
- Downloaded from INCOIS ERDDAP (`Indian_ARGO_Floats`), filtered to the Arabian Sea box (lat 5–25, lon 55–80)
- Saved as `data/sample/arabian_sea_argo.nc` (NetCDF flat table, one row per measurement)

### Candidate Glider / Underwater-Platform Data
- Present as `data/sample/arabian_sea_glider.csv`
- **Not verified as glider data** — see [DATA_SOURCES.md](DATA_SOURCES.md) §C
- Not a required dependency for the MVP

---

## Step 2: Raw File Reading

### NetCDF (CMEMS Model)
```python
import xarray as xr

ds = xr.open_dataset("data/sample/arabian_sea_model.nc")  # lazy; do not load fully into memory
```

### NetCDF (Argo Observations)
```python
import xarray as xr

ds = xr.open_dataset("data/sample/arabian_sea_argo.nc")
# Flat table: dims = (row,); each row is one pressure measurement.
# Profiles = groups of PLATFORM_NUMBER + CYCLE_NUMBER + DIRECTION, sorted by PRES.
```

### CSV (Candidate Underwater-Platform Data)
```python
import pandas as pd

df = pd.read_csv("data/sample/arabian_sea_glider.csv", skiprows=[1], low_memory=False)
# Row 1 = column names, Row 2 = units ("UTC, UTC, degrees_north, ...") — must be skipped.
```

---

## Step 3: Validation & Quality Control

The following checks are performed on all data:

| Check | Description |
|-------|-------------|
| Missing values | Detect NaN/None; handle with `null` |
| Coordinates | Latitude: -90 to 90, Longitude: -180 to 180 |
| Pressure/Depth | Negative values rejected (dataset QC respected) |
| Timestamps | Must be valid ISO 8601 format |
| Duplicates | Detect duplicate observations |
| Units | Verified against source metadata |
| Variables | Check required variables exist |
| **Scientific QC** | **Use the dataset-provided QC flags only (e.g., Argo `*_QC`: drop `4` = bad, review `3`)** — do **not** invent official thresholds |

> Argo raw values include physically implausible readings (TEMP > 60 °C, PSAL > 70 PSU, negative PRES). The backend must filter using the QC flags present in the file, never return them blindly, and never modify the original file.

---

## Step 4: Normalization

### Variable Name Normalization
Source variables are mapped to standardized names:

| Source | CMEMS Model | Argo / Candidate | Normalized Name |
|--------|-------------|------------------|-----------------|
| Temperature | `thetao` | `TEMP` | `temperature` |
| Salinity | `so` | `PSAL` | `salinity` |
| Eastward current | `uo` | — | `u_current` |
| Northward current | `vo` | — | `v_current` |
| Pressure | — | `PRES` (decibar) | `pressure` (≈ depth in meters) |

### Unit Normalization
- **Temperature: `thetao` is already stored in degrees Celsius. Do NOT convert from Kelvin.** (Verified: range -2.4 to 34.0 °C.)
- Salinity: PSU — `so` uses CMEMS notation `1e-3` but values are already practical salinity units; `PSAL` is PSU. No conversion needed.
- Currents: m/s (no conversion needed).
- Pressure: decibar; 1 dbar ≈ 1 m depth for conversion if needed.

---

## Step 5: Subsetting

The actual model file covers -30–25°N, 45–100°E. Subsetting for the Arabian Sea view is done **per request** (the file is not pre-subset to 5–25°N / 55–80°E):

```python
# Example: per-request spatial subset (not a file modification)
subset = ds.sel(
    latitude=slice(lat_min, lat_max),
    longitude=slice(lon_min, lon_max),
)
```

```python
# Example: depth level selection
level = ds.sel(depth=some_level, method="nearest")
```

```python
# Example: time selection — currently the file has a single timestep (2026-06-23)
snapshot = ds.sel(time="2026-06-23")
```

> **Note:** The backend should still expose the `time` field so future multi-time files work without architectural change.

---

## Step 6: Local Caching

Processed subsets are cached locally. The prototype loads from these cached files, not live API calls:

| File | Format | Source |
|------|--------|--------|
| `data/sample/arabian_sea_model.nc` | NetCDF-4 | CMEMS GLORYS12V1 |
| `data/sample/arabian_sea_argo.nc` | NetCDF-4 | INCOIS Argo |
| `data/sample/arabian_sea_glider.csv` | CSV | Candidate underwater-platform (unverified glider) |

---

## Step 7: API Serving (FastAPI)

The backend reads cached files and serves them via REST endpoints:

| Endpoint | Description | Data Source |
|----------|-------------|-------------|
| `GET /api/v1/model-field` | Ocean model grid data | `arabian_sea_model.nc` |
| `GET /api/v1/observations` | Argo observations (QC-filtered, adjusted-preferred) | `arabian_sea_argo.nc` |
| `GET /api/v1/comparison` | Model vs nearest valid Argo observation | Both |
| `GET /api/v1/anomalies` | Prototype anomaly indicators (model vs observation) | Model + observations |

> Glider serving is **reserved**: the candidate CSV's provenance is unverified, so
> no glider observations are served (no fabricated data). `source=glider` returns 400.

> Files are large (235–455 MB). The processing layer should load lazily / cache processed results in memory or on disk (e.g., Parquet) so per-request work stays small.

---

## Step 8: Model–Observation Matching (Comparison — implemented)

`GET /api/v1/comparison` matches a model grid point to the nearest valid Argo
observation using a fully documented, deterministic nearest-neighbour strategy:

1. **Model side** — reuses the Phase 3 processor: nearest model timestep and
   depth level are selected, then the grid cell closest to the requested
   lat/lon is read. Land-masked (NaN) cells raise a clear 404.
2. **Observation side** — reuses the Phase 4 cached NumPy columns (no reload
   per request, no Python loops over ~4M rows). Candidates must have valid
   coordinates, a QC-passed value for the variable, and lie inside all matching
   windows: Haversine distance ≤ `max_distance_km` (default 500 km),
   |PRES − depth| ≤ `max_depth_diff` (default 100 dbar),
   time difference ≤ `max_time_diff_days` (default 730 days).
3. **Score** — `distance/max_distance + depth_diff/max_depth_diff +
   time_diff/max_time_diff`; the minimum score wins (ties → lowest row index).
   `distance_km`, `depth_difference` and `time_difference_days` are returned so
   the frontend can explain WHY that observation was selected.
4. **Difference** — `difference = model − observation` (plus its absolute value)
   and a plain-language interpretation.

### Matching limitations (explicit)
- **Haversine spatial matching** (great-circle km) — never Euclidean degrees.
- **Depth proxy:** Argo `depth` is the pressure (PRES/PRES_ADJUSTED) in dbar used
  as a depth proxy; the requested depth is compared against the proxy directly.
  No invented pressure→depth conversion formula is applied.
- **Time tolerance:** the default 730 days reflects that the current model file
  has a single timestep (2026-06-23) while the real Argo subset ends
  2025-04-01. The selected observation's actual `time_difference_days` is always
  exposed — large temporal offsets are never hidden.
- **Current-variable limitation:** Argo provides temperature and salinity only;
  `u_current`/`v_current` comparisons return a clear 400 (currents are never
  fabricated).
- **Prototype validation limitation:** this matching is a prototype analytical
  comparison, NOT official INCOIS model validation, and no certified accuracy is
  claimed.

## Step 9: Anomaly Detection (Prototype Analytical Indicator — implemented)

`GET /api/v1/anomalies` builds a **prototype analytical indicator** from
model-observation differences:

```
Model (expected value)
        ↓
Argo observation (observed value, QC-passed, adjusted-preferred)
        ↓
vectorized nearest-grid matching (Phase 4 cached NumPy columns)
        ↓
difference = observed − expected   (absolute_difference = |difference|)
        ↓
prototype analytical threshold (temperature 2.0 °C, salinity 0.5 PSU — configurable)
        ↓
NORMAL (|difference| < threshold)  /  WARNING (|difference| >= threshold)
```

- **Reuse:** the model side uses the shared Phase 5 `get_model_surface`
  lookup; the observation side reuses the Phase 4 cached NumPy columns via a
  vectorized scan (`find_anomaly_candidates`) — no per-row Python loop over
  ~4M rows, no dataset reload per request, results bounded (default 50, hard
  cap 500) with deterministic stride downsampling and ordering.
- **Filters:** `latitude`/`longitude` + `radius_km` (Haversine), `depth` +
  `depth_tolerance` (pressure/depth proxy in dbar), `time` +
  `time_tolerance_days`, `threshold`, `max_results`.
- **Threshold:** a configurable **prototype analytical threshold** — NOT an
  INCOIS-approved or scientifically validated value. The threshold actually
  used is always exposed in the response (`threshold`, `threshold_type`).
- **Status values:** `NORMAL` and `WARNING` only. No CRITICAL/DANGER/EMERGENCY
  states exist because there is no scientific basis for them in this prototype.

> **This is NOT official INCOIS warning logic.** The endpoint returns a
> "SAGARA prototype analytical indicator" / "potential anomaly" based on the
> model-observation difference. It is not an official warning, forecast,
> certified anomaly detection, or operational disaster alert.

> **Anomaly caveat:** the current model file has a single timestep, so
> time-based climatology is not possible with it; the indicator is a
> model-vs-observation residual, not a climatological anomaly. A proper
> climatological baseline requires additional temporal model data.

## Step 10–11: Frontend Consumption, 3D Visualization

(Unchanged from the original design: the frontend calls the REST endpoints, receives normalized JSON, and renders 3D layers.)

---

## Key Design Decisions

1. **xarray for NetCDF processing** — labeled dimensions, integrates with NumPy
2. **Cached subsets** — prototype does not depend on live internet access
3. **No data fabrication** — all measurements come from real scientific sources; the candidate glider file is NOT presented as confirmed glider data
4. **QC from the dataset, not invented** — observation filtering uses the file's own QC flags
5. **`thetao` stays Celsius** — no Kelvin conversion
6. **Null for missing variables** — when a source doesn't provide a variable, use `null`
7. **Time-field support now, single timestep now** — expose `time` in the API even though the current model file has only one snapshot