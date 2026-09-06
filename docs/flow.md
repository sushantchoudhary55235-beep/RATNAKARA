# Application Flow

## High-Level Flow

```
User Interaction
       │
       ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Frontend    │────▶│   Backend    │────▶│  Data Sources│
│  (React)     │◀────│   (FastAPI)  │◀────│  (NetCDF/JSON)│
└──────────────┘     └──────────────┘     └──────────────┘
```

---

## Data Flow Diagram

### 1. Initialization Flow

```
[App Mount]
    │
    ├──▶ Load default parameters
    │    (variable: temperature, depth: 0m, time: latest)
    │
    ├──▶ GET /api/model-field?variable=temperature&depth=0&time=latest
    │    │
    │    └──▶ Backend processes NetCDF file → returns grid data
    │
    ├──▶ GET /api/observations/argo?region=arabian_sea
    │    │
    │    └──▶ Backend loads Argo profiles → returns float positions
    │
    └──▶ Render 3D Ocean Globe with Argo markers
```

### 2. Variable Change Flow

```
[User selects different variable, e.g., "salinity"]
    │
    ├──▶ Update UI state (variable selector)
    │
    ├──▶ GET /api/model-field?variable=salinity&depth=0&time=...
    │    │
    │    └──▶ Backend: xarray reads salinity slice from NetCDF
    │         Returns new grid values with salinity color scheme
    │
    └──▶ Update 3D visualization with new color map
```

### 3. Depth Change Flow

```
[User drags depth slider to 100m]
    │
    ├──▶ Update UI state (depth = 100m)
    │
    ├──▶ GET /api/model-field?variable=temperature&depth=100&time=...
    │    │
    │    └──▶ Backend: xarray selects depth=100 level
    │         Returns subsurface field data
    │
    └──▶ Update 3D visualization layer at new depth
```

### 4. Argo Profile Inspection Flow

```
[User clicks on Argo float marker]
    │
    ├──▶ GET /api/observations/argo/profile?id=ARGO_001
    │    │
    │    └──▶ Backend: fetches full vertical profile
    │         Returns depths[], temperature[], salinity[]
    │
    ├──▶ Open ProfilePanel (side panel)
    │    │
    │    └──▶ Render vertical profile plot
    │         (depth on Y-axis, temperature/salinity on X-axis)
    │
    └──▶ Highlight selected marker on 3D globe
```

### 5. Model vs Observation Comparison Flow

```
[User opens Comparison Panel]
    │
    ├──▶ GET /api/comparison?lat=15.5&lon=65.3&variable=temperature
    │    │
    │    ├──▶ Backend: fetch model value at lat/lon
    │    ├──▶ Backend: find nearest Argo observation
    │    └──▶ Backend: calculate difference
    │
    └──▶ Render ComparisonPanel
         (model value vs observation value with deviation plot)
```

### 6. Anomaly Detection Flow

```
[User clicks "Detect Anomalies"]
    │
    ├──▶ GET /api/anomalies?variable=temperature&threshold=2.0&date=...
    │    │
    │    ├──▶ Backend: load reference climatology
    │    ├──▶ Backend: compute deviation from mean
    │    └──▶ Backend: filter anomalies above threshold
    │
    └──▶ Render AnomalyPanel
         (map overlay highlighting anomalous regions)
```

---

## State Management

```
┌─────────────────────────────────────────┐
│              App State                   │
├─────────────────────────────────────────┤
│  selectedVariable: string                │
│  selectedDepth: number                   │
│  selectedTime: Date                      │
│  modelFieldData: OceanField | null       │
│  argoProfiles: ArgoProfile[]             │
│  gliderTrack: GliderTrack | null         │
│  selectedArgoId: string | null           │
│  isPlaying: boolean                      │
│  comparisonVisible: boolean              │
│  anomalyVisible: boolean                 │
└─────────────────────────────────────────┘
```

---

## API Request/Response Sequence

```
Frontend                     Backend                     Data
   │                            │                          │
   │── GET /api/model-field ───▶│                          │
   │                            │── Read NetCDF ──────────▶│
   │                            │◀── raw data ─────────────│
   │                            │── Process (xarray)       │
   │◀── JSON response ─────────│                          │
   │                            │                          │
   │── GET /api/observations ──▶│                          │
   │                            │── Read Argo JSON ───────▶│
   │◀── JSON response ─────────│                          │
   │                            │                          │
   │── GET /api/anomalies ────▶│                          │
   │                            │── Compute anomalies      │
   │◀── JSON response ─────────│                          │
```

---

## Error Handling Flow

```
[API Request Fails]
    │
    ├──▶ Frontend catches error
    │
    ├──▶ Display user-friendly error message
    │    (e.g., "Unable to load ocean data. Please try again.")
    │
    ├──▶ Log error to console for debugging
    │
    └──▶ Retry button or fallback to cached data
```

---

## Time Animation Flow

```
[User presses Play]
    │
    ├──▶ Set isPlaying = true
    │
    ├──▶ Loop:
    │    ├── Increment time step
    │    ├── GET /api/model-field?time=newTime
    │    ├── Update visualization
    │    └── Wait (e.g., 500ms)
    │
    ├──▶ [User presses Pause]
    │    └── Set isPlaying = false
    │
    └──▶ [Time range reached end]
         └── Loop back to start or stop
```
