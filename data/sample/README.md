# Sample Data Directory

This directory contains **cached real-data subsets** for the SAGARA prototype.

## Expected Files

### model_subset.nc

**Source:** Copernicus Marine Service (CMEMS)

**Purpose:** Ocean numerical model data for the Arabian Sea / Indian Ocean region.

**Expected variables:**
- Temperature (K or °C)
- Salinity (PSU)
- Eastward current / U (m/s)
- Northward current / V (m/s)

**Expected metadata:**
- Latitude: 5°N – 25°N
- Longitude: 55°E – 80°E
- Depth: 0 – 500 meters
- Time: Recent available window

**Format:** NetCDF-4

**Status:** ⚠️ Not yet downloaded. See [../../docs/DATA_SOURCES.md](../../docs/DATA_SOURCES.md) for download instructions.

---

### argo_subset.json

**Source:** Argo Program (https://argo.ucsd.edu)

**Purpose:** Real in-situ ocean observations from Argo profiling floats in the Arabian Sea region.

**Expected fields:**
- Float ID
- Latitude / Longitude
- Time (ISO 8601)
- Pressure / Depth
- Temperature (°C)
- Salinity (PSU)

**Format:** JSON array of profile records

**Status:** ⚠️ Not yet downloaded. See [../../docs/DATA_SOURCES.md](../../docs/DATA_SOURCES.md) for download instructions.

---

### glider_subset.json

**Source:** Glider deployments (IOOS / regional programs)

**Purpose:** Real underwater vehicle observations and trajectories in the Indian Ocean.

**Expected fields:**
- Glider ID
- Latitude / Longitude
- Time (ISO 8601)
- Depth
- Temperature (°C)
- Salinity (PSU)
- Trajectory information

**Format:** JSON array of observation records

**Status:** ⚠️ Not yet downloaded. If unavailable, the prototype will operate with Glider integration disabled.

---

## Important

- **Do NOT place fake/synthetic data files here.**
- All measurements displayed by the prototype must originate from real scientific datasets.
- Local files are cached subsets prepared specifically for demonstration purposes.
