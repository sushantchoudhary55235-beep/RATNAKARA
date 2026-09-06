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
