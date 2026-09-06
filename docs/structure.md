# Project Structure

```
ocean-3d-platform/
│
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
├── backend/                   ← YOU
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
│       ├── arabian_sea_demo.nc
│       ├── argo_demo_profiles.json
│       └── glider_demo_track.json
│
├── docs/
│   ├── API_CONTRACT.md        ← frontend ↔ backend agreement
│   └── DATA_SOURCES.md        ← INCOIS/Copernicus/Argo sources
│
├── .gitignore
├── README.md
└── docker-compose.yml
```
