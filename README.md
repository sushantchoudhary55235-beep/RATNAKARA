# Ocean 3D Platform

An interactive 3D visualization platform for ocean data, integrating model outputs with real-time observations from Argo floats and Gliders. Focused on the Arabian Sea and Indian Ocean region.

## Project Structure

```
ocean-3d-platform/
├── frontend/                  ← Teammates 1 + 2
│   └── src/
│       ├── components/
│       │   ├── controls/      ← depth, variable, time controls
│       │   ├── visualization/← 3D ocean, Argo, Glider
│       │   └── panels/        ← comparison, profile, anomaly panels
│       ├── pages/             ← Dashboard / Explorer
│       ├── services/          ← calls your FastAPI
│       └── App.tsx
│
├── backend/                   ← Backend (FastAPI)
│   ├── app/
│   │   ├── main.py            ← FastAPI entry point
│   │   ├── api/
│   │   │   ├── model_field.py ← ocean model data
│   │   │   ├── observations.py← Argo/Glider
│   │   │   ├── comparison.py  ← Model vs Observation
│   │   │   └── anomalies.py   ← anomaly detection
│   │   ├── services/          ← business logic
│   │   ├── processing/        ← NetCDF/data processing
│   │   └── schemas/           ← API response structures
│   └── requirements.txt
│
├── data/
│   └── sample/                ← small demo dataset
│
├── docs/
│   ├── API_CONTRACT.md
│   └── DATA_SOURCES.md
│
├── .gitignore
├── README.md
└── docker-compose.yml
```

## Getting Started

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm start
```

## Data Sources

See [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md) for information on data providers.

## API Documentation

See [docs/API_CONTRACT.md](docs/API_CONTRACT.md) for the full API contract.

## Project Status

- **Backend:** FastAPI with `/health`, `GET /api/v1/metadata`, `GET /api/v1/model-field` (CMEMS model), and `GET /api/v1/observations` (real, QC-filtered INCOIS Argo observations with adjusted-variable preference, geographic/depth/time/radius filters, 5000-observation cap and deterministic downsampling). If `data/sample/arabian_sea_argo.nc` is absent the observations endpoint returns clearly-marked demo data (`mode: "demo"`). Comparison (`GET /api/v1/comparison` — Phase 5 COMPLETE) compares the model value against the nearest valid Argo observation using deterministic Haversine/depth/time nearest-neighbour matching; `u_current`/`v_current` comparisons are correctly rejected (no real Argo current observations exist). Anomaly detection (`GET /api/v1/anomalies` — Phase 6 COMPLETE) returns prototype analytical indicators by comparing observed Argo values against expected model values, with configurable prototype thresholds (temperature 2.0 °C, salinity 0.5 PSU), NORMAL/WARNING statuses, Haversine/depth/time filters and a 500-result hard cap — explicitly NOT an official INCOIS warning system.
- **Frontend:** Scaffold only — `package.json` is currently missing, so the frontend cannot be built or run yet. Haseen handles the frontend separately.
- **Testing:** 124 pytest tests covering health, metadata, the full observations API, the Model-vs-Reality comparison API and the Smart Ocean Anomaly Detection API (synthetic xarray fixtures + real-dataset smoke tests). Run with `cd backend && python -m pytest tests/ -v`.
- **Docker:** Optional — `docker-compose.yml` is provided for reference, but the referenced Dockerfiles are not yet created and Docker is **not required** for local development.
- **Datasets:** Real CMEMS model and INCOIS Argo subsets are present in `data/sample/`. `data/sample/arabian_sea_glider.csv` is a **candidate, unverified** glider/underwater-platform dataset — see [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md) §C. The model file contains a **single timestep**; time-series animation requires additional temporal model data.
