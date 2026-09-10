import {
  Canvas,
  useFrame,
  useThree,
} from "@react-three/fiber";

import {
  OrbitControls,
  Stars,
} from "@react-three/drei";

import {
  Component,
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import * as THREE from "three";

import "./App.css";

import { PinpointMarker, WarningCard } from "./components/CoastalWarning";
import DataLayerFilter from "./components/DataLayerFilter";
import TemperatureLegend from "./components/TemperatureLegend";
import CurrentLegend from "./components/CurrentLegend";
import LocationLabel from "./components/LocationLabel";
import { COASTAL_ADVISORIES } from "./data/coastalAdvisories";
import { fetchHealth, fetchMetadata, fetchModelField, fetchObservations, fetchValidation, fetchAlert } from "./services/api";

/*
  IMPORTANT:
  Currents is lazy-loaded so a problem inside
  RatnakaraCurrents.jsx cannot prevent the
  main globe from rendering.
*/
const RatnakaraCurrents = lazy(
  () => import("./components/RatnakaraCurrents")
);


/* ============================================================
   CAMERA LOCATIONS
============================================================ */

const LOCATIONS = {
  ARABIAN_SEA: {
    lat: 15,
    lon: 75,
  },

  BAY_OF_BENGAL: {
    lat: 15,
    lon: 90,
  },

  INDIAN_OCEAN: {
    lat: -10,
    lon: 95,
  },
};


/* ============================================================
   COASTAL LINE LOCATIONS

   Coastal locations now also trigger the existing
   coastal warning / pinpoint animation.

   The actual advisory data still comes from:
   ./data/coastalAdvisories
============================================================ */

const COASTAL_LINE_LOCATIONS = {
  MUMBAI_COAST: {
    lat: 19.076,
    lon: 72.8777,
    distance: 2.55,
    names: ["Mumbai", "Mumbai Coast"],
  },

  KOCHI_COAST: {
    lat: 9.9312,
    lon: 76.2673,
    distance: 2.55,
    names: ["Kochi", "Kochi Coast"],
  },

  CHENNAI_COAST: {
    lat: 13.0827,
    lon: 80.2707,
    distance: 2.55,
    names: ["Chennai", "Chennai Coast"],
  },
};


/* ============================================================
   SEARCHABLE HAZARDS
============================================================ */

const SEARCHABLE_HAZARDS = [
  {
    name: "Tsunami Warning",
    icon: "⚠️",
    description: "Active tsunami alerts",
  },

  {
    name: "Earthquakes",
    icon: "◈",
    description: "Recent seismic activity",
  },

  {
    name: "Cyclones",
    icon: "🌀",
    description: "Tropical cyclone tracking",
  },

  {
    name: "Storm Surge",
    icon: "🌊",
    description: "Coastal surge risk",
  },
];


/* ============================================================
   DEEP-ZOOM REGIONS
============================================================ */

const DEEP_ZOOM_REGIONS = [
  {
    name: "Arabian Sea",
    minLat: -8,
    maxLat: 32,
    minLon: 42,
    maxLon: 83,
  },

  {
    name: "Bay of Bengal",
    minLat: -8,
    maxLat: 32,
    minLon: 79,
    maxLon: 118,
  },

  {
    name: "Indian Ocean",
    minLat: -42,
    maxLat: 8,
    minLon: 38,
    maxLon: 128,
  },
];


/* ============================================================
   INDIAN COASTAL PRIORITY
============================================================ */

const INDIAN_COASTAL_PRIORITY = [
  {
    minLat: 8,
    maxLat: 25,
    minLon: 68,
    maxLon: 75,
  },

  {
    minLat: 8,
    maxLat: 21,
    minLon: 72,
    maxLon: 78,
  },

  {
    minLat: 8,
    maxLat: 16,
    minLon: 73,
    maxLon: 78,
  },

  {
    minLat: 7,
    maxLat: 13,
    minLon: 74,
    maxLon: 78,
  },

  {
    minLat: 7,
    maxLat: 13,
    minLon: 76,
    maxLon: 81,
  },

  {
    minLat: 8,
    maxLat: 19,
    minLon: 77,
    maxLon: 85,
  },

  {
    minLat: 15,
    maxLat: 22,
    minLon: 80,
    maxLon: 88,
  },

  {
    minLat: 20,
    maxLat: 25,
    minLon: 85,
    maxLon: 90,
  },

  {
    minLat: 5,
    maxLat: 11,
    minLon: 78,
    maxLon: 84,
  },

  /* Lakshadweep */

  {
    minLat: 7,
    maxLat: 13,
    minLon: 71,
    maxLon: 75,
  },

  /* Sri Lanka */

  {
    minLat: 5,
    maxLat: 11,
    minLon: 79,
    maxLon: 82,
  },

  /* Andaman & Nicobar */

  {
    minLat: 6,
    maxLat: 14,
    minLon: 91,
    maxLon: 95,
  },

  /* Southern Bay of Bengal */

  {
    minLat: 5,
    maxLat: 15,
    minLon: 82,
    maxLon: 91,
  },
];


/* ============================================================
   SATELLITE LAYER
============================================================ */

const SATELLITE_RADIUS = 2.025;

const DETAIL_SATELLITE_RADIUS = 2.030;


/* ============================================================
   SENTINEL ZOOM LEVELS
============================================================ */

const GLOBAL_SATELLITE_ZOOM = 3;

const DETAIL_SATELLITE_ZOOM = 8;

const MEDIUM_SATELLITE_ZOOM = 4;


const MEDIUM_ZOOM_ENTER_DISTANCE = 8.5;

const MEDIUM_ZOOM_EXIT_DISTANCE = 9.1;

const DETAIL_ZOOM_ENTER_DISTANCE = 5.8;

const DETAIL_ZOOM_EXIT_DISTANCE = 6.4;


/* ============================================================
   EOX CLOUDLESS SENTINEL-2 WGS84 TILE SERVICE
============================================================ */

const SATELLITE_TILE_URL =
  "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2025/default/WGS84";


/* ============================================================
   DAY/NIGHT SUN DIRECTION
============================================================ */

const DEFAULT_SUN_DIRECTION =
  new THREE.Vector3(1, 0.3, 0.5).normalize();


/* ============================================================
   WGS84 TILE HELPERS
============================================================ */

function wgs84TileCountX(zoom) {
  return Math.pow(2, zoom + 1);
}

function wgs84TileCountY(zoom) {
  return Math.pow(2, zoom);
}


function lonToWGS84TileX(lon, zoom) {
  const tileCount =
    wgs84TileCountX(zoom);

  let normalized =
    (lon + 180) / 360;

  normalized =
    THREE.MathUtils.clamp(
      normalized,
      0,
      0.999999999
    );

  return normalized * tileCount;
}


function latToWGS84TileY(lat, zoom) {
  const tileCount =
    wgs84TileCountY(zoom);

  const normalized =
    (90 - lat) / 180;

  return (
    THREE.MathUtils.clamp(
      normalized,
      0,
      0.999999999
    ) * tileCount
  );
}


function wgs84TileXToLon(x, zoom) {
  const tileCount =
    wgs84TileCountX(zoom);

  return (
    (x / tileCount) * 360 - 180
  );
}


function wgs84TileYToLat(y, zoom) {
  const tileCount =
    wgs84TileCountY(zoom);

  return (
    90 -
    (y / tileCount) * 180
  );
}


/* ============================================================
   BACKWARD COMPATIBLE HELPERS
============================================================ */

function lonToTileX(lon, zoom) {
  return lonToWGS84TileX(
    lon,
    zoom
  );
}

function latToTileY(lat, zoom) {
  return latToWGS84TileY(
    lat,
    zoom
  );
}

function tileXToLon(x, zoom) {
  return wgs84TileXToLon(
    x,
    zoom
  );
}

function tileYToLat(y, zoom) {
  return wgs84TileYToLat(
    y,
    zoom
  );
}


/* ============================================================
   LAT/LON -> RATNAKARA GLOBE POSITION
============================================================ */

function satelliteLatLonToVector(
  lat,
  lon,
  radius
) {
  const phi =
    THREE.MathUtils.degToRad(
      90 - lat
    );

  const theta =
    THREE.MathUtils.degToRad(
      lon + 70
    );

  return new THREE.Vector3(
    radius *
      Math.sin(phi) *
      Math.sin(theta),

    radius *
      Math.cos(phi),

    radius *
      Math.sin(phi) *
      Math.cos(theta)
  );
}


/* ============================================================
   TEMPERATURE SYSTEM
============================================================ */


/*
  Thermal thresholds.

  NORMAL  < 29°C  -> GREEN
  MEDIUM 29-31°C  -> GREEN -> YELLOW -> RED
  HIGH   >= 31°C  -> RED
*/

const NORMAL_TEMPERATURE_LIMIT = 29;

const HIGH_TEMPERATURE_LIMIT = 31;


/* ============================================================
   TEMPERATURE COLOR THEORY
============================================================ */

function temperatureToColor(
  temperature
) {
  const stops = [
    {
      temp: 4,
      color: new THREE.Color("#0b3d91"),
    },

    {
      temp: 12,
      color: new THREE.Color("#00bcd4"),
    },

    {
      temp: 18,
      color: new THREE.Color("#fdd835"),
    },

    {
      temp: 24,
      color: new THREE.Color("#ff9800"),
    },

    {
      temp: 28,
      color: new THREE.Color("#f44336"),
    },

    {
      temp: 34,
      color: new THREE.Color("#880e4f"),
    },
  ];

  const value =
    THREE.MathUtils.clamp(
      temperature,
      stops[0].temp,
      stops[stops.length - 1].temp
    );

  for (
    let i = 0;
    i < stops.length - 1;
    i++
  ) {
    const lower = stops[i];
    const upper = stops[i + 1];

    if (value <= upper.temp) {
      const factor =
        (value - lower.temp) /
        (upper.temp - lower.temp);

      return lower.color.clone().lerp(
        upper.color,
        factor
      );
    }
  }

  return stops[
    stops.length - 1
  ].color.clone();
}


/* ============================================================
   REAL TEMPERATURE DATA LOOKUP

   Builds a spatial lookup from the backend model-field
   response so that createTemperatureGeometry can use
   real NetCDF values instead of the synthetic model.
============================================================ */

function buildModelLookup(modelPoints) {
  if (!modelPoints || modelPoints.length === 0) {
    return null;
  }

  /*
    Index by rounded lat/lon (1 decimal) for O(1) lookup.
    The model grid is ~3.9 deg spacing so 1-decimal
    rounding is safe for nearest-neighbour matching.
  */
  const map = new Map();

  for (const pt of modelPoints) {
    const key = `${pt.latitude.toFixed(1)},${pt.longitude.toFixed(1)}`;

    if (!map.has(key)) {
      map.set(key, pt.value);
    }
  }

  return function getModelValue(lat, lon) {
    /* Try exact rounded key first */
    const key = `${lat.toFixed(1)},${lon.toFixed(1)}`;

    if (map.has(key)) {
      return map.get(key);
    }

    /*
      Brute-force nearest neighbour (model grid is small,
      max ~600 points — this runs once per vertex per
      geometry build, not per frame).
    */
    let best = null;
    let bestDist = Infinity;

    for (const pt of modelPoints) {
      const dlat = pt.latitude - lat;
      const dlon = pt.longitude - lon;
      const dist = dlat * dlat + dlon * dlon;

      if (dist < bestDist) {
        bestDist = dist;
        best = pt.value;
      }
    }

    /* Only accept if within ~5 degrees (model grid spacing ~3.9°) */
    return bestDist < 25 ? best : null;
  };
}


/* ============================================================
   OCEAN-ONLY REGION CHECK
============================================================ */

function isOceanRegion(lat, lon) {
  if (
    lat >= 6 &&
    lat <= 35 &&
    lon >= 68 &&
    lon <= 90
  ) {
    return false;
  }

  if (
    lat >= 5.5 &&
    lat <= 10.5 &&
    lon >= 79 &&
    lon <= 82.5
  ) {
    return false;
  }

  if (
    lat >= 12 &&
    lat <= 30 &&
    lon >= 35 &&
    lon <= 60
  ) {
    return false;
  }

  if (
    lat >= -35 &&
    lat <= 12 &&
    lon >= 30 &&
    lon <= 52
  ) {
    return false;
  }

  if (
    lat >= -8 &&
    lat <= 20 &&
    lon >= 95 &&
    lon <= 120
  ) {
    return false;
  }

  return true;
}


/* ============================================================
   CONTINUOUS TEMPERATURE FIELD GEOMETRY
============================================================ */

function createTemperatureGeometry(
  depth = 0,
  radius = 2.033,
  modelPoints = []
) {
  const latStart = -35;
  const latEnd = 28;

  const lonStart = 45;
  const lonEnd = 100;

  const step = 2.0;

  const effectiveRadius =
    Math.max(
      radius,
      DETAIL_SATELLITE_RADIUS + 0.004
    );

  const positions = [];
  const colors = [];
  const alphas = [];
  const indices = [];

  const latCount =
    Math.round(
      (latEnd - latStart) / step
    ) + 1;

  const lonCount =
    Math.round(
      (lonEnd - lonStart) / step
    ) + 1;

  const latMin =
    latStart + 4;

  const latMax =
    latEnd - 4;

  const lonMin =
    lonStart + 4;

  const lonMax =
    lonEnd - 4;

  const modelLookup =
    modelPoints.length > 0
      ? buildModelLookup(modelPoints)
      : null;

  for (
    let latIndex = 0;
    latIndex < latCount;
    latIndex++
  ) {
    const latitude =
      latStart +
      latIndex * step;

    for (
      let lonIndex = 0;
      lonIndex < lonCount;
      lonIndex++
    ) {
      const longitude =
        lonStart +
        lonIndex * step;

      const ocean =
        isOceanRegion(
          latitude,
          longitude
        );

      /*
        Use real backend data when available,
        fall back to inline synthetic while loading.
      */
      let temperature;

      if (modelLookup) {
        temperature = modelLookup(
          latitude,
          longitude
        );

        if (temperature === null) {
          /* Model has no data here (land) — skip */
          alphas.push(0.0);
          positions.push(0, 0, 0);
          colors.push(0, 0, 0);
          continue;
        }
      }
      else {
        /* Fallback: inline synthetic while data loads */
        temperature =
          27.65 +
          Math.sin(longitude * Math.PI / 22) * 0.85 +
          Math.cos(latitude * Math.PI / 26) * 0.45 -
          Math.abs(latitude - 8) * 0.075 -
          depth * 0.004;
      }

      const position =
        satelliteLatLonToVector(
          latitude,
          longitude,
          effectiveRadius
        );

      const color =
        temperatureToColor(
          temperature
        );

      positions.push(
        position.x,
        position.y,
        position.z
      );

      colors.push(
        color.r,
        color.g,
        color.b
      );

      let alpha = 1.0;

      if (!ocean) {
        alpha = 0.0;
      }

      else {
        const latFade =
          Math.min(
            (latitude - latMin) / 4,
            (latMax - latitude) / 4,
            1.0
          );

        const lonFade =
          Math.min(
            (longitude - lonMin) / 4,
            (lonMax - longitude) / 4,
            1.0
          );

        alpha =
          Math.min(
            latFade,
            lonFade
          );
      }

      alphas.push(alpha);
    }
  }

  for (
    let latIndex = 0;
    latIndex < latCount - 1;
    latIndex++
  ) {
    for (
      let lonIndex = 0;
      lonIndex < lonCount - 1;
      lonIndex++
    ) {
      const a =
        latIndex *
          lonCount +
        lonIndex;

      const b = a + 1;
      const c = a + lonCount;
      const d = c + 1;

      indices.push(
        a,
        c,
        b
      );

      indices.push(
        b,
        c,
        d
      );
    }
  }

  const geometry =
    new THREE.BufferGeometry();

  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      positions,
      3
    )
  );

  geometry.setAttribute(
    "color",
    new THREE.Float32BufferAttribute(
      colors,
      3
    )
  );

  geometry.setAttribute(
    "alpha",
    new THREE.Float32BufferAttribute(
      alphas,
      1
    )
  );

  geometry.setIndex(indices);

  geometry.computeVertexNormals();

  return geometry;
}


/* ============================================================
   TEMPERATURE LAYER
============================================================ */

function TemperatureLayer({
  depth = 0,
  radius = 2.033,
  modelPoints = [],
}) {
  const materialRef =
    useRef(null);

  const liftRef =
    useRef(0);

  const fadeInRef =
    useRef(0);

  const activatedRef =
    useRef(false);

  const geometry =
    useMemo(
      () =>
        createTemperatureGeometry(
          depth,
          radius,
          modelPoints
        ),
      [depth, radius, modelPoints]
    );

  useFrame(
    (state, delta) => {
      if (!materialRef.current) {
        return;
      }

      const uniforms =
        materialRef.current.uniforms;

      uniforms.uTime.value =
        state.clock.elapsedTime;

      if (
        !activatedRef.current
      ) {
        activatedRef.current =
          true;
      }

      if (
        liftRef.current < 1
      ) {
        liftRef.current =
          Math.min(
            1,
            liftRef.current +
              delta * 1.2
          );

        uniforms.uLift.value =
          liftRef.current;
      }

      if (
        fadeInRef.current < 1
      ) {
        fadeInRef.current =
          Math.min(
            1,
            fadeInRef.current +
              delta * 1.5
          );

        uniforms.uFadeIn.value =
          fadeInRef.current;
      }
    }
  );

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  return (
    <mesh
      geometry={geometry}
      renderOrder={25}
      frustumCulled={false}
    >
      <shaderMaterial
        ref={materialRef}
        transparent
        depthWrite={false}
        depthTest={true}
        vertexColors
        uniforms={{
          uTime: {
            value: 0,
          },

          uLift: {
            value: 0,
          },

          uFadeIn: {
            value: 0,
          },
        }}
        vertexShader={`
          attribute float alpha;
          uniform float uLift;

          varying vec3 vColor;
          varying vec3 vNormal;
          varying float vAlpha;

          void main() {
            vColor = color;
            vNormal = normalize(normalMatrix * normal);
            vAlpha = alpha;

            float liftAmount =
              uLift * 0.008;

            vec3 displaced =
              position +
              normal * liftAmount;

            gl_Position =
              projectionMatrix *
              modelViewMatrix *
              vec4(displaced, 1.0);
          }
        `}
        fragmentShader={`
          uniform float uTime;
          uniform float uFadeIn;

          varying vec3 vColor;
          varying vec3 vNormal;
          varying float vAlpha;

          void main() {
            if (vAlpha < 0.01)
              discard;

            float wave =
              sin(
                vColor.r * 10.0 +
                uTime * 0.4
              ) * 0.03;

            float brightness =
              0.97 + wave;

            vec3 finalColor =
              vColor * brightness;

            float finalAlpha =
              vAlpha *
              uFadeIn *
              0.62;

            gl_FragColor =
              vec4(
                finalColor,
                finalAlpha
              );
          }
        `}
        toneMapped={false}
      />
    </mesh>
  );
}


/* ============================================================
   SATELLITE TILE GEOMETRY
============================================================ */

function createSatelliteTileGeometry(
  tileX,
  tileY,
  zoom,
  radius
) {
  const segments = 24;

  const positions = [];
  const uvs = [];
  const indices = [];

  const startX = tileX;
  const endX = tileX + 1;

  const startY = tileY;
  const endY = tileY + 1;

  for (
    let row = 0;
    row <= segments;
    row++
  ) {
    const v =
      row / segments;

    const tileYPosition =
      startY +
      v *
        (endY - startY);

    const lat =
      tileYToLat(
        tileYPosition,
        zoom
      );

    for (
      let column = 0;
      column <= segments;
      column++
    ) {
      const u =
        column / segments;

      const tileXPosition =
        startX +
        u *
          (endX - startX);

      const lon =
        tileXToLon(
          tileXPosition,
          zoom
        );

      const position =
        satelliteLatLonToVector(
          lat,
          lon,
          radius
        );

      positions.push(
        position.x,
        position.y,
        position.z
      );

      uvs.push(
        u,
        1 - v
      );
    }
  }

  for (
    let row = 0;
    row < segments;
    row++
  ) {
    for (
      let column = 0;
      column < segments;
      column++
    ) {
      const a =
        row *
          (segments + 1) +
        column;

      const b = a + 1;

      const c =
        a +
        (segments + 1);

      const d = c + 1;

      indices.push(
        a,
        c,
        b
      );

      indices.push(
        b,
        c,
        d
      );
    }
  }

  const geometry =
    new THREE.BufferGeometry();

  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      positions,
      3
    )
  );

  geometry.setAttribute(
    "uv",
    new THREE.Float32BufferAttribute(
      uvs,
      2
    )
  );

  geometry.setIndex(indices);

  geometry.computeVertexNormals();

  return geometry;
}


/* ============================================================
   SATELLITE MATERIAL
============================================================ */

function createSatelliteMaterial(
  texture
) {
  return new THREE.MeshBasicMaterial({
    map: texture,

    side:
      THREE.FrontSide,

    transparent: false,

    opacity: 1,

    depthWrite: true,

    depthTest: true,

    toneMapped: false,
  });
}


/* ============================================================
   INDIVIDUAL SATELLITE TILE
============================================================ */

function SatelliteTile({
  tileX,
  tileY,
  zoom,
  radius = SATELLITE_RADIUS,
}) {
  const [
    texture,
    setTexture,
  ] = useState(null);

  const [
    failed,
    setFailed,
  ] = useState(false);

  const tileCountY =
    wgs84TileCountY(
      zoom
    );

  const invalidTile =
    tileY < 0 ||
    tileY >= tileCountY;

  useEffect(() => {
    let mounted = true;

    const loader =
      new THREE.TextureLoader();

    loader.setCrossOrigin(
      "anonymous"
    );

    const tileCountX =
      wgs84TileCountX(
        zoom
      );

    const wrappedX =
      (
        tileX %
          tileCountX +
        tileCountX
      ) %
      tileCountX;

    if (invalidTile) {
      return undefined;
    }

    const integerX =
      Math.floor(
        wrappedX
      );

    const integerY =
      Math.floor(
        tileY
      );

    const url =
      SATELLITE_TILE_URL +
      "/" +
      zoom +
      "/" +
      integerY +
      "/" +
      integerX +
      ".jpg";

    loader.load(
      url,

      (loadedTexture) => {
        if (!mounted) {
          loadedTexture.dispose();
          return;
        }

        loadedTexture.colorSpace =
          THREE.SRGBColorSpace;

        loadedTexture.anisotropy =
          16;

        loadedTexture.minFilter =
          THREE.LinearFilter;

        loadedTexture.magFilter =
          THREE.LinearFilter;

        loadedTexture.generateMipmaps =
          false;

        loadedTexture.wrapS =
          THREE.ClampToEdgeWrapping;

        loadedTexture.wrapT =
          THREE.ClampToEdgeWrapping;

        loadedTexture.needsUpdate =
          true;

        setTexture(
          loadedTexture
        );
      },

      undefined,

      () => {
        if (mounted) {
          setFailed(true);
        }
      }
    );

    return () => {
      mounted = false;
    };
  }, [
    tileX,
    tileY,
    zoom,
    invalidTile,
  ]);

  const geometry =
    texture &&
    !failed &&
    !invalidTile
      ? createSatelliteTileGeometry(
          tileX,
          tileY,
          zoom,
          radius
        )
      : null;

  const material =
    texture &&
    !failed &&
    !invalidTile
      ? createSatelliteMaterial(
          texture
        )
      : null;

  useEffect(() => {
    if (
      !geometry ||
      !material ||
      !texture
    ) {
      return undefined;
    }

    return () => {
      geometry.dispose();
      material.dispose();
      texture.dispose();
    };
  }, [
    geometry,
    material,
    texture,
  ]);

  if (
    !geometry ||
    !material
  ) {
    return null;
  }

  return (
    <mesh
      geometry={geometry}
      material={material}
      renderOrder={
        radius >
        SATELLITE_RADIUS
          ? 20
          : 10
      }
    />
  );
}


/* ============================================================
   GLOBAL SATELLITE GLOBE
============================================================ */

function GlobalSatelliteGlobe() {
  const tileMeshes = [];

  const tileCountX =
    wgs84TileCountX(
      GLOBAL_SATELLITE_ZOOM
    );

  const tileCountY =
    wgs84TileCountY(
      GLOBAL_SATELLITE_ZOOM
    );

  for (
    let y = 0;
    y < tileCountY;
    y++
  ) {
    for (
      let x = 0;
      x < tileCountX;
      x++
    ) {
      tileMeshes.push(
        <SatelliteTile
          key={
            `global-${x}-${y}`
          }
          tileX={x}
          tileY={y}
          zoom={
            GLOBAL_SATELLITE_ZOOM
          }
          radius={
            SATELLITE_RADIUS
          }
        />
      );
    }
  }

  return (
    <group
      renderOrder={5}
    >
      {tileMeshes}
    </group>
  );
}


/* ============================================================
   DETAIL SATELLITE LAYER
============================================================ */

function DetailSatelliteLayer() {
  const { camera } =
    useThree();

  const [
    satelliteState,
    setCenterTile,
  ] = useState(null);

  const lastState =
    useRef("");

  const mediumActive =
    useRef(false);

  const detailActive =
    useRef(false);

  useEffect(() => {
    let mounted = true;

    const updateDetail = () => {
      const distance =
        camera.position.length();

      const {
        lat,
        lon,
      } =
        getCameraLatLon(
          camera
        );

      const priorityRegion =
        isInsideIndianCoastalPriority(
          lat,
          lon
        );

      const regionalWater =
        isInsideDeepZoomRegion(
          lat,
          lon
        );

      if (regionalWater) {
        if (
          !mediumActive.current &&
          distance <
            MEDIUM_ZOOM_ENTER_DISTANCE
        ) {
          mediumActive.current =
            true;
        }

        if (
          mediumActive.current &&
          distance >
            MEDIUM_ZOOM_EXIT_DISTANCE
        ) {
          mediumActive.current =
            false;
        }

        if (
          !detailActive.current &&
          priorityRegion &&
          distance <
            DETAIL_ZOOM_ENTER_DISTANCE
        ) {
          detailActive.current =
            true;
        }

        if (
          detailActive.current &&
          (
            !priorityRegion ||
            distance >
              DETAIL_ZOOM_EXIT_DISTANCE
          )
        ) {
          detailActive.current =
            false;
        }
      }

      else {
        mediumActive.current =
          false;

        detailActive.current =
          false;
      }

      const mediumTileX =
        Math.floor(
          lonToTileX(
            lon,
            MEDIUM_SATELLITE_ZOOM
          )
        );

      const mediumTileY =
        Math.floor(
          latToTileY(
            lat,
            MEDIUM_SATELLITE_ZOOM
          )
        );

      const detailTileX =
        Math.floor(
          lonToTileX(
            lon,
            DETAIL_SATELLITE_ZOOM
          )
        );

      const detailTileY =
        Math.floor(
          latToTileY(
            lat,
            DETAIL_SATELLITE_ZOOM
          )
        );

      const nextState =
        mediumActive.current ||
        detailActive.current
          ? {
              medium:
                mediumActive.current
                  ? {
                      x:
                        mediumTileX,

                      y:
                        mediumTileY,

                      z:
                        MEDIUM_SATELLITE_ZOOM,
                    }
                  : null,

              detail:
                detailActive.current
                  ? {
                      x:
                        detailTileX,

                      y:
                        detailTileY,

                      z:
                        DETAIL_SATELLITE_ZOOM,
                    }
                  : null,
            }
          : null;

      const stateKey =
        nextState === null
          ? "hidden"
          : JSON.stringify(
              nextState
            );

      if (
        lastState.current !==
        stateKey
      ) {
        lastState.current =
          stateKey;

        if (mounted) {
          setCenterTile(
            nextState
          );
        }
      }
    };

    updateDetail();

    const interval =
      setInterval(
        updateDetail,
        250
      );

    return () => {
      mounted = false;

      clearInterval(
        interval
      );
    };
  }, [camera]);

  if (!satelliteState) {
    return null;
  }

  const tileMeshes = [];

  const addWindow = (
    center,
    radius,
    prefix
  ) => {
    if (!center) {
      return;
    }

    for (
      let y = -2;
      y <= 2;
      y++
    ) {
      for (
        let x = -2;
        x <= 2;
        x++
      ) {
        const tileX =
          center.x + x;

        const tileY =
          center.y + y;

        tileMeshes.push(
          <SatelliteTile
            key={
              `${prefix}-${center.z}-${tileX}-${tileY}`
            }
            tileX={tileX}
            tileY={tileY}
            zoom={center.z}
            radius={radius}
          />
        );
      }
    }
  };

  addWindow(
    satelliteState.medium,
    SATELLITE_RADIUS +
      0.002,
    "medium"
  );

  addWindow(
    satelliteState.detail,
    DETAIL_SATELLITE_RADIUS,
    "detail"
  );

  return (
    <group
      renderOrder={20}
    >
      {tileMeshes}
    </group>
  );
}


/* ============================================================
   SENTINEL LAYER
============================================================ */

function SatelliteLayer() {
  return (
    <>
      <GlobalSatelliteGlobe />

      <DetailSatelliteLayer />
    </>
  );
}


/* ============================================================
   ATMOSPHERE
============================================================ */

function Atmosphere({
  lightMode = false,
}) {
  return (
    <mesh
      scale={[
        1.012,
        1.012,
        1.012,
      ]}
    >
      <sphereGeometry
        args={[
          2,
          48,
          48,
        ]}
      />

      <meshBasicMaterial
        color={
          lightMode
            ? "#8ee8f5"
            : "#63c7d8"
        }
        transparent
        opacity={
          lightMode
            ? 0.055
            : 0.022
        }
        side={
          THREE.BackSide
        }
        blending={
          THREE.AdditiveBlending
        }
        depthWrite={false}
        depthTest={true}
        toneMapped={false}
      />
    </mesh>
  );
}


/* ============================================================
   OCEAN DATA POINTS
============================================================ */

function OceanGlowPoints() {
  return null;
}


/* ============================================================
   ARGO OBSERVATION MARKERS

   Renders all returned Argo observation locations as small
   cyan dots on the globe using a single InstancedMesh for
   performance (handles thousands of points).
============================================================ */

function ArgoMarkers({ observations = [] }) {
  const meshRef = useRef(null);

  const MARKER_RADIUS = 2.038;
  const MARKER_SIZE = 0.008;

  const count = observations.length;

  /*
    Build the instance matrix array once when observations
    change. Each matrix positions a small sphere at the
    correct lat/lon on the globe surface.
  */
  useMemo(() => {
    if (!meshRef.current || count === 0) return;

    const dummy = new THREE.Object3D();

    for (let i = 0; i < count; i++) {
      const obs = observations[i];
      const pos = satelliteLatLonToVector(
        obs.latitude,
        obs.longitude,
        MARKER_RADIUS
      );

      dummy.position.copy(pos);

      /*
        Orient the marker to point outward from globe center.
        Look at the center (0,0,0) from the marker position,
        then rotate 180 so it faces outward.
      */
      dummy.lookAt(0, 0, 0);
      dummy.rotateX(Math.PI);

      dummy.scale.setScalar(1);
      dummy.updateMatrix();

      meshRef.current.setMatrixAt(i, dummy.matrix);
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [observations, count]);

  if (count === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[null, null, count]}
      frustumCulled={false}
      renderOrder={30}
    >
      <sphereGeometry args={[MARKER_SIZE, 6, 6]} />
      <meshBasicMaterial
        color="#00e5ff"
        transparent
        opacity={0.85}
        depthWrite={false}
        toneMapped={false}
      />
    </instancedMesh>
  );
}


/* ============================================================
   DAY/NIGHT OVERLAY
============================================================ */

function DayNightOverlay({
  sunDirection =
    DEFAULT_SUN_DIRECTION,
}) {
  const materialRef =
    useRef(null);

  useFrame(() => {
    if (!materialRef.current) {
      return;
    }

    materialRef.current.uniforms.uSunDir.value.copy(
      sunDirection
    );
  });

  return (
    <mesh
      scale={[
        2.005,
        2.005,
        2.005,
      ]}
    >
      <sphereGeometry
        args={[
          1,
          48,
          48,
        ]}
      />

      <shaderMaterial
        ref={materialRef}
        transparent
        depthWrite={false}
        depthTest={true}
        side={THREE.FrontSide}
        uniforms={{
          uSunDir: {
            value:
              sunDirection.clone(),
          },
        }}
        vertexShader={`
          varying vec3 vNormal;
          varying vec3 vWorldPosition;

          void main() {
            vNormal =
              normalize(
                normalMatrix *
                normal
              );

            vec4 worldPos =
              modelMatrix *
              vec4(
                position,
                1.0
              );

            vWorldPosition =
              worldPos.xyz;

            gl_Position =
              projectionMatrix *
              modelViewMatrix *
              vec4(
                position,
                1.0
              );
          }
        `}
        fragmentShader={`
          uniform vec3 uSunDir;

          varying vec3 vNormal;
          varying vec3 vWorldPosition;

          void main() {
            vec3 normDir =
              normalize(
                vWorldPosition
              );

            float sunDot =
              dot(
                normDir,
                uSunDir
              );

            float terminator =
              smoothstep(
                -0.15,
                0.15,
                sunDot
              );

            float darkness =
              mix(
                0.0,
                0.55,
                1.0 -
                terminator
              );

            gl_FragColor =
              vec4(
                vec3(0.0),
                darkness
              );
          }
        `}
        toneMapped={false}
      />
    </mesh>
  );
}


/* ============================================================
   CAMERA GEOGRAPHIC POSITION
============================================================ */

function getCameraLatLon(
  camera
) {
  const position =
    camera.position.clone();

  const distance =
    position.length();

  if (distance === 0) {
    return {
      lat: 0,
      lon: 0,
    };
  }

  const lat =
    THREE.MathUtils.radToDeg(
      Math.asin(
        THREE.MathUtils.clamp(
          position.y /
            distance,
          -1,
          1
        )
      )
    );

  const correctedLon =
    Math.atan2(
      position.x,
      position.z
    );

  let lon =
    THREE.MathUtils.radToDeg(
      correctedLon
    ) - 70;

  if (lon > 180) {
    lon -= 360;
  }

  if (lon < -180) {
    lon += 360;
  }

  return {
    lat,
    lon,
  };
}


/* ============================================================
   REGION CHECKS
============================================================ */

function isInsideDeepZoomRegion(
  lat,
  lon
) {
  return DEEP_ZOOM_REGIONS.some(
    (region) =>
      lat >= region.minLat &&
      lat <= region.maxLat &&
      lon >= region.minLon &&
      lon <= region.maxLon
  );
}


function isInsideIndianCoastalPriority(
  lat,
  lon
) {
  return INDIAN_COASTAL_PRIORITY.some(
    (region) =>
      lat >= region.minLat &&
      lat <= region.maxLat &&
      lon >= region.minLon &&
      lon <= region.maxLon
  );
}


/* ============================================================
   CAMERA CONTROLLER
============================================================ */

function CameraController({
  activeLocation,
  cameraState,
  onAnimationComplete,
}) {
  const controlsRef =
    useRef(null);

  const targetPosition =
    useRef(
      new THREE.Vector3()
    );

  const targetLookAt =
    useRef(
      new THREE.Vector3()
    );

  const animating =
    useRef(false);

  const deepZoomActive =
    useRef(false);

  function getLocationDistance(
    lat,
    lon
  ) {
    if (lat < -5) {
      return 5.5;
    }

    return 3.8;
  }

  useEffect(() => {
    if (!activeLocation) {
      return;
    }

    const distance =
      activeLocation.distance ||
      getLocationDistance(
        activeLocation.lat,
        activeLocation.lon
      );

    const lat =
      THREE.MathUtils.degToRad(
        activeLocation.lat
      );

    const lon =
      THREE.MathUtils.degToRad(
        activeLocation.lon + 70
      );

    targetPosition.current.set(
      distance *
        Math.cos(lat) *
        Math.sin(lon),

      distance *
        Math.sin(lat),

      distance *
        Math.cos(lat) *
        Math.cos(lon)
    );

    targetLookAt.current.set(
      0,
      0,
      0
    );

    animating.current =
      true;
  }, [activeLocation]);

  useEffect(() => {
    const controls =
      controlsRef.current;

    if (!controls) {
      return;
    }

    if (
      cameraState ===
        "locationAnimating" ||
      cameraState ===
        "dataAnimating"
    ) {
      controls.enabled =
        false;
    }

    else {
      controls.enabled =
        true;
    }
  }, [cameraState]);

  useFrame(
    (state, delta) => {
      const controls =
        controlsRef.current;

      if (!controls) {
        return;
      }

      if (animating.current) {
        const cameraAlpha =
          1 -
          Math.exp(
            -5.5 * delta
          );

        const targetAlpha =
          1 -
          Math.exp(
            -6.5 * delta
          );

        state.camera.position.lerp(
          targetPosition.current,
          cameraAlpha
        );

        controls.target.lerp(
          targetLookAt.current,
          targetAlpha
        );

        const positionDistance =
          state.camera.position.distanceTo(
            targetPosition.current
          );

        const targetDistance =
          controls.target.distanceTo(
            targetLookAt.current
          );

        if (
          positionDistance <
            0.008 &&
          targetDistance <
            0.008
        ) {
          state.camera.position.copy(
            targetPosition.current
          );

          controls.target.copy(
            targetLookAt.current
          );

          animating.current =
            false;

          if (
            onAnimationComplete
          ) {
            onAnimationComplete();
          }
        }
      }

      const {
        lat,
        lon,
      } =
        getCameraLatLon(
          state.camera
        );

      const insideDeepRegion =
        isInsideDeepZoomRegion(
          lat,
          lon
        );

      if (
        insideDeepRegion !==
        deepZoomActive.current
      ) {
        deepZoomActive.current =
          insideDeepRegion;

        controls.minDistance =
          insideDeepRegion
            ? 2.038
            : 2.75;
      }

      const currentDistance =
        state.camera.position.length();

      if (
        currentDistance <
        controls.minDistance
      ) {
        const direction =
          state.camera.position
            .clone()
            .normalize();

        state.camera.position.copy(
          direction.multiplyScalar(
            controls.minDistance
          )
        );
      }

      controls.update();
    }
  );

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableRotate={true}
      enableZoom={true}
      enablePan={false}
      enableDamping={true}
      dampingFactor={0.08}
      rotateSpeed={0.8}
      zoomSpeed={0.72}
      minDistance={2.038}
      maxDistance={14}
      minPolarAngle={0.05}
      maxPolarAngle={
        Math.PI - 0.05
      }
      autoRotate={false}
    />
  );
}


/* ============================================================
   DEEP SPACE / LIGHT SKY
============================================================ */

function DeepSpaceBackground({
  lightMode = false,
}) {
  const texture =
    useMemo(() => {
      const canvas =
        document.createElement(
          "canvas"
        );

      canvas.width = 2048;
      canvas.height = 1024;

      const ctx =
        canvas.getContext("2d");

      if (!ctx) {
        return null;
      }

      if (lightMode) {
        const sky =
          ctx.createLinearGradient(
            0,
            0,
            0,
            canvas.height
          );

        sky.addColorStop(
          0,
          "#86cce4"
        );

        sky.addColorStop(
          0.42,
          "#c8eaf5"
        );

        sky.addColorStop(
          1,
          "#eef9fc"
        );

        ctx.fillStyle = sky;

        ctx.fillRect(
          0,
          0,
          canvas.width,
          canvas.height
        );

        const sunlight =
          ctx.createRadialGradient(
            canvas.width * 0.83,
            canvas.height * 0.14,
            10,
            canvas.width * 0.83,
            canvas.height * 0.14,
            canvas.width * 0.62
          );

        sunlight.addColorStop(
          0,
          "rgba(255,245,175,0.46)"
        );

        sunlight.addColorStop(
          0.20,
          "rgba(255,238,170,0.20)"
        );

        sunlight.addColorStop(
          0.52,
          "rgba(255,242,190,0.07)"
        );

        sunlight.addColorStop(
          1,
          "rgba(255,255,255,0)"
        );

        ctx.fillStyle =
          sunlight;

        ctx.fillRect(
          0,
          0,
          canvas.width,
          canvas.height
        );

        for (
          let i = 0;
          i < 110;
          i++
        ) {
          const x =
            Math.random() *
            canvas.width;

          const y =
            Math.random() *
            canvas.height;

          const size =
            Math.random() *
              0.20 +
            0.07;

          const alpha =
            Math.random() *
              0.12 +
            0.035;

          ctx.fillStyle =
            `rgba(255,255,255,${alpha})`;

          ctx.beginPath();

          ctx.arc(
            x,
            y,
            size,
            0,
            Math.PI * 2
          );

          ctx.fill();
        }

        const haze =
          ctx.createRadialGradient(
            canvas.width * 0.46,
            canvas.height * 0.60,
            20,
            canvas.width * 0.46,
            canvas.height * 0.60,
            canvas.width * 0.76
          );

        haze.addColorStop(
          0,
          "rgba(255,255,255,0.15)"
        );

        haze.addColorStop(
          1,
          "rgba(255,255,255,0)"
        );

        ctx.fillStyle =
          haze;

        ctx.fillRect(
          0,
          0,
          canvas.width,
          canvas.height
        );
      }

      else {
        ctx.fillStyle =
          "#000000";

        ctx.fillRect(
          0,
          0,
          canvas.width,
          canvas.height
        );

        const glow =
          ctx.createRadialGradient(
            canvas.width * 0.5,
            canvas.height * 0.5,
            100,
            canvas.width * 0.5,
            canvas.height * 0.5,
            canvas.width * 0.85
          );

        glow.addColorStop(
          0,
          "rgba(8,16,24,0.10)"
        );

        glow.addColorStop(
          0.45,
          "rgba(3,8,14,0.05)"
        );

        glow.addColorStop(
          1,
          "rgba(0,0,0,0)"
        );

        ctx.fillStyle =
          glow;

        ctx.fillRect(
          0,
          0,
          canvas.width,
          canvas.height
        );

        ctx.save();

        ctx.translate(
          canvas.width / 2,
          canvas.height / 2
        );

        ctx.rotate(
          -0.18
        );

        const milkyWay =
          ctx.createLinearGradient(
            -canvas.width,
            0,
            canvas.width,
            0
          );

        milkyWay.addColorStop(
          0,
          "rgba(255,255,255,0)"
        );

        milkyWay.addColorStop(
          0.30,
          "rgba(130,150,165,0.004)"
        );

        milkyWay.addColorStop(
          0.42,
          "rgba(170,185,195,0.008)"
        );

        milkyWay.addColorStop(
          0.50,
          "rgba(205,215,220,0.012)"
        );

        milkyWay.addColorStop(
          0.58,
          "rgba(170,185,195,0.008)"
        );

        milkyWay.addColorStop(
          0.70,
          "rgba(130,150,165,0.004)"
        );

        milkyWay.addColorStop(
          1,
          "rgba(255,255,255,0)"
        );

        ctx.fillStyle =
          milkyWay;

        ctx.fillRect(
          -canvas.width,
          -canvas.height * 0.055,
          canvas.width * 2,
          canvas.height * 0.11
        );

        ctx.restore();

        for (
          let i = 0;
          i < 900;
          i++
        ) {
          const x =
            Math.random() *
            canvas.width;

          const y =
            Math.random() *
            canvas.height;

          const roll =
            Math.random();

          let size;
          let alpha;

          if (
            roll < 0.86
          ) {
            size =
              Math.random() *
                0.18 +
              0.08;

            alpha =
              Math.random() *
                0.16 +
              0.07;
          }

          else if (
            roll < 0.98
          ) {
            size =
              Math.random() *
                0.28 +
              0.14;

            alpha =
              Math.random() *
                0.18 +
              0.14;
          }

          else {
            size =
              Math.random() *
                0.40 +
              0.20;

            alpha =
              Math.random() *
                0.20 +
              0.25;
          }

          const colorRoll =
            Math.random();

          let starColor;

          if (
            colorRoll < 0.88
          ) {
            starColor =
              "255,255,255";
          }

          else if (
            colorRoll < 0.96
          ) {
            starColor =
              "215,230,245";
          }

          else {
            starColor =
              "255,238,220";
          }

          ctx.fillStyle =
            `rgba(${starColor},${alpha})`;

          ctx.beginPath();

          ctx.arc(
            x,
            y,
            size,
            0,
            Math.PI * 2
          );

          ctx.fill();
        }

        for (
          let i = 0;
          i < 24;
          i++
        ) {
          const x =
            Math.random() *
            canvas.width;

          const y =
            Math.random() *
            canvas.height;

          const size =
            Math.random() *
              0.55 +
            0.35;

          const halo =
            ctx.createRadialGradient(
              x,
              y,
              0,
              x,
              y,
              size * 2.2
            );

          halo.addColorStop(
            0,
            "rgba(255,255,255,0.70)"
          );

          halo.addColorStop(
            0.30,
            "rgba(225,238,248,0.18)"
          );

          halo.addColorStop(
            1,
            "rgba(255,255,255,0)"
          );

          ctx.fillStyle =
            halo;

          ctx.beginPath();

          ctx.arc(
            x,
            y,
            size * 2.2,
            0,
            Math.PI * 2
          );

          ctx.fill();

          ctx.fillStyle =
            "rgba(255,255,255,0.92)";

          ctx.beginPath();

          ctx.arc(
            x,
            y,
            size * 0.35,
            0,
            Math.PI * 2
          );

          ctx.fill();
        }
      }

      const generatedTexture =
        new THREE.CanvasTexture(
          canvas
        );

      generatedTexture.colorSpace =
        THREE.SRGBColorSpace;

      generatedTexture.minFilter =
        THREE.LinearFilter;

      generatedTexture.magFilter =
        THREE.NearestFilter;

      generatedTexture.wrapS =
        THREE.ClampToEdgeWrapping;

      generatedTexture.wrapT =
        THREE.ClampToEdgeWrapping;

      generatedTexture.anisotropy =
        1;

      generatedTexture.generateMipmaps =
        false;

      generatedTexture.needsUpdate =
        true;

      return generatedTexture;
    }, [lightMode]);

  useEffect(() => {
    return () => {
      if (texture) {
        texture.dispose();
      }
    };
  }, [texture]);

  if (!texture) {
    return null;
  }

  return (
    <mesh
      scale={[
        90,
        90,
        90,
      ]}
      renderOrder={-1000}
      frustumCulled={false}
    >
      <sphereGeometry
        args={[
          1,
          64,
          64,
        ]}
      />

      <meshBasicMaterial
        map={texture}
        side={
          THREE.BackSide
        }
        transparent={false}
        opacity={1}
        depthWrite={false}
        depthTest={false}
        toneMapped={false}
        fog={false}
      />
    </mesh>
  );
}


/* ============================================================
   CURRENTS ERROR BOUNDARY
============================================================ */

class CurrentsErrorBoundary
  extends Component {
  constructor(props) {
    super(props);

    this.state = {
      hasError: false,
    };
  }

  static getDerivedStateFromError() {
    return {
      hasError: true,
    };
  }

  componentDidCatch(error) {
    console.error(
      "Ratnakara currents animation error:",
      error
    );
  }

  render() {
    if (this.state.hasError) {
      return null;
    }

    return this.props.children;
  }
}


/* ============================================================
   MAIN APPLICATION
============================================================ */

function App() {
  const [
    selectedLocation,
    setSelectedLocation,
  ] = useState(null);

  const [
    activeLayer,
    setActiveLayer,
  ] = useState(
    "Temperature"
  );

  const [
    depth,
    setDepth,
  ] = useState(0);

  const [
    panelOpen,
    setPanelOpen,
  ] = useState(false);

  const [
    filterQuery,
    setFilterQuery,
  ] = useState("");

  const [
    lightMode,
    setLightMode,
  ] = useState(false);


  /* ==========================================================
     PHASE 2 — REAL MODEL DATA
  ========================================================== */

  const [
    modelPoints,
    setModelPoints,
  ] = useState([]);

  const [
    modelLoading,
    setModelLoading,
  ] = useState(false);

  const [
    modelError,
    setModelError,
  ] = useState(null);


  /* ==========================================================
     PHASE 3 — ARGO OBSERVATIONS
  ========================================================== */

  const [
    argoObservations,
    setArgoObservations,
  ] = useState([]);


  /* ==========================================================
     PHASE 6 — OCEAN CURRENT DATA
  ========================================================== */

  const [
    currentVectors,
    setCurrentVectors,
  ] = useState(null);


  /* ==========================================================
     PHASE 4 — FORECAST TRUTH ENGINE
  ========================================================== */

  const [
    validationMetrics,
    setValidationMetrics,
  ] = useState(null);

  const [
    validationCollocation,
    setValidationCollocation,
  ] = useState(null);


  /* ==========================================================
     PHASE 5 — DETERMINISTIC OCEAN ALERT
  ========================================================== */

  const [
    alertData,
    setAlertData,
  ] = useState(null);


  /* ==========================================================
     PHASE 8 — ASK THE OCEAN
  ========================================================== */

  const [
    chatOpen,
    setChatOpen,
  ] = useState(false);

  const [
    chatInput,
    setChatInput,
  ] = useState("");

  const [
    chatAnswer,
    setChatAnswer,
  ] = useState("");

  const [
    chatLoading,
    setChatLoading,
  ] = useState(false);

  const [
    chatError,
    setChatError,
  ] = useState(null);


  /* ==========================================================
     LAYER VISIBILITY
  ========================================================== */

  const [
    visibleLayers,
    setVisibleLayers,
  ] = useState({
    current: true,
    temperature: true,
    warnings: true,
  });

  const handleToggleLayer =
    (layerId) => {
      setVisibleLayers(
        (prev) => ({
          ...prev,
          [layerId]:
            !prev[layerId],
        })
      );
    };


  /* ==========================================================
     COASTAL WARNINGS
  ========================================================== */

  const [
    activeWarning,
    setActiveWarning,
  ] = useState(null);


  const handleSelectWarning =
    (advisory) => {
      if (
        cameraState !==
        "idle"
      ) {
        return;
      }

      setActiveWarning(
        advisory
      );

      setSelectedLocation({
        lat:
          advisory.latitude,

        lon:
          advisory.longitude,

        distance:
          advisory.distance ||
          2.55,
      });

      setCameraState(
        "locationAnimating"
      );
    };


  const handleCloseWarning =
    () => {
      setActiveWarning(
        null
      );
    };


  /* ==========================================================
     CAMERA STATE MACHINE
  ========================================================== */

  const [
    cameraState,
    setCameraState,
  ] = useState("idle");

  const [
    activeLocationKey,
    setActiveLocationKey,
  ] = useState(null);

  const [
    coastalLinesOpen,
    setCoastalLinesOpen,
  ] = useState(false);

  const layerAnimationTimerRef =
    useRef(null);


  const normalizedFilter =
    filterQuery
      .trim()
      .toLowerCase();


  const matchingHazards =
    normalizedFilter
      ? SEARCHABLE_HAZARDS.filter(
          (hazard) =>
            hazard.name
              .toLowerCase()
              .includes(
                normalizedFilter
              ) ||
            hazard.description
              .toLowerCase()
              .includes(
                normalizedFilter
              )
        )
      : [];


  /* ==========================================================
     FIND EXISTING COASTAL ADVISORY

     This uses the SAME advisory objects that were previously
     shown in the separate Coastal Advisories section.

     No new warning system is created.
  ========================================================== */

  const findCoastalAdvisory =
    (location) => {
      if (
        !location ||
        !Array.isArray(
          location.names
        )
      ) {
        return null;
      }

      const names =
        location.names.map(
          (name) =>
            name
              .trim()
              .toLowerCase()
        );

      const advisory =
        COASTAL_ADVISORIES.find(
          (item) => {
            const advisoryName =
              String(
                item.name || ""
              )
                .trim()
                .toLowerCase();

            return names.some(
              (name) =>
                advisoryName ===
                  name ||
                advisoryName.includes(
                  name
                ) ||
                name.includes(
                  advisoryName
                )
            );
          }
        );

      if (!advisory) {
        return null;
      }

      return {
        ...advisory,
        latitude:
          advisory.latitude ??
          location.lat,
        longitude:
          advisory.longitude ??
          location.lon,
        distance:
          advisory.distance ??
          location.distance,
      };
    };


  /* ==========================================================
     LOCATION NAVIGATION
  ========================================================== */

  const DEFAULT_CAMERA = {
    lat: 0,
    lon: 0,
    distance: 7,
  };


  const clearLayerAnimationTimer =
    () => {
      if (
        layerAnimationTimerRef.current
      ) {
        clearTimeout(
          layerAnimationTimerRef.current
        );

        layerAnimationTimerRef.current =
          null;
      }
    };


  const handleLayerSelect =
    (layerName) => {
      if (
        cameraState !==
        "idle"
      ) {
        return;
      }

      if (
        activeLayer ===
        layerName
      ) {
        clearLayerAnimationTimer();

        setActiveLayer(null);

        return;
      }

      setActiveLayer(
        layerName
      );

      setCameraState(
        "dataAnimating"
      );

      clearLayerAnimationTimer();

      layerAnimationTimerRef.current =
        setTimeout(
          () => {
            layerAnimationTimerRef.current =
              null;

            setCameraState(
              "idle"
            );
          },
          900
        );
    };


  const goToLocation =
    (
      location,
      locationKey
    ) => {
      if (
        cameraState !==
        "idle"
      ) {
        return;
      }

      clearLayerAnimationTimer();

      if (
        activeLocationKey ===
        locationKey
      ) {
        setSelectedLocation({
          ...DEFAULT_CAMERA,
        });

        setActiveLocationKey(
          null
        );

        setCameraState(
          "locationAnimating"
        );
      }

      else {
        setSelectedLocation({
          lat:
            location.lat,

          lon:
            location.lon,

          distance:
            location.distance,
        });

        setActiveLocationKey(
          locationKey
        );

        setCameraState(
          "locationAnimating"
        );
      }
    };


  /* ==========================================================
     CURRENTS NAVIGATION
  ========================================================== */

  const goToCurrents =
    () => {
      handleLayerSelect(
        "Currents"
      );
    };


  /* ==========================================================
     COASTAL LINE NAVIGATION

     IMPORTANT:
     The existing pinpoint / warning animation is now
     triggered directly from the Coastal Lines dropdown.

     The separate Coastal Advisories panel is gone.
  ========================================================== */

  const goToCoastalLocation =
    (
      location,
      locationKey
    ) => {
      if (
        cameraState !==
        "idle"
      ) {
        return;
      }

      clearLayerAnimationTimer();

      const advisory =
        findCoastalAdvisory(
          location
        );

      /*
        Keep the existing warning animation.

        If an advisory exists, use the exact existing
        advisory object.

        If one is not found, the camera still performs
        the exact existing Coastal Lines camera animation.
      */

      if (advisory) {
        setActiveWarning(
          advisory
        );

        setSelectedLocation({
          lat:
            advisory.latitude,

          lon:
            advisory.longitude,

          distance:
            advisory.distance ||
            location.distance,
        });
      }

      else {
        setActiveWarning(
          null
        );

        setSelectedLocation({
          lat:
            location.lat,

          lon:
            location.lon,

          distance:
            location.distance,
        });
      }

      setActiveLayer(
        "Coastal Lines"
      );

      setActiveLocationKey(
        locationKey
      );

      setCameraState(
        "locationAnimating"
      );
    };


  /* ==========================================================
     CAMERA ANIMATION COMPLETE CALLBACK
  ========================================================== */

  const handleCameraAnimationComplete =
    () => {
      clearLayerAnimationTimer();

      setCameraState(
        "idle"
      );
    };


  useEffect(() => {
    return () => {
      clearLayerAnimationTimer();
    };
  }, []);


  /* ==========================================================
     PHASE 1 — BACKEND CONNECTION

     Calls /health and /api/v1/metadata on mount to prove
     the React frontend can talk to the FastAPI backend
     through the Vite dev proxy.
  ========================================================== */

  useEffect(() => {
    fetchHealth()
      .then((data) => {
        console.log("[RATNAKARA] /health:", data);
      })
      .catch((err) => {
        console.error("[RATNAKARA] /health failed:", err);
      });

    fetchMetadata()
      .then((data) => {
        console.log("[RATNAKARA] /api/v1/metadata:", data);
      })
      .catch((err) => {
        console.error("[RATNAKARA] /api/v1/metadata failed:", err);
      });
  }, []);


  /* ==========================================================
     PHASE 2 — REAL TEMPERATURE DATA

     Fetches real model-field data from the backend whenever
     the user changes depth. The single available timestep
     is 2026-06-23T00:00:00 (from the metadata).
  ========================================================== */

  useEffect(() => {
    setModelLoading(true);
    setModelError(null);

    fetchModelField({
      variable: "temperature",
      depth: depth,
      time: "2026-06-23T00:00:00",
      max_points: 5000,
    })
      .then((data) => {
        setModelPoints(data.points);
        console.log(
          `[RATNAKARA] model-field: ${data.points.length} points at depth ${data.depth}m`
        );
      })
      .catch((err) => {
        console.error("[RATNAKARA] model-field failed:", err);
        setModelError(err.message || "Failed to load model data");
      })
      .finally(() => {
        setModelLoading(false);
      });
  }, [depth]);


  /* ==========================================================
     PHASE 3 — ARGO OBSERVATIONS

     Fetches real Argo observation locations on mount and
     displays them as markers on the globe.
  ========================================================== */

  useEffect(() => {
    fetchObservations({
      max_observations: 5000,
    })
      .then((data) => {
        setArgoObservations(data.observations);
        console.log(
          `[RATNAKARA] Argo: ${data.count} observations (${data.mode})`
        );
      })
      .catch((err) => {
        console.error("[RATNAKARA] Argo observations failed:", err);
      });
  }, []);


  /* ==========================================================
     PHASE 6 — REAL OCEAN CURRENT DATA

     Fetches U/V current data from the model-field API
     and merges into vectors for the current visualization.
  ========================================================= */

  useEffect(() => {
    const time = "2026-06-23T00:00:00";

    Promise.all([
      fetchModelField({ variable: "u_current", depth, time, max_points: 500 }),
      fetchModelField({ variable: "v_current", depth, time, max_points: 500 }),
    ])
      .then(([uData, vData]) => {
        /* Merge U and V by nearest lat/lon key */
        const uMap = new Map();
        for (const pt of uData.points) {
          const key = `${pt.latitude.toFixed(1)},${pt.longitude.toFixed(1)}`;
          uMap.set(key, pt.value);
        }

        const merged = [];
        for (const vPt of vData.points) {
          const key = `${vPt.latitude.toFixed(1)},${vPt.longitude.toFixed(1)}`;
          const uVal = uMap.get(key);
          if (uVal !== undefined && !isNaN(uVal) && !isNaN(vPt.value)) {
            merged.push({
              latitude: vPt.latitude,
              longitude: vPt.longitude,
              u: uVal,
              v: vPt.value,
            });
          }
        }

        setCurrentVectors(merged);
        console.log(
          `[RATNAKARA] Currents: ${merged.length} vectors at depth ${depth}m`
        );
      })
      .catch((err) => {
        console.error("[RATNAKARA] Current data failed:", err);
      });
  }, [depth]);


  /* ==========================================================
     PHASE 4 — FORECAST TRUTH ENGINE

     Runs batch model-vs-Argo comparison to produce
     validation metrics (Bias, MAE, RMSE).
  ========================================================== */

  useEffect(() => {
    fetchValidation()
      .then((data) => {
        setValidationMetrics(data.metrics);
        setValidationCollocation(data.collocation);
        console.log(
          `[RATNAKARA] Validation: Bias=${data.metrics.bias}, MAE=${data.metrics.mae}, RMSE=${data.metrics.rmse}, pairs=${data.metrics.pair_count}`
        );
      })
      .catch((err) => {
        console.error("[RATNAKARA] Validation failed:", err);
      });
  }, []);


  /* ==========================================================
     PHASE 5 — DETERMINISTIC OCEAN ALERT

     Fetches the deterministic alert result (GREEN/YELLOW/RED)
     based on validation metrics.
  ========================================================== */

  useEffect(() => {
    fetchAlert()
      .then((data) => {
        setAlertData(data);
        console.log(
          `[RATNAKARA] Alert: ${data.overall_risk}`
        );
      })
      .catch((err) => {
        console.error("[RATNAKARA] Alert failed:", err);
      });
  }, []);


  /* ==========================================================
     PHASE 8 — ASK THE OCEAN HANDLER
  ========================================================= */

  const handleChatSubmit = async () => {
    const question = chatInput.trim();
    if (!question || chatLoading) return;

    setChatLoading(true);
    setChatAnswer("");
    setChatError(null);

    try {
      const response = await fetchChat({
        question,
        context: {
          latitude: selectedLocation?.lat,
          longitude: selectedLocation?.lon,
          depth,
          variable: activeLayer?.toLowerCase(),
        },
      });
      setChatAnswer(response.answer);
    } catch (err) {
      console.error("[RATNAKARA] Chat failed:", err);
      setChatError(err.message || "OceanAI is unavailable.");
    } finally {
      setChatLoading(false);
    }
  };


  /* ==========================================================
     INLINE THEME STYLES
  ========================================================== */

  const techButtonStyle = {
    border:
      lightMode
        ? "1px solid rgba(22,135,201,0.55)"
        : "1px solid rgba(36,154,255,0.90)",

    boxShadow:
      lightMode
        ? "0 0 8px rgba(22,135,201,0.12)"
        : "0 0 10px rgba(0,145,255,0.32)",

    color:
      lightMode
        ? undefined
        : "#ffffff",

    background:
      lightMode
        ? undefined
        : "rgba(4,20,35,0.72)",
  };


  return (
    <div
      className={
        lightMode
          ? "app light-mode"
          : "app dark-mode"
      }
      style={{
        position: "relative",
        width: "100%",
        height: "100vh",
        overflow: "hidden",
      }}
    >

      {/* ======================================================
          HEADER
      ====================================================== */}

      <header
        className="header"
        style={{
          position: "relative",
          zIndex: 20,
        }}
      >

        <div className="brand">

          <h1>
            RATNAKARA
          </h1>

          <p>
            Ocean Intelligence Platform
          </p>

        </div>


        <nav
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >

          <button
            style={
              activeLocationKey ===
              "ARABIAN_SEA"
                ? {
                    ...techButtonStyle,
                    background:
                      lightMode
                        ? "#dff2f4"
                        : "rgba(255,255,255,0.95)",
                    color:
                      lightMode
                        ? undefined
                        : "#000",
                  }
                : techButtonStyle
            }
            onClick={() =>
              goToLocation(
                LOCATIONS.ARABIAN_SEA,
                "ARABIAN_SEA"
              )
            }
          >
            Arabian Sea
          </button>


          <button
            style={
              activeLocationKey ===
              "BAY_OF_BENGAL"
                ? {
                    ...techButtonStyle,
                    background:
                      lightMode
                        ? "#dff2f4"
                        : "rgba(255,255,255,0.95)",
                    color:
                      lightMode
                        ? undefined
                        : "#000",
                  }
                : techButtonStyle
            }
            onClick={() =>
              goToLocation(
                LOCATIONS.BAY_OF_BENGAL,
                "BAY_OF_BENGAL"
              )
            }
          >
            Bay of Bengal
          </button>


          <button
            style={
              activeLocationKey ===
              "INDIAN_OCEAN"
                ? {
                    ...techButtonStyle,
                    background:
                      lightMode
                        ? "#dff2f4"
                        : "rgba(255,255,255,0.95)",
                    color:
                      lightMode
                        ? undefined
                        : "#000",
                  }
                : techButtonStyle
            }
            onClick={() =>
              goToLocation(
                LOCATIONS.INDIAN_OCEAN,
                "INDIAN_OCEAN"
              )
            }
          >
            Indian Ocean
          </button>

        </nav>


        <div
          className="theme-switch-wrap"
          style={{
            marginLeft: "8px",
          }}
        >

          <button
            type="button"
            className={
              lightMode
                ? "theme-switch light"
                : "theme-switch"
            }
            onClick={() =>
              setLightMode(
                (value) =>
                  !value
              )
            }
            aria-label={
              lightMode
                ? "Switch to dark mode"
                : "Switch to light mode"
            }
            title={
              lightMode
                ? "Switch to dark mode"
                : "Switch to light mode"
            }
            style={{
              width: "22px",
              height: "22px",
              minWidth: "22px",
              minHeight: "22px",
              padding: 0,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >

            <span
              className={
                lightMode
                  ? "theme-switch-dot light-dot"
                  : "theme-switch-dot dark-dot"
              }
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                display: "block",
              }}
            />

          </button>

        </div>

      </header>


      {/* ======================================================
          OCEAN VIEW
      ====================================================== */}

      <main
        className="ocean-view"
        style={{
          position: "relative",
          width: "100%",
          height: "calc(100vh - 0px)",
          minHeight: 0,
          overflow: "hidden",
        }}
      >

        {/* ====================================================
            PANEL TOGGLE
        ==================================================== */}

        <button
          className={
            panelOpen
              ? "panel-toggle open"
              : "panel-toggle"
          }

          onClick={() =>
            setPanelOpen(
              !panelOpen
            )
          }

          aria-label="Toggle ocean layers"

          style={{
            position: "absolute",
            zIndex: 15,

            border:
              lightMode
                ? "1px solid rgba(22,135,201,0.55)"
                : "1px solid rgba(35,154,255,0.90)",

            boxShadow:
              lightMode
                ? "0 0 7px rgba(22,135,201,0.12)"
                : "0 0 11px rgba(0,145,255,0.32)",
          }}
        >

          <span></span>
          <span></span>
          <span></span>

        </button>


        {/* ====================================================
            OCEAN PANEL
        ==================================================== */}

        <div
          className={
            panelOpen
              ? "ocean-panel visible"
              : "ocean-panel"
          }

          style={{
            zIndex: 14,
          }}
        >

          <div className="panel-header">

            <div>

              <span className="panel-dot"></span>

              <span>
                LAYERS
              </span>

            </div>

          </div>


          <div className="panel-search">

            🔍

            <input
              type="search"
              value={filterQuery}
              placeholder="Filter layers..."
              aria-label="Filter layers"

              onChange={(event) =>
                setFilterQuery(
                  event.target.value
                )
              }
            />

          </div>


          <div className="panel-section-title">
            OCEAN VARIABLES
          </div>


          {/* ==================================================
              TEMPERATURE
          ================================================== */}

          <button
            className={
              activeLayer ===
              "Temperature"
                ? "layer-button selected"
                : "layer-button"
            }

            onClick={() =>
              handleLayerSelect(
                "Temperature"
              )
            }
          >

            <span className="layer-icon">
              🌡
            </span>

            <span>

              <strong>
                Temperature
              </strong>

              <small>
                Sea surface temperature
              </small>

            </span>

          </button>


          {/* ==================================================
              SALINITY
          ================================================== */}

          <button
            className={
              activeLayer ===
              "Salinity"
                ? "layer-button selected"
                : "layer-button"
            }

            onClick={() =>
              handleLayerSelect(
                "Salinity"
              )
            }
          >

            <span className="layer-icon">
              💧
            </span>

            <span>

              <strong>
                Salinity
              </strong>

              <small>
                Ocean salinity
              </small>

            </span>

          </button>


          {/* ==================================================
              CURRENTS
          ================================================== */}

          <button
            className={
              activeLayer ===
              "Currents"
                ? "layer-button selected"
                : "layer-button"
            }

            onClick={
              goToCurrents
            }
          >

            <span className="layer-icon">
              🌊
            </span>

            <span>

              <strong>
                Currents
              </strong>

              <small>
                Ocean circulation
              </small>

            </span>

          </button>


          {/* ==================================================
              COASTAL LINES

              Existing coastal warning animation is now
              triggered from these entries.

              Separate Coastal Advisories section removed.
          ================================================== */}

          <button
            className={
              activeLayer ===
              "Coastal Lines"
                ? "layer-button selected"
                : "layer-button"
            }

            onClick={() => {
              if (
                cameraState !==
                "idle"
              ) {
                return;
              }

              const wasActive =
                activeLayer ===
                "Coastal Lines";

              handleLayerSelect(
                "Coastal Lines"
              );

              if (
                wasActive
              ) {
                setCoastalLinesOpen(
                  false
                );
              }

              else {
                setCoastalLinesOpen(
                  (open) =>
                    !open
                );
              }
            }}

            aria-expanded={
              coastalLinesOpen
            }
          >

            <span className="layer-icon">
              🗺️
            </span>

            <span>

              <strong>
                Coastal Lines
              </strong>

              <small>
                Coastline boundaries
              </small>

            </span>

            <span
              style={{
                marginLeft: "auto",
                fontSize: 10,
                opacity: 0.65,
                transition:
                  "transform 0.2s ease",
                transform:
                  coastalLinesOpen
                    ? "rotate(180deg)"
                    : "rotate(0deg)",
              }}
            >
              ▾
            </span>

          </button>


          {/* ==================================================
              COASTAL LOCATIONS

              These are now the ONLY coastal entries.

              Their click behavior uses the existing
              PinpointMarker / WarningCard animation.
          ================================================== */}

          {coastalLinesOpen && (
            <div
              style={{
                paddingLeft: 12,
                marginTop: 2,
                marginBottom: 6,
              }}
            >

              <button
                className={
                  activeLocationKey ===
                  "MUMBAI_COAST"
                    ? "layer-button selected"
                    : "layer-button"
                }

                onClick={() =>
                  goToCoastalLocation(
                    COASTAL_LINE_LOCATIONS.MUMBAI_COAST,
                    "MUMBAI_COAST"
                  )
                }
              >

                <span className="layer-icon">
                  📍
                </span>

                <span>

                  <strong>
                    Mumbai Coast
                  </strong>

                  <small>
                    Arabian Sea coastal line
                  </small>

                </span>

              </button>


              <button
                className={
                  activeLocationKey ===
                  "KOCHI_COAST"
                    ? "layer-button selected"
                    : "layer-button"
                }

                onClick={() =>
                  goToCoastalLocation(
                    COASTAL_LINE_LOCATIONS.KOCHI_COAST,
                    "KOCHI_COAST"
                  )
                }
              >

                <span className="layer-icon">
                  📍
                </span>

                <span>

                  <strong>
                    Kochi Coast
                  </strong>

                  <small>
                    Arabian Sea coastal line
                  </small>

                </span>

              </button>


              <button
                className={
                  activeLocationKey ===
                  "CHENNAI_COAST"
                    ? "layer-button selected"
                    : "layer-button"
                }

                onClick={() =>
                  goToCoastalLocation(
                    COASTAL_LINE_LOCATIONS.CHENNAI_COAST,
                    "CHENNAI_COAST"
                  )
                }
              >

                <span className="layer-icon">
                  📍
                </span>

                <span>

                  <strong>
                    Chennai Coast
                  </strong>

                  <small>
                    Bay of Bengal coastal line
                  </small>

                </span>

              </button>

            </div>
          )}


          {/* ==================================================
              HAZARDS
          ================================================== */}

          {matchingHazards.length > 0 && (
            <>

              <div className="panel-divider"></div>

              <div className="panel-section-title">
                HAZARDS
              </div>


              {matchingHazards.map(
                (hazard) => (
                  <button
                    key={
                      hazard.name
                    }

                    className={
                      activeLayer ===
                      hazard.name
                        ? "layer-button selected"
                        : "layer-button"
                    }

                    onClick={() =>
                      handleLayerSelect(
                        hazard.name
                      )
                    }
                  >

                    <span className="layer-icon">
                      {
                        hazard.icon
                      }
                    </span>

                    <span>

                      <strong>
                        {
                          hazard.name
                        }
                      </strong>

                      <small>
                        {
                          hazard.description
                        }
                      </small>

                    </span>

                  </button>
                )
              )}

            </>
          )}


          {/* ==================================================
              DEPTH
          ================================================== */}

          <div className="panel-divider"></div>

          <div className="panel-section-title">
            DEPTH
          </div>


          <div className="depth-values">

            <span>
              Surface
            </span>

            <strong>
              {depth} m
            </strong>

          </div>


          <input
            className="depth-slider"
            type="range"
            min="0"
            max="2000"
            step="50"
            value={depth}

            onChange={(e) =>
              setDepth(
                Number(
                  e.target.value
                )
              )
            }
          />


          <div className="depth-labels">

            <span>
              0 m
            </span>

            <span>
              2000 m
            </span>

          </div>

        </div>


        {/* ====================================================
            THREE.JS CANVAS
        ==================================================== */}

        <div
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            zIndex: 1,
          }}
        >

          <Canvas
            dpr={[1, 1.5]}

            camera={{
              position: [
                0,
                0,
                7,
              ],

              fov: 45,

              near: 0.01,

              far: 100,
            }}

            gl={{
              antialias: true,

              alpha: false,

              powerPreference:
                "high-performance",

              preserveDrawingBuffer:
                false,
            }}

            style={{
              width: "100%",
              height: "100%",
              display: "block",
            }}

            onCreated={({ gl }) => {
              gl.setClearColor(
                lightMode
                  ? "#bfe9f7"
                  : "#020b14",
                1
              );
            }}
          >

            <color
              attach="background"
              args={[
                lightMode
                  ? "#bfe9f7"
                  : "#020b14",
              ]}
            />


            <DeepSpaceBackground
              lightMode={
                lightMode
              }
            />


            {!lightMode && (
              <Stars
                radius={90}
                depth={55}
                count={2200}
                factor={1.6}
                saturation={0}
                fade
                speed={0.08}
              />
            )}


            <ambientLight
              intensity={
                lightMode
                  ? 2.5
                  : 1.9
              }
            />


            <directionalLight
              position={[
                5,
                5,
                5,
              ]}
              intensity={
                lightMode
                  ? 3.8
                  : 2.8
              }
            />


            <directionalLight
              position={[
                -8,
                5,
                6,
              ]}
              color={
                lightMode
                  ? "#ffd76a"
                  : "#fff1cf"
              }
              intensity={
                lightMode
                  ? 3.0
                  : 2.0
              }
            />


            <directionalLight
              position={[
                -5,
                2,
                4,
              ]}
              intensity={
                lightMode
                  ? 1.7
                  : 1.2
              }
            />


            <group>

              <mesh>

                <sphereGeometry
                  args={[
                    2,
                    64,
                    64,
                  ]}
                />

                <meshBasicMaterial
                  color={
                    lightMode
                      ? "#58b8d0"
                      : "#17475a"
                  }
                />

              </mesh>


              <SatelliteLayer />


              <DayNightOverlay />


              <Atmosphere
                lightMode={
                  lightMode
                }
              />


              <OceanGlowPoints />


              <ArgoMarkers
                observations={
                  argoObservations
                }
              />


              {activeLayer ===
                "Temperature" &&
                visibleLayers.temperature && (
                  <TemperatureLayer
                    depth={depth}
                    radius={2.034}
                    modelPoints={modelPoints}
                  />
                )}


              {activeLayer ===
                "Currents" &&
                visibleLayers.current && (
                  <Suspense
                    fallback={null}
                  >

                    <CurrentsErrorBoundary>

                      <RatnakaraCurrents
                        depth={depth}
                        currentVectors={currentVectors}
                      />

                    </CurrentsErrorBoundary>

                  </Suspense>
                )}


              {activeWarning &&
                visibleLayers.warnings && (
                  <PinpointMarker
                    latitude={
                      activeWarning.latitude
                    }

                    longitude={
                      activeWarning.longitude
                    }

                    visible={true}

                    severity={
                      activeWarning.severity
                    }
                  />
                )}

            </group>


            <CameraController
              activeLocation={
                selectedLocation
              }

              cameraState={
                cameraState
              }

              onAnimationComplete={
                handleCameraAnimationComplete
              }
            />

          </Canvas>

        </div>


        {/* ====================================================
            HTML OVERLAY COMPONENTS
        ==================================================== */}

        <LocationLabel
          name={
            activeWarning?.name
          }

          region={
            activeWarning?.latitude >
            8
              ? (
                  activeWarning?.longitude <
                  80
                    ? "Arabian Sea"
                    : "Bay of Bengal"
                )
              : null
          }

          visible={
            !!activeWarning
          }

          lightMode={
            lightMode
          }
        />


        <WarningCard
          advisory={
            activeWarning
          }

          onClose={
            handleCloseWarning
          }

          lightMode={
            lightMode
          }
        />


        <DataLayerFilter
          visibleLayers={
            visibleLayers
          }

          onToggleLayer={
            handleToggleLayer
          }

          lightMode={
            lightMode
          }
        />


        <TemperatureLegend
          visible={
            activeLayer ===
              "Temperature" &&
            visibleLayers.temperature
          }

          lightMode={
            lightMode
          }
        />


        <CurrentLegend
          visible={
            activeLayer ===
              "Currents" &&
            visibleLayers.current
          }

          lightMode={
            lightMode
          }
        />


        {/* ====================================================
            PHASE 4 — FORECAST TRUTH ENGINE
            Compact validation metrics overlay
        ==================================================== */}

        {validationMetrics && (
          <div
            style={{
              position: "absolute",
              bottom: 16,
              left: 16,
              background: lightMode
                ? "rgba(248,253,255,0.92)"
                : "rgba(10,18,32,0.88)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              border: lightMode
                ? "1px solid rgba(22,135,201,0.20)"
                : "1px solid rgba(148,163,184,0.18)",
              borderRadius: 10,
              padding: "10px 14px",
              zIndex: 20,
              fontFamily:
                'Inter, "Segoe UI", Arial, sans-serif',
              fontSize: 11,
              color: lightMode ? "#163743" : "#e2e8f0",
              lineHeight: 1.6,
              minWidth: 180,
            }}
          >
            <div
              style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: "1px",
                color: lightMode
                  ? "#8fadb8"
                  : "#94a3b8",
                marginBottom: 4,
              }}
            >
              MODEL vs ARGO
            </div>

            <div>
              <span
                style={{
                  color: lightMode
                    ? "#8fadb8"
                    : "#94a3b8",
                }}
              >
                Bias:
              </span>
              {" "}
              <span
                style={{ fontWeight: 600 }}
              >
                {validationMetrics.bias}
                {" °C"}
              </span>
            </div>

            <div>
              <span
                style={{
                  color: lightMode
                    ? "#8fadb8"
                    : "#94a3b8",
                }}
              >
                MAE:
              </span>
              {" "}
              <span
                style={{ fontWeight: 600 }}
              >
                {validationMetrics.mae}
                {" °C"}
              </span>
            </div>

            <div>
              <span
                style={{
                  color: lightMode
                    ? "#8fadb8"
                    : "#94a3b8",
                }}
              >
                RMSE:
              </span>
              {" "}
              <span
                style={{ fontWeight: 600 }}
              >
                {validationMetrics.rmse}
                {" °C"}
              </span>
            </div>

            <div
              style={{
                marginTop: 4,
                fontSize: 9,
                color: lightMode
                  ? "#8fadb8"
                  : "#94a3b8",
              }}
            >
              {validationMetrics.pair_count}
              {" pairs"}
            </div>

            {validationCollocation && (
              <div
                style={{
                  marginTop: 6,
                  paddingTop: 6,
                  borderTop: lightMode
                    ? "1px solid rgba(22,135,201,0.12)"
                    : "1px solid rgba(148,163,184,0.12)",
                  fontSize: 9,
                  color: lightMode
                    ? "#8fadb8"
                    : "#94a3b8",
                  lineHeight: 1.5,
                }}
              >
                <div>Depth match: ~{Math.round(validationCollocation.mean_depth_difference_dbar)} dbar</div>
                <div>Spatial: ~{Math.round(validationCollocation.mean_spatial_distance_km)} km</div>
                <div>Model: {validationCollocation.model_time_used.split("T")[0]}</div>
              </div>
            )}
          </div>
        )}


        {/* ====================================================
            PHASE 5 — DETERMINISTIC OCEAN ALERT
            Compact risk-level indicator
        ==================================================== */}

        {alertData && (
          <div
            style={{
              position: "absolute",
              bottom: 16,
              left: 210,
              background: lightMode
                ? "rgba(248,253,255,0.92)"
                : "rgba(10,18,32,0.88)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              border: lightMode
                ? "1px solid rgba(22,135,201,0.20)"
                : "1px solid rgba(148,163,184,0.18)",
              borderRadius: 10,
              padding: "10px 14px",
              zIndex: 20,
              fontFamily:
                'Inter, "Segoe UI", Arial, sans-serif',
              fontSize: 11,
              color: lightMode ? "#163743" : "#e2e8f0",
              lineHeight: 1.6,
              minWidth: 160,
            }}
          >
            <div
              style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: "1px",
                color: lightMode
                  ? "#8fadb8"
                  : "#94a3b8",
                marginBottom: 4,
              }}
            >
              OCEAN ALERT
            </div>

            {/* Risk level badge */}
            <div
              style={{
                display: "inline-block",
                padding: "2px 10px",
                borderRadius: 6,
                background:
                  alertData.overall_risk === "GREEN"
                    ? "rgba(34,197,94,0.15)"
                    : alertData.overall_risk === "YELLOW"
                    ? "rgba(234,179,8,0.15)"
                    : "rgba(239,68,68,0.15)",
                color:
                  alertData.overall_risk === "GREEN"
                    ? "#22c55e"
                    : alertData.overall_risk === "YELLOW"
                    ? "#eab308"
                    : "#ef4444",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.5px",
                marginBottom: 6,
              }}
            >
              {alertData.overall_risk}
            </div>

            {alertData.alerts.length > 0 && (
              <div
                style={{
                  fontSize: 10,
                  color: lightMode
                    ? "#8fadb8"
                    : "#94a3b8",
                  lineHeight: 1.5,
                  maxWidth: 220,
                }}
              >
                {alertData.alerts[0].reason}
              </div>
            )}

            <div
              style={{
                marginTop: 4,
                fontSize: 8,
                color: lightMode
                  ? "#b0c4cc"
                  : "#64748b",
                fontStyle: "italic",
              }}
            >
              Prototype thresholds — not official
            </div>
          </div>
        )}


        {/* ====================================================
            PHASE 8 — ASK THE OCEAN
            Toggle button + compact chat panel
        ==================================================== */}

        {/* Toggle button */}
        {!chatOpen && (
          <button
            onClick={() => setChatOpen(true)}
            style={{
              position: "absolute",
              bottom: 16,
              right: 16,
              width: 40,
              height: 40,
              borderRadius: "50%",
              border: lightMode
                ? "1px solid rgba(22,135,201,0.30)"
                : "1px solid rgba(36,154,255,0.60)",
              background: lightMode
                ? "rgba(248,253,255,0.92)"
                : "rgba(10,18,32,0.88)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              color: lightMode ? "#163743" : "#e2e8f0",
              fontSize: 18,
              cursor: "pointer",
              zIndex: 30,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: lightMode
                ? "0 0 8px rgba(22,135,201,0.12)"
                : "0 0 10px rgba(0,145,255,0.32)",
              fontFamily: 'Inter, "Segoe UI", Arial, sans-serif',
            }}
            title="Ask the Ocean"
          >
            🌊
          </button>
        )}

        {/* Chat panel */}
        {chatOpen && (
          <div
            style={{
              position: "absolute",
              bottom: 16,
              right: 16,
              width: 320,
              maxHeight: 400,
              background: lightMode
                ? "rgba(248,253,255,0.95)"
                : "rgba(10,18,32,0.92)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              border: lightMode
                ? "1px solid rgba(22,135,201,0.20)"
                : "1px solid rgba(148,163,184,0.18)",
              borderRadius: 10,
              padding: 12,
              zIndex: 30,
              fontFamily: 'Inter, "Segoe UI", Arial, sans-serif',
              fontSize: 11,
              color: lightMode ? "#163743" : "#e2e8f0",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: "1px",
                  color: lightMode
                    ? "#8fadb8"
                    : "#94a3b8",
                }}
              >
                ASK THE OCEAN
              </div>
              <button
                onClick={() => {
                  setChatOpen(false);
                  setChatAnswer("");
                  setChatError(null);
                  setChatInput("");
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: lightMode
                    ? "#8fadb8"
                    : "#94a3b8",
                  cursor: "pointer",
                  fontSize: 14,
                  padding: 0,
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>

            {/* Input area */}
            <div
              style={{
                display: "flex",
                gap: 6,
              }}
            >
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleChatSubmit();
                }}
                placeholder="What does this ocean data indicate?"
                disabled={chatLoading}
                style={{
                  flex: 1,
                  padding: "6px 10px",
                  borderRadius: 6,
                  border: lightMode
                    ? "1px solid rgba(22,135,201,0.25)"
                    : "1px solid rgba(148,163,184,0.18)",
                  background: lightMode
                    ? "rgba(220,236,244,0.50)"
                    : "rgba(20,30,48,0.60)",
                  color: lightMode ? "#163743" : "#e2e8f0",
                  fontSize: 11,
                  fontFamily: 'Inter, "Segoe UI", Arial, sans-serif',
                  outline: "none",
                }}
              />
              <button
                onClick={handleChatSubmit}
                disabled={chatLoading || !chatInput.trim()}
                style={{
                  padding: "6px 12px",
                  borderRadius: 6,
                  border: lightMode
                    ? "1px solid rgba(22,135,201,0.40)"
                    : "1px solid rgba(36,154,255,0.70)",
                  background: lightMode
                    ? "rgba(22,135,201,0.15)"
                    : "rgba(36,154,255,0.20)",
                  color: lightMode ? "#163743" : "#e2e8f0",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: chatLoading || !chatInput.trim()
                    ? "not-allowed"
                    : "pointer",
                  fontFamily: 'Inter, "Segoe UI", Arial, sans-serif',
                }}
              >
                {chatLoading ? "..." : "Ask"}
              </button>
            </div>

            {/* Loading indicator */}
            {chatLoading && (
              <div
                style={{
                  fontSize: 10,
                  color: lightMode
                    ? "#8fadb8"
                    : "#94a3b8",
                  fontStyle: "italic",
                }}
              >
                OceanAI is thinking...
              </div>
            )}

            {/* Error */}
            {chatError && (
              <div
                style={{
                  fontSize: 10,
                  color: "#ef4444",
                  lineHeight: 1.4,
                }}
              >
                {chatError}
              </div>
            )}

            {/* Answer */}
            {chatAnswer && !chatLoading && (
              <div
                style={{
                  fontSize: 11,
                  lineHeight: 1.6,
                  color: lightMode ? "#163743" : "#cbd5e1",
                  maxHeight: 280,
                  overflowY: "auto",
                  whiteSpace: "pre-wrap",
                  borderTop: lightMode
                    ? "1px solid rgba(22,135,201,0.12)"
                    : "1px solid rgba(148,163,184,0.12)",
                  paddingTop: 8,
                }}
              >
                {chatAnswer}
              </div>
            )}
          </div>
        )}

      </main>

    </div>
  );
}


export default App;
