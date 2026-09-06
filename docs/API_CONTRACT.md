# API Contract

This document defines the agreed-upon API contract between the frontend and backend.

## Endpoints

### Health Check
- **GET** `/health`
- **Response:** `{"status": "ok"}`

---

### Model Field Data
- **GET** `/api/model-field`
- **Description:** Retrieve ocean model field data (temperature, salinity, etc.)
- **Query Parameters:**
  - `variable` (string): Variable name (e.g., "temperature", "salinity")
  - `depth` (float): Depth level in meters
  - `lat_min`, `lat_max` (float): Latitude bounds
  - `lon_min`, `lon_max` (float): Longitude bounds
  - `time` (string): ISO 8601 timestamp

### Observations (Argo/Glider)
- **GET** `/api/observations/argo`
- **GET** `/api/observations/glider`
- **Description:** Retrieve Argo float or Glider observation data

### Comparison
- **GET** `/api/comparison`
- **Description:** Compare model data vs observation data

### Anomalies
- **GET** `/api/anomalies`
- **Description:** Detect and return ocean anomalies

---

## Response Formats

All responses follow a consistent JSON structure:

```json
{
  "status": "success",
  "data": {},
  "metadata": {}
}
```
