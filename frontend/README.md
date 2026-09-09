Yep bro — you want a **README specifically for the `frontend` folder**, not the whole Ratnakara project.

Put this at:

```text
C:\Ratnakara\frontend\README.md
```

````md
# 🌊 RATNAKARA — Frontend

## Web-Based Interactive 3D Ocean Visualization

This folder contains the frontend application for **Ratnakara**, an interactive 3D ocean visualization platform focused on the **Indian Ocean, Arabian Sea, and Bay of Bengal**.

The frontend is responsible for rendering the interactive globe, ocean visualization layers, coastal information, animations, and user interface.

---

## 🚀 Tech Stack

- React
- Vite
- JavaScript
- Three.js
- React Three Fiber
- Drei
- WebGL
- CSS

---

## 🎯 Frontend Goals

The Ratnakara frontend is designed to:

- Visualize ocean conditions in an interactive 3D globe
- Make oceanographic data easier to understand
- Provide smooth geographic navigation
- Display ocean temperature and current patterns
- Highlight Indian coastal locations
- Provide coastal advisory information
- Prepare the interface for future real ocean datasets

---

# 📁 Project Structure

```text
frontend/
│
├── public/
│   └── Static assets and public resources
│
├── src/
│   │
│   ├── components/
│   │   ├── CoastalWarning.jsx
│   │   ├── DataLayerFilter.jsx
│   │   ├── TemperatureLegend.jsx
│   │   ├── CurrentLegend.jsx
│   │   ├── LocationLabel.jsx
│   │   ├── Pinpoint.jsx
│   │   ├── DepthSlicer.jsx
│   │   ├── SalinityLayer.jsx
│   │   ├── RiskLayer.jsx
│   │   ├── RatnakaraCurrents.jsx
│   │   └── ...
│   │
│   ├── utils/
│   │   ├── geoUtils.js
│   │   ├── landMask.js
│   │   ├── earthTexture.js
│   │   └── ...
│   │
│   ├── App.jsx
│   ├── App.css
│   ├── index.css
│   └── main.jsx
│
├── package.json
├── vite.config.js
└── README.md
````

---

# 🌍 Main Frontend Features

## 1. Interactive 3D Earth

The main interface contains an interactive 3D Earth built using:

```text
React
   ↓
React Three Fiber
   ↓
Three.js
   ↓
WebGL
```

Users can:

* Rotate the globe
* Zoom in and out
* Explore ocean regions
* Select geographic locations
* Navigate to the Arabian Sea
* Navigate to the Bay of Bengal
* Navigate to the Indian Ocean

---

# 🌊 Ocean Regions

The frontend focuses on three primary regions:

### Arabian Sea

Western Indian Ocean region surrounding the western coast of India.

### Bay of Bengal

Eastern Indian Ocean region surrounding the eastern coast of India.

### Indian Ocean

The larger ocean region surrounding the Indian subcontinent.

---

# 🌡️ Temperature Layer

The frontend supports an animated ocean temperature visualization.

The intended visualization uses a smooth gradient:

```text
MAROON → RED → YELLOW → GREEN
```

The temperature visualization:

* Appears over ocean areas
* Preserves land appearance
* Avoids coloring India and other land regions
* Uses smooth color transitions
* Supports fluid-style movement
* Can later consume real temperature datasets

---

## Future Temperature Dataset

The frontend is designed to accept temperature observations such as:

```js
{
  latitude: 15.0,
  longitude: 73.0,
  temperature: 28.4,
  timestamp: "2025-01-01T00:00:00"
}
```

Multiple observations can be provided as an array:

```js
[
  {
    latitude: 15.0,
    longitude: 73.0,
    temperature: 28.4,
    timestamp: "2025-01-01T00:00:00"
  },
  {
    latitude: 12.0,
    longitude: 80.0,
    temperature: 27.1,
    timestamp: "2025-01-01T00:00:00"
  }
]
```

The current visualization is structured so that real datasets can be connected later.

---

# 🌊 Ocean Currents

The frontend contains an animated ocean-current visualization.

Current visualization can represent:

* Ocean circulation
* Current direction
* Flow movement
* Ocean movement patterns

The existing current animation uses a particle-based visualization.

The current animation should remain independent from the temperature layer.

---

# 📍 Coastal Pinpoints

Ratnakara provides interactive coastal markers for Indian coastal locations.

Examples include:

```text
Mumbai Coast
Kochi Coast
Chennai Coast
```

The existing pinpoint animation is used to highlight selected locations on the globe.

---

# ⚠️ Coastal Advisories

The frontend contains a coastal advisory interface.

An advisory can contain information such as:

```js
{
  id: "mumbai-coast",
  name: "Mumbai Coast",
  latitude: 19.076,
  longitude: 72.8777,
  type: "high_wave",
  severity: "high",
  title: "Elevated Wave Conditions",
  message: "Coastal conditions require attention.",
  waveHeight: 2.2,
  currentSpeed: 1.4,
  temperature: 29.1,
  validUntil: "2025-01-02T05:30:00"
}
```

This structure is intended to provide an integration point for future real coastal datasets.

---

# 🎛️ Layer Controls

The frontend supports multiple ocean visualization layers.

Typical layers include:

```text
Temperature
Salinity
Currents
Coastal Lines
```

Layer visibility is controlled independently.

The intended interaction is:

```text
First click
    ↓
Activate layer / animation

Second click
    ↓
Deactivate layer / animation
```

This prevents an active animation from becoming stuck when the user wants to unselect it.

---

# 🗺️ Land Protection

Ocean visualizations must not overwrite the Earth land surface.

The frontend uses geographic masking to distinguish ocean regions from land.

The goal is:

```text
Ocean
  ↓
Temperature / Current Visualization

Land
  ↓
Original Earth Texture
```

For example, the temperature layer must not paint over:

* India
* Sri Lanka
* Arabian Peninsula
* Africa
* Southeast Asia
* Australia
* Other visible land areas

---

# 🎨 User Interface

The frontend provides:

* Ratnakara branding
* Ocean navigation buttons
* Layer panel
* Ocean variables
* Coastal advisory section
* Depth controls
* Warning information
* Geographic location labels
* Temperature legend
* Current legend

The main UI is intentionally designed to remain simple so users can understand the visualization without needing specialist oceanographic knowledge.

---

# 🖥️ Running the Frontend

## Install Dependencies

Open PowerShell:

```powershell
cd C:\Ratnakara\frontend
```

Install dependencies:

```powershell
npm install
```

---

## Start Development Server

```powershell
npm run dev
```

Vite will provide a local URL similar to:

```text
http://localhost:5173
```

Open the URL in your browser.

---

# 🏗️ Production Build

Before committing changes, test the frontend build:

```powershell
cd C:\Ratnakara\frontend
npm run build
```

A successful build should finish without compilation errors.

---

# 🔌 Backend Integration

The frontend is designed to eventually communicate with the Ratnakara FastAPI backend.

Possible data flow:

```text
Ocean Dataset
      ↓
Python / xarray
      ↓
FastAPI Backend
      ↓
REST API
      ↓
React Frontend
      ↓
Three.js / WebGL
      ↓
3D Ocean Visualization
```

Potential future data includes:

* Ocean temperature
* Salinity
* Currents
* Argo observations
* CMEMS model data
* Ocean anomalies
* Coastal warnings
* Satellite observations

---

# 📊 Planned Data Interfaces

## Temperature

```js
{
  latitude,
  longitude,
  temperature,
  timestamp
}
```

## Currents

```js
{
  latitude,
  longitude,
  u,
  v,
  speed,
  direction,
  timestamp
}
```

## Coastal Warning

```js
{
  id,
  name,
  latitude,
  longitude,
  type,
  severity,
  title,
  message,
  waveHeight,
  currentSpeed,
  temperature,
  validUntil,
  satelliteImage,
  satelliteSource,
  capturedAt
}
```

These structures allow the visualization layer to be connected to real datasets later without redesigning the frontend.

---

# 🧩 Development Rules

When modifying the frontend:

### Preserve Existing Components

Do not unnecessarily replace working components.

### Make Targeted Changes

Prefer modifying only the files required for a feature.

### Preserve Existing Animations

Existing:

* Globe animation
* Pinpoint animation
* Current animation
* Camera animation
* Atmosphere effects

should not be rewritten when implementing unrelated features.

### Preserve the Main UI

New visualization features should integrate with the existing interface rather than replacing the main design.

### Keep Backend Separate

Frontend visualization changes should not modify backend code unless backend integration is specifically required.

---

# 🧪 Testing Checklist

Before considering a frontend change complete:

```text
[ ] npm run build succeeds
[ ] Globe loads correctly
[ ] Globe can rotate
[ ] Globe can zoom
[ ] Camera navigation works
[ ] Arabian Sea navigation works
[ ] Bay of Bengal navigation works
[ ] Indian Ocean navigation works
[ ] Existing pinpoint animation works
[ ] Current animation works
[ ] Temperature layer works
[ ] Temperature does not cover land
[ ] Coastal advisories work
[ ] Layer selection can be activated
[ ] Layer selection can be deactivated
[ ] Left panel remains inside viewport
[ ] No unwanted page scrolling
[ ] Existing UI remains unchanged
```

---

# 🛣️ Frontend Roadmap

## Current

* [x] React/Vite frontend
* [x] 3D globe
* [x] Three.js rendering
* [x] React Three Fiber
* [x] Globe navigation
* [x] Ocean regions
* [x] Ocean currents
* [x] Coastal pinpoints
* [x] Coastal advisory interface
* [x] Temperature visualization

## Next

* [ ] Connect real temperature datasets
* [ ] Connect real current datasets
* [ ] Connect Argo observations
* [ ] Connect CMEMS model data
* [ ] Add time-series controls
* [ ] Add depth-based visualization
* [ ] Improve data-driven ocean fields
* [ ] Add forecast/model comparison

## Future

* [ ] Forecast Truth Engine
* [ ] Ocean anomaly visualization
* [ ] Decision Co-Pilot
* [ ] Coastal risk recommendations
* [ ] Real-time ocean observations
* [ ] Satellite data integration
* [ ] Multi-language interface
* [ ] Accessibility improvements

---

# 🌊 Ratnakara Frontend Vision

The frontend aims to turn complex oceanographic datasets into an intuitive visual experience.

```text
DATA
  ↓
OCEAN SCIENCE
  ↓
3D VISUALIZATION
  ↓
INTERACTIVE EXPLORATION
  ↓
COASTAL INTELLIGENCE
```

Ratnakara focuses on making ocean information understandable, visual, and useful for users exploring the Indian Ocean region.

---

## 👨‍💻 Project

**Ratnakara**

Web-Based Interactive 3D Visualization Platform for Ocean Models

Technology:

```text
React + Vite
Three.js
React Three Fiber
WebGL
JavaScript
CSS
```

```

This one is specifically for **`frontend/README.md`** and doesn't mix in the backend setup.
```
