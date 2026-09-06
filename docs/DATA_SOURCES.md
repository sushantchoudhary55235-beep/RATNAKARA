# Data Sources & Provenance

> **Data provenance:** All measurements displayed by the prototype originate from the referenced scientific datasets. Local files are cached subsets prepared specifically for demonstration purposes. No synthetic or fabricated data is used.

---

## A. Copernicus Marine Service (CMEMS)

### Source
- **Provider:** Copernicus Marine Environment Monitoring Service
- **Website:** https://marine.copernicus.eu
- **Product:** Global Ocean Physics Analysis and Forecast

### Dataset Details
- **Dataset name/ID:** To be determined based on available CMEMS products (e.g., `GLOBAL_MULTIYEAR_PHY_001_030`)
- **Variables used:**
  - `thetao` — Sea water potential temperature (K)
  - `so` — Sea water salinity (PSU)
  - `uo` — Eastward sea water velocity (m/s)
  - `vo` — Northward sea water velocity (m/s)
- **Spatial region:** Arabian Sea / Indian Ocean
  - Latitude: 5°N – 25°N
  - Longitude: 55°E – 80°E
- **Depth range:** 0 – 500 meters
- **Time period:** Recent available window (small subset for prototype)
- **File format:** NetCDF-4 (.nc)

### Download / Subsetting Method
1. Register at https://marine.copernicus.eu
2. Use the Copernicus Marine Toolbox or OPeNDAP to subset
3. Download only the Arabian Sea region, required variables, and limited time window
4. Save as `data/sample/model_subset.nc`

### Processing Performed
- Spatial subsetting to Arabian Sea bounding box
- Depth subsetting to 0–500m
- Variable selection (temperature, salinity, u_current, v_current)
- No modification of scientific measurements

---

## B. Argo Program

### Source
- **Provider:** Argo Program / International Argo
- **Website:** https://argo.ucsd.edu
- **Data access:** https://argovis.api.io or GDAC FTP

### Dataset Details
- **Dataset/product name:** Argo Profile Data
- **Variables used:**
  - Float ID (`float_id`)
  - Latitude / Longitude
  - Time (ISO 8601)
  - Pressure (dbar) / Depth (m)
  - Temperature (°C)
  - Salinity (PSU)
- **Spatial region:** Arabian Sea / Indian Ocean (5°N – 25°N, 55°E – 80°E)
- **Time period:** Recent available window
- **File format:** JSON (from Argo API) or NetCDF (from GDAC)

### Download Method
1. Use the Argo API: `https://argovis-api.io/argo?polygon=[[lon,lat]...]`
2. Or download from GDAC: `https://data.nodc.noaa.gov/argo/`
3. Filter to the Arabian Sea region
4. Save as `data/sample/argo_subset.json`

### Processing Performed
- Spatial filtering to Arabian Sea bounding box
- Format normalization to JSON schema
- Validation of coordinates, depth, and timestamps
- No modification of scientific measurements

---

## C. Glider Data

### Source
- **Provider:** IOOS (Integrated Ocean Observing System) or regional glider deployments
- **Website:** https://gliders.ioos.us
- **Alternative:** BODC Glider Data Archive

### Dataset Details
- **Dataset/product name:** To be determined based on available glider deployments
- **Variables used:**
  - Glider ID (`glider_id`)
  - Latitude / Longitude
  - Time (ISO 8601)
  - Depth (m)
  - Temperature (°C)
  - Salinity (PSU)
  - Trajectory information (series of waypoints)
- **Spatial region:** Indian Ocean / Arabian Sea (if available)
- **Time period:** Recent available window
- **File format:** JSON

### Download Method
1. Check IOOS glider database for Indian Ocean deployments
2. If available: download and subset to the target region
3. Save as `data/sample/glider_subset.json`

### Processing Performed
- Spatial filtering to target region
- Format normalization to JSON schema
- Validation of coordinates, depth, and timestamps
- No modification of scientific measurements

### Fallback
If an appropriate Glider dataset cannot be obtained:
- The Glider integration structure remains ready
- The backend/frontend operates with Glider data disabled
- The core prototype still works using Copernicus Model + Argo Observation
- **Do NOT create fake Glider data as a replacement**

---

## Prototype Data Size

The prototype uses **small regional subsets**, NOT complete global datasets:

| Dataset | Scope |
|---------|-------|
| Copernicus | Small regional subset (Arabian Sea), limited time window, limited depth |
| Argo | Small regional subset (Arabian Sea), limited time window |
| Glider | Small regional subset if available, otherwise disabled |

**Purpose:**
- Fast loading
- Reliable demo
- Low memory usage
- Browser visualization
- Model-observation comparison

---

## Data Quality

The prototype performs basic validation:

- **Missing values:** Detected and handled with null
- **Invalid coordinates:** Latitude must be -90 to 90, Longitude -180 to 180
- **Invalid depth:** Must be non-negative
- **Invalid timestamps:** Must be valid ISO 8601 format
- **Duplicate observations:** Detected where applicable
- **Unit consistency:** Verified against source dataset metadata
- **Variable availability:** Checked before processing

Scientific measurements are never modified without documenting the transformation.

---

## Normalized Data Schema

Internal representation after processing:

```json
{
  "latitude": 18.5,
  "longitude": 72.8,
  "depth": 50,
  "time": "2026-09-01T00:00:00",
  "temperature": 27.4,
  "salinity": 35.1,
  "u_current": 0.12,
  "v_current": -0.08,
  "source": "Copernicus Marine"
}
```

Use `null` when a source does not provide a particular variable.

---

## Important Notes

- All measurements come from real scientific datasets
- No synthetic or fabricated data is used
- Anomaly thresholds in the prototype are **not** official INCOIS warnings
- Prototype anomaly indicators are analytical tools, not official advisories
