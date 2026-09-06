# Design Document

## Overview

This document describes the design approach for the Ocean 3D Platform, covering UI/UX principles, data models, and component design.

---

## UI/UX Design Principles

### 1. Minimalist Dashboard
- Clean, uncluttered interface with focus on the 3D ocean visualization
- Collapsible panels and controls to maximize viewport space
- Dark theme optimized for scientific visualization

### 2. Responsive Controls
- Depth slider with real-time preview updates
- Time selector with playback controls (play, pause, step forward/backward)
- Variable dropdown for switching between temperature, salinity, currents, etc.

### 3. Progressive Disclosure
- Default view shows high-level ocean state
- Click on regions or data points to drill down into detailed profiles
- Panels expand on demand for comparison and anomaly analysis

---

## Component Design

### Controls

| Component | Props | Description |
|-----------|-------|-------------|
| `DepthSlider` | `min`, `max`, `value`, `onChange` | Depth level selector (0–2000m) |
| `TimeControl` | `range`, `current`, `onSelect` | Temporal navigation |
| `VariableSelector` | `options`, `selected`, `onSelect` | Ocean variable picker |

### Visualization

| Component | Props | Description |
|-----------|-------|-------------|
| `OceanGlobe` | `data`, `variable`, `depth` | 3D globe with ocean field overlay |
| `ArgoMarkers` | `profiles`, `selected` | Argo float positions and profiles |
| `GliderTrack` | `track`, `selected` | Glider transect visualization |

### Panels

| Component | Props | Description |
|-----------|-------|-------------|
| `ComparisonPanel` | `modelData`, `obsData` | Side-by-side model vs observation |
| `ProfilePanel` | `profileData` | Vertical profile plot |
| `AnomalyPanel` | `anomalyData` | Anomaly detection results |

---

## Data Models

### Ocean Field
```json
{
  "variable": "temperature",
  "unit": "°C",
  "depth": 100.0,
  "lat_range": [10.0, 25.0],
  "lon_range": [55.0, 75.0],
  "grid": {
    "lats": [],
    "lons": [],
    "values": [[]]
  },
  "timestamp": "2026-01-15T00:00:00Z"
}
```

### Argo Profile
```json
{
  "float_id": "ARGO_001",
  "lat": 15.5,
  "lon": 65.3,
  "timestamp": "2026-01-15T12:00:00Z",
  "depths": [0, 10, 20, 50, 100, 200],
  "temperature": [28.5, 28.3, 27.1, 22.4, 16.8, 12.1],
  "salinity": [35.2, 35.3, 35.4, 35.6, 35.7, 35.8]
}
```

### Glider Track
```json
{
  "glider_id": "GLIDER_001",
  "start_time": "2026-01-10T00:00:00Z",
  "end_time": "2026-01-20T00:00:00Z",
  "waypoints": [
    {"lat": 12.0, "lon": 60.0, "depth": 50.0, "time": "2026-01-10T00:00:00Z"},
    {"lat": 14.0, "lon": 62.0, "depth": 50.0, "time": "2026-01-12T00:00:00Z"}
  ]
}
```

### Anomaly Detection
```json
{
  "type": "temperature",
  "threshold": 2.0,
  "anomalies": [
    {
      "lat": 16.5,
      "lon": 68.2,
      "depth": 50.0,
      "deviation": 3.5,
      "timestamp": "2026-01-15T00:00:00Z"
    }
  ]
}
```

---

## Color Schemes

### Temperature (°C)
| Range | Color |
|-------|-------|
| < 10 | Deep Blue (#0000FF) |
| 10–18 | Cyan (#00BFFF) |
| 18–25 | Green (#00FF00) |
| 25–28 | Yellow (#FFFF00) |
| > 28 | Red (#FF0000) |

### Salinity (PSU)
| Range | Color |
|-------|-------|
| < 34.5 | Purple (#800080) |
| 34.5–35.5 | Blue (#4169E1) |
| 35.5–36.0 | Green (#00CC00) |
| > 36.0 | Orange (#FF8C00) |

---

## Interaction Design

### Mouse Interactions
- **Hover** on ocean surface → show variable value at cursor
- **Click** on Argo marker → open ProfilePanel with vertical profile
- **Click+Drag** on globe → rotate view
- **Scroll** → zoom in/out

### Keyboard Shortcuts
- `Space` → play/pause time animation
- `Arrow Keys` → step through time
- `D` → toggle depth controls
- `C` → open/close comparison panel
