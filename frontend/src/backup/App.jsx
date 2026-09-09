import { useEffect, useRef, useState } from "react";
import Map from "@arcgis/core/Map";
import SceneView from "@arcgis/core/views/SceneView";
import Graphic from "@arcgis/core/Graphic";
import Point from "@arcgis/core/geometry/Point";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import esriConfig from "@arcgis/core/config";
import "@arcgis/core/assets/esri/themes/light/main.css";
import "./App.css";

/* ============================================================
   RATNAKARA CAMERA LOCATIONS
============================================================ */

const LOCATIONS = {
  ARABIAN_SEA: {
    name: "Arabian Sea",
    longitude: 75,
    latitude: 15,
    zoom: 5,
  },
  BAY_OF_BENGAL: {
    name: "Bay of Bengal",
    longitude: 90,
    latitude: 15,
    zoom: 5,
  },
  INDIAN_OCEAN: {
    name: "Indian Ocean",
    longitude: 78,
    latitude: -10,
    zoom: 4,
  },
};

/* ============================================================
   ARCGIS 3D GLOBE
============================================================ */

function ArcGISGlobe({ activeLocation, activeLayer, depth }) {
  const containerRef = useRef(null);
  const viewRef = useRef(null);
  const observationLayerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Optional API key. Add VITE_ARCGIS_API_KEY to .env when using
    // ArcGIS location services that require authentication.
    const apiKey = import.meta.env.VITE_ARCGIS_API_KEY;
    if (apiKey) {
      esriConfig.apiKey = apiKey;
    }

    const map = new Map({
      basemap: "satellite",
      ground: "world-elevation",
    });

    const observationLayer = new GraphicsLayer({
      title: "Ratnakara Observations",
    });

    map.add(observationLayer);
    observationLayerRef.current = observationLayer;

    const view = new SceneView({
      container: containerRef.current,
      map,
      qualityProfile: "high",
      viewingMode: "global",
      camera: {
        position: {
          longitude: 78,
          latitude: 12,
          z: 9000000,
        },
        tilt: 0,
        heading: 0,
      },
      environment: {
        atmosphereEnabled: true,
        starsEnabled: false,
      },
      ui: {
        components: ["zoom", "compass", "navigation-toggle"],
      },
    });

    viewRef.current = view;

    // Small demo observation marker. This will later be replaced
    // with real SAGARA/Argo observations from the backend.
    const demoPoint = new Point({
      longitude: 75,
      latitude: 15,
      spatialReference: { wkid: 4326 },
    });

    observationLayer.add(
      new Graphic({
        geometry: demoPoint,
        symbol: {
          type: "point-3d",
          symbolLayers: [
            {
              type: "object",
              resource: { primitive: "sphere" },
              material: { color: [8, 126, 139, 0.95] },
              width: 9000,
              height: 9000,
              depth: 9000,
            },
          ],
        },
      })
    );

    return () => {
      observationLayerRef.current = null;
      viewRef.current = null;
      view.destroy();
    };
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || !activeLocation) return;

    view.goTo(
      {
        center: [
          activeLocation.longitude,
          activeLocation.latitude,
        ],
        zoom: activeLocation.zoom,
      },
      {
        duration: 1800,
        easing: "ease-in-out",
      }
    );
  }, [activeLocation]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    // Keep the current controls stable while we build the real
    // SAGARA data layers. These values will later drive real
    // ArcGIS data visualizations.
    view.container?.setAttribute(
      "data-active-layer",
      activeLayer
    );
    view.container?.setAttribute(
      "data-depth",
      String(depth)
    );
  }, [activeLayer, depth]);

  return <div ref={containerRef} className="arcgis-globe" />;
}

/* ============================================================
   MAIN APPLICATION
============================================================ */

function App() {
  const [selectedLocation, setSelectedLocation] = useState(
    LOCATIONS.INDIAN_OCEAN
  );

  const [activeLayer, setActiveLayer] =
    useState("Temperature");

  const [depth, setDepth] = useState(0);
  const [panelOpen, setPanelOpen] = useState(false);

  return (
    <div className="app">
      {/* ======================================================
          HEADER
      ====================================================== */}

      <header className="header">
        <div>
          <h1>RATNAKARA</h1>
          <p>Ocean Intelligence Platform</p>
        </div>

        <nav>
          <button
            onClick={() =>
              setSelectedLocation(LOCATIONS.ARABIAN_SEA)
            }
          >
            Arabian Sea
          </button>

          <button
            onClick={() =>
              setSelectedLocation(LOCATIONS.BAY_OF_BENGAL)
            }
          >
            Bay of Bengal
          </button>

          <button
            onClick={() =>
              setSelectedLocation(LOCATIONS.INDIAN_OCEAN)
            }
          >
            Indian Ocean
          </button>
        </nav>
      </header>

      {/* ======================================================
          OCEAN VIEW
      ====================================================== */}

      <main className="ocean-view">
        {/* PANEL TOGGLE */}

        <button
          className={`panel-toggle ${panelOpen ? "open" : ""}`}
          onClick={() => setPanelOpen(!panelOpen)}
          aria-label="Toggle ocean layers"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>

        {/* LEFT OCEAN CONTROL PANEL */}

        <div
          className={`ocean-panel ${
            panelOpen ? "visible" : ""
          }`}
        >
          <div className="panel-header">
            <div>
              <span className="panel-dot"></span>
              <span>LAYERS</span>
            </div>
          </div>

          <div className="panel-search">
            🔍
            <span>Filter layers...</span>
          </div>

          <div className="panel-section-title">
            OCEAN VARIABLES
          </div>

          <button
            className={`layer-button ${
              activeLayer === "Temperature" ? "selected" : ""
            }`}
            onClick={() => setActiveLayer("Temperature")}
          >
            <span className="layer-icon">🌡</span>
            <span>
              <strong>Temperature</strong>
              <small>Sea surface temperature</small>
            </span>
          </button>

          <button
            className={`layer-button ${
              activeLayer === "Salinity" ? "selected" : ""
            }`}
            onClick={() => setActiveLayer("Salinity")}
          >
            <span className="layer-icon">💧</span>
            <span>
              <strong>Salinity</strong>
              <small>Ocean salinity</small>
            </span>
          </button>

          <button
            className={`layer-button ${
              activeLayer === "Currents" ? "selected" : ""
            }`}
            onClick={() => setActiveLayer("Currents")}
          >
            <span className="layer-icon">🌊</span>
            <span>
              <strong>Currents</strong>
              <small>Ocean circulation</small>
            </span>
          </button>

          <button
            className={`layer-button ${
              activeLayer === "Coastal Lines"
                ? "selected"
                : ""
            }`}
            onClick={() => setActiveLayer("Coastal Lines")}
          >
            <span className="layer-icon">🗺️</span>
            <span>
              <strong>Coastal Lines</strong>
              <small>Coastline boundaries</small>
            </span>
          </button>

          <div className="panel-divider"></div>

          <div className="panel-section-title">
            DEPTH
          </div>

          <div className="depth-values">
            <span>Surface</span>
            <strong>{depth} m</strong>
          </div>

          <input
            className="depth-slider"
            type="range"
            min="0"
            max="2000"
            step="50"
            value={depth}
            onChange={(e) =>
              setDepth(Number(e.target.value))
            }
          />

          <div className="depth-labels">
            <span>0 m</span>
            <span>2000 m</span>
          </div>
        </div>

        {/* ====================================================
            ARCGIS 3D SCENE
        ==================================================== */}

        <ArcGISGlobe
          activeLocation={selectedLocation}
          activeLayer={activeLayer}
          depth={depth}
        />

        {/* ====================================================
            SMALL STATUS CARD
        ==================================================== */}

        <div className="globe-status">
          <span className="status-dot"></span>
          <span>3D Ocean View</span>
          <span className="status-separator">•</span>
          <strong>{selectedLocation.name}</strong>
        </div>
      </main>
    </div>
  );
}

export default App;
