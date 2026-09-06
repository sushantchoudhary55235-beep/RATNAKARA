# Sample Data Directory

This directory contains **cached real-data subsets** for the SAGARA prototype.

> **Phase 1 verification (2026-09-06):** Contents below reflect the files actually present, after direct inspection. Original scientific datasets are **not modified**.

## Files Present

### arabian_sea_model.nc (NetCDF-4, ~235 MB)

**Source:** Copernicus Marine Service (CMEMS), GLORYS12V1 — product `GLOBAL_MULTIYEAR_PHY_001_030`, daily means, ~1/12°.

**Verified contents:**
- Variables: `thetao` (temperature, **already °C**), `so` (salinity, PSU), `uo` (eastward velocity, m/s), `vo` (northward velocity, m/s), plus surface variables `zos`, `mlotst`, `bottomT`. Sea-ice variables are 100% NaN in this region.
- Latitude: -30° to 25°N
- Longitude: 45°E to ~100°E
- Depth: 0.49 – 541 m (32 levels)
- Time: **single timestep 2026-06-23** (no time-series animation with this file alone)

### arabian_sea_argo.nc (NetCDF-4, ~455 MB)

**Source:** INCOIS ERDDAP `Indian_ARGO_Floats` (Arabian Sea box: 5–25°N, 55–80°E).

**Verified contents:**
- Flat table: 4,030,873 rows × 23 columns, one row per pressure measurement
- Time: 2003-06-03 → 2025-04-01
- Columns include `PLATFORM_NUMBER`, `CYCLE_NUMBER`, `time`, `latitude`, `longitude`, `PRES`, `TEMP`, `PSAL` plus standard Argo QC flags (`*_QC`, `*_ADJUSTED_QC`)
- Raw values contain implausible readings (TEMP > 60 °C, PSAL > 70 PSU, negative PRES) — **must be QC-filtered before serving** (use the file's own QC flags)
- 152 distinct floats; types APEX / ARVOR / PROVOR / PROVOR_III / PROVOR_MT

### arabian_sea_glider.csv (CSV, ~250 MB)

> **⚠️ NOT CONFIRMED AS GLIDER DATA.** Do not treat as verified glider data. Refer to it as **"underwater-platform observation data"** or **"candidate glider/underwater-platform observation dataset"** until its source is scientifically verified.

**Verified contents:**
- Same 23-column INCOIS Argo schema as `arabian_sea_argo.nc`, with a units header row (row 2) that must be skipped when parsing
- Platform types are Argo float types (APEX / ARVOR / PROVOR ...); 109 platforms, none overlapping `arabian_sea_argo.nc`
- Time: 2003-06-03 → 2025-03-31; 10–24.7°N, 60–74.5°E; 0–500 dbar only
- **Not a required dependency for the MVP** — kept available for future investigation

## Important

- **Do NOT place fake/synthetic data files here.**
- All measurements displayed by the prototype must originate from real scientific datasets.
- Local files are cached subsets prepared specifically for demonstration purposes.
- The candidate glider file is **not** presented as confirmed glider data.