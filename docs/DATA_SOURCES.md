# Data Sources & Provenance

> **Data provenance:** All measurements displayed by the prototype originate from the referenced scientific datasets. Local files are cached subsets prepared specifically for demonstration purposes. No synthetic or fabricated data is used.
>
> **Phase 1 verification (2026-09-06):** All statements below were verified by direct inspection of the local sample files (`data/sample/`). Where the documentation previously disagreed with the actual files, this document now reflects the files as they actually are.

---

## Local Sample Files (actual)

| File | Actual content | Format | Size |
|------|----------------|--------|------|
| `data/sample/arabian_sea_model.nc` | CMEMS ocean model field | NetCDF-4 | ~235 MB |
| `data/sample/arabian_sea_argo.nc` | INCOIS Argo float observations | NetCDF-4 (flat table) | ~455 MB |
| `data/sample/arabian_sea_glider.csv` | **Candidate** underwater-platform observations — see [Glider section](#c-underwater-platform-observations-candidate-glider) | CSV | ~250 MB |

---

## A. Copernicus Marine Service (CMEMS) — Model

### Source
- **Provider:** Copernicus Marine Environment Monitoring Service
- **Website:** https://marine.copernicus.eu
- **Product:** Global Ocean Physics Reanalysis — GLORYS12V1
- **Dataset ID (from file metadata):** `GLOBAL_MULTIYEAR_PHY_001_030` / `cmems_mod_glo_phy_my_0.083deg_P1D-m_202311`
- **Resolution:** ~1/12° (0.0833°) daily means

### Verified file contents (`arabian_sea_model.nc`)
- **Dimensions:** `time (1)`, `depth (32)`, `latitude (661)`, `longitude (660)`
- **Time coverage:** **Single timestep: 2026-06-23** — see [Limitations](#limitations)
- **Latitude:** -30.00° to 25.00°N *(not 5–25°N)*
- **Longitude:** 45.00° to 99.92°E *(not 55–80°E)*
- **Depth:** 0.49 m to 541 m, 32 non-uniform levels (approximate 0–500 m coverage)

### Variables and units (verified)

| Source variable | Meaning | Units (as stored) | Normalized name |
|----------------|---------|-------------------|-----------------|
| `thetao` | Sea water potential temperature | **degrees_C (already Celsius)** | `temperature` |
| `so` | Sea water salinity | `1e-3` (CMEMS notation; values are PSU) | `salinity` |
| `uo` | Eastward sea water velocity | m s⁻¹ | `u_current` |
| `vo` | Northward sea water velocity | m s⁻¹ | `v_current` |

Additional 3-D variables present: `zos` (sea surface height, m), `mlotst` (mixed-layer thickness, m), `bottomT` (sea floor temperature, °C). Sea-ice variables (`siconc`, `sithick`, `usi`, `vsi`) are **100% NaN** in this region (no sea ice) and are not used.

> **IMPORTANT — Temperature units:** `thetao` is already stored in degrees Celsius. **Do NOT apply a Kelvin → Celsius conversion.** The value range is -2.4 °C to 34.0 °C.

> **IMPORTANT — Missing values:** ~14% of grid cells are NaN (land mask) in the 4-D variables, and ~15.4% in surface variables. NaN (land) cells must be handled in processing and never presented as real measurements.

### Download / Subsetting Method (for future refresh)
1. Register at https://marine.copernicus.eu
2. Use the Copernicus Marine Toolbox or OPeNDAP to subset
3. Download the Arabian Sea / Indian Ocean region, required variables, limited time window
4. Save as `data/sample/arabian_sea_model.nc`

---

## B. Argo Program — INCOIS Argo Floats

### Source
- **Provider:** INCOIS (Indian National Centre for Ocean Information Services) ERDDAP
- **Dataset:** `Indian_ARGO_Floats` (file history records a tabledap query: lat 5–25, lon 55–80)
- **References:** https://www.incois.gov.in, https://argo.ucsd.edu

### Verified file contents (`arabian_sea_argo.nc`)
- **Structure:** Flat table, single `row` dimension, **4,030,873 rows × 23 columns** — one row per pressure measurement (not grouped into profiles).
- **Time coverage:** 2003-06-03 → 2025-04-01
- **Latitude:** 5.000° to 24.856°N
- **Longitude:** 55.001° to 79.997°E
- **Platforms:** 152 distinct floats; types APEX, ARVOR, PROVOR, PROVOR_III, PROVOR_MT
- **Direction:** ~99.9% ascending (`A`) profiles, 2,876 descending (`D`)

### Columns
`DATE_CREATION`, `DATE_UPDATE`, `PLATFORM_NUMBER` (float ID), `CYCLE_NUMBER`, `DIRECTION`, `PLATFORM_TYPE`, `time` (UTC, datetime64), `JULD_QC`, `JULD_LOCATION`, `latitude`, `longitude`, `PRES` (decibar), `PRES_QC`, `PRES_ADJUSTED` / `PRES_ADJUSTED_QC`, `TEMP` (°C), `TEMP_QC`, `TEMP_ADJUSTED` / `TEMP_ADJUSTED_QC`, `PSAL` (PSU), `PSAL_QC`, `PSAL_ADJUSTED` / `PSAL_ADJUSTED_QC`.

Profiles are reconstructed by grouping `PLATFORM_NUMBER + CYCLE_NUMBER + DIRECTION` and sorting by `PRES`.

### Argo QC considerations (verified)
- The raw dataset contains physically implausible values (e.g., TEMP up to 60.35 °C, PSAL up to 72.29 PSU and down to -0.02, PRES down to -112 dbar).
- The file carries standard Argo QC flags (`*_QC` and `*_ADJUSTED_QC`). Argo convention: `1` = good, `2` = probably good (adjusted only), `3` = probably bad, `4` = bad, `9` = missing. ~8–10% of rows are flagged `4` (bad) for TEMP/PSAL/PRES.
- **The backend must apply the dataset-provided QC flags before serving values.** Do not invent official INCOIS QC thresholds; respect the source dataset's QC metadata.
- ~0.02% of raw TEMP/PSAL/PRES values are NaN; ~28–30% of the `*_ADJUSTED` variants are missing (some floats were never adjusted).

> The original Argo file is **not modified**; QC filtering happens in the processing layer.

---

## C. Underwater-Platform Observations (Candidate Glider)

> **⚠️ NOT CONFIRMED AS GLIDER DATA.** As of Phase 1 inspection, the file `data/sample/arabian_sea_glider.csv` **cannot be called confirmed glider data**. Until its source is scientifically verified, refer to it as **"underwater-platform observation data"** or **"candidate glider/underwater-platform observation dataset"**. Do not fabricate glider provenance.

### Verified file contents (`arabian_sea_glider.csv`)
- **Structure:** 1,541,347 data rows × 23 columns, preceded by a **units header row** (row 2: `UTC, UTC, degrees_north, ...`) that must be skipped when parsing.
- **Schema:** Identical to the INCOIS Argo export above (`PLATFORM_NUMBER`, `CYCLE_NUMBER`, `DIRECTION`, `time`, `latitude`, `longitude`, `PRES`, `TEMP`, `PSAL` + QC fields).
- **Platform types present:** APEX, ARVOR, PROVOR, PROVOR_III, PROVOR_MT — **Argo float types**, not glider identifiers.
- **Time coverage:** 2003-06-03 → 2025-03-31
- **Latitude / Longitude:** 10.00–24.70°N / 60.00–74.55°E (smaller box than the Argo file)
- **Pressure:** 0–500 dbar only (depth-limited subset)
- **Platform overlap with `arabian_sea_argo.nc`:** none (0 of 109 platforms) — a disjoint subset from the same INCOIS Argo table.

### Status and handling
- The file does **not** contain glider-specific variables (no vehicle depth, water depth, heading, or continuous trajectory sampling) — its content is profile-style Argo-like data.
- **The candidate dataset is NOT a required dependency for the MVP.** It remains available for future scientific verification.
- If real, verified glider data cannot be obtained, the glider integration stays structurally ready but **disabled** — per the project rule, do **NOT** fabricate glider data as a replacement.

---

## Prototype Data Size

The prototype uses small regional subsets, NOT complete global datasets. The current local files are large (235–455 MB) and must be processed/cached by the backend before being served to the browser.

| Dataset | File | Scope |
|---------|------|-------|
| CMEMS model | `arabian_sea_model.nc` | -30–25°N, 45–100°E, 0–541 m, **one timestep** |
| Argo | `arabian_sea_argo.nc` | 5–25°N, 55–80°E, 2003–2025, full water column |
| Candidate glider | `arabian_sea_glider.csv` | 10–24.7°N, 60–74.5°E, 0–500 dbar, 2003–2025 — **unverified provenance** |

---

## Data Quality

The prototype performs basic validation:
- **Missing values:** detected and handled with `null`
- **Invalid coordinates:** latitude must be -90 to 90, longitude -180 to 180
- **Invalid pressure/depth:** negative values rejected (dataset QC respected)
- **Invalid timestamps:** must be valid ISO 8601 format
- **Duplicate observations:** detected where applicable
- **Unit consistency:** verified against source dataset metadata (e.g., `thetao` is Celsius, **no conversion applied**)
- **Variable availability:** checked before processing
- **Scientific QC:** applied using the **dataset-provided QC flags** (`*_QC`); no invented thresholds

Scientific measurements are never modified without documenting the transformation.

---

## Normalized Data Schema

Internal representation after processing:

```json
{
  "latitude": 18.5,
  "longitude": 72.8,
  "depth": 50,
  "time": "2026-06-23T00:00:00",
  "temperature": 27.4,
  "salinity": 35.1,
  "u_current": 0.12,
  "v_current": -0.08,
  "source": "CMEMS GLORYS12V1"
}
```

Use `null` when a source does not provide a particular variable.

---

## Limitations

- **Current prototype model file contains a single timestep (2026-06-23). Time-series animation requires additional temporal model data.** The backend should still expose the `time` field because the architecture must support future multi-time datasets.
- The candidate glider dataset is **not verified** as glider data; treat it as underwater-platform observations pending investigation.
- Anomaly thresholds in the prototype are **not** official INCOIS warnings — prototype anomaly indicators are analytical tools, not official advisories.