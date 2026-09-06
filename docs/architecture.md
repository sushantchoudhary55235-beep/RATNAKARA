# Architecture Overview

## System Architecture

The Ocean 3D Platform follows a **client-server architecture** with a clear separation between the frontend visualization layer and the backend data processing layer.

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                             │
│   (React + Three.js / WebGL 3D Visualization)               │
│                                                             │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│   │   Controls   │  │Visualization │  │    Panels    │     │
│   │  Depth/Time  │  │  3D Ocean    │  │  Comparison  │     │
│   │  Variable    │  │  Argo/Glider │  │  Anomaly     │     │
│   └──────────────┘  └──────────────┘  └──────────────┘     │
│                          │                                  │
│                    services/ (API calls)                     │
└──────────────────────────┼──────────────────────────────────┘
                           │ HTTP / REST
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                        Backend                              │
│                    (FastAPI / Python)                        │
│                                                             │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│   │ model_   │  │obsrve-   │  │compari-  │  │anomaly   │   │
│   │ field    │  │ations    │  │son       │  │detection │   │
│   └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
│        │             │             │             │          │
│   ┌────▼─────────────▼─────────────▼─────────────▼─────┐    │
│   │              Services (Business Logic)              │    │
│   └────────────────────┬───────────────────────────────┘    │
│                        │                                    │
│   ┌────────────────────▼───────────────────────────────┐    │
│   │         Processing (NetCDF / xarray / pandas)      │    │
│   └────────────────────┬───────────────────────────────┘    │
│                        │                                    │
│   ┌────────────────────▼───────────────────────────────┐    │
│   │              Schemas (Pydantic Models)              │    │
│   └────────────────────────────────────────────────────┘    │
└──────────────────────────┼──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                        Data Layer                           │
│                                                             │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│   │ INCOIS   │  │Copernicus│  │   Argo   │  │  Glider  │   │
│   │ Models   │  │  CMEMS   │  │  Program │  │  Deploy  │   │
│   └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Key Design Decisions

### 1. RESTful API over GraphQL
The backend exposes REST endpoints because the data access patterns are straightforward and well-defined. REST keeps the API simple and easy to document via OpenAPI.

### 2. Pydantic for API Contracts
Response schemas are defined using Pydantic models, ensuring type safety and automatic validation at the API boundary.

### 3. xarray for NetCDF Processing
xarray is used for reading and processing NetCDF files because it provides labeled dimensions and integrates well with NumPy, making geospatial data manipulation straightforward.

### 4. Stateless Backend
The backend is stateless and can be scaled horizontally. All data is fetched or processed per-request from data sources.

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React, Three.js | UI and 3D visualization |
| API | FastAPI | REST API server |
| Processing | xarray, NumPy, pandas | NetCDF and numerical computation |
| Data | NetCDF4 | Ocean model and observation data |
| Containerization | Docker, docker-compose | Deployment and development environments |
