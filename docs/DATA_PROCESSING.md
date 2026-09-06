# Data Processing Pipeline

> This document describes how raw scientific datasets are transformed into the normalized format used by the SAGARA backend and frontend.

---

## Pipeline Overview

```
Real Scientific Dataset
        ↓
Download small regional subset
        ↓
Raw file (NetCDF / JSON)
        ↓
Read using xarray / appropriate parser
        ↓
Validate coordinates
        ↓
Normalize variable names
        ↓
Normalize units
        ↓
Spatial subset (bounding box)
        ↓
Depth subset (0–500m)
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

## Step 1: Data Acquisition

### Copernicus Marine
- Access via CMEMS portal or Copernicus Marine Toolbox
- Subset to Arabian Sea region before download
- Download as NetCDF-4

### Argo
- Access via Argo API or GDAC FTP
- Filter by bounding box (Arabian Sea)
- Export as JSON

### Glider
- Access via IOOS glider database
- Filter by region if available
- Export as JSON

---

## Step 2: Raw File Reading

### NetCDF (Copernicus Model Data)
```python
import xarray as xr

ds = xr.open_dataset("data/sample/model_subset.nc")
```

### JSON (Argo / Glider)
```python
import json

with open("data/sample/argo_subset.json") as f:
    data = json.load(f)
```

---

## Step 3: Validation

The following checks are performed on all data:

| Check | Description |
|-------|-------------|
| Missing values | Detect NaN/None, handle with null |
| Coordinates | Latitude: -90 to 90, Longitude: -180 to 180 |
| Depth | Must be non-negative |
| Timestamps | Must be valid ISO 8601 format |
| Duplicates | Detect duplicate observations |
| Units | Verify against source metadata |
| Variables | Check required variables exist |

---

## Step 4: Normalization

### Variable Name Normalization
Source variables are mapped to standardized names:

| Source | Copernicus | Argo | Normalized Name |
|--------|-----------|------|-----------------|
| Temperature | `thetao` | `temperature` | `temperature` |
| Salinity | `so` | `salinity` | `salinity` |
| Eastward current | `uo` | — | `u_current` |
| Northward current | `vo` | — | `v_current` |

### Unit Normalization
- Temperature: Convert to °C if needed (K → °C: subtract 273.15)
- Salinity: PSU (no conversion needed)
- Currents: m/s (no conversion needed)

---

## Step 5: Subsetting

### Spatial Subset
```python
subset = ds.sel(
    lat=slice(5, 25),    # 5°N – 25°N
    lon=slice(55, 80)    # 55°E – 80°E
)
```

### Depth Subset
```python
subset = subset.sel(depth=slice(0, 500))  # 0 – 500 meters
```

### Time Subset
```python
subset = subset.sel(time=slice("2026-01-01", "2026-03-01"))  # Small time window
```

---

## Step 6: Local Caching

Processed subsets are saved to `data/sample/`:

| File | Format | Source |
|------|--------|--------|
| `model_subset.nc` | NetCDF-4 | Copernicus Marine |
| `argo_subset.json` | JSON | Argo Program |
| `glider_subset.json` | JSON | Glider (if available) |

The prototype loads from these cached files, not from live API calls.

---

## Step 7: API Serving (FastAPI)

The backend reads cached files and serves them via REST endpoints:

| Endpoint | Description | Data Source |
|----------|-------------|-------------|
| `GET /api/model-field` | Ocean model grid data | `model_subset.nc` |
| `GET /api/observations/argo` | Argo float profiles | `argo_subset.json` |
| `GET /api/observations/glider` | Glider track data | `glider_subset.json` |
| `GET /api/comparison` | Model vs observation | Both |
| `GET /api/anomalies` | Anomaly detection | Model + observations |

---

## Step 8: Frontend Consumption

The frontend:
1. Calls REST API endpoints
2. Receives normalized JSON responses
3. Maps data to 3D visualization layers
4. Renders interactive ocean surface, Argo markers, Glider tracks
5. Supports comparison and anomaly panels

---

## Step 9: 3D Visualization

```
Normalized API Response
        ↓
Parse JSON
        ↓
Create 3D geometry (latitude, longitude, depth)
        ↓
Apply color mapping (temperature/salinity colormap)
        ↓
Render in browser (Three.js / React Three Fiber)
        ↓
User interaction (rotate, zoom, click)
```

---

## Step 10: Model vs Observation Comparison

```
User selects Argo point on 3D view
        ↓
Backend finds nearest model grid cell
        ↓
Returns:
  - Model value at that location
  - Observed value from Argo
  - Difference (deviation)
        ↓
Frontend displays comparison panel
```

---

## Step 11: Anomaly Analysis

```
Load model field for selected time
        ↓
Compute baseline (historical mean or climatology)
        ↓
Calculate deviation from baseline
        ↓
Apply threshold filter
        ↓
Return anomalous regions
        ↓
Frontend highlights anomalies on 3D view
```

---

## Key Design Decisions

1. **xarray for NetCDF processing** — Provides labeled dimensions and integrates with NumPy
2. **Cached subsets** — Prototype does not depend on live internet access
3. **No data fabrication** — All measurements come from real scientific sources
4. **Small subsets** — Fast loading, low memory, reliable demo
5. **Null for missing variables** — When a source doesn't provide a variable, use null
