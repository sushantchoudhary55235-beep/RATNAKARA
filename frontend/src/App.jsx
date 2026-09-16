import {
  Canvas,
  useFrame,
  useThree,
} from "@react-three/fiber";

import {
  Html,
  OrbitControls,
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
import { fetchHealth, fetchMetadata, fetchModelField, fetchObservations, fetchValidation, fetchAlert, fetchChat } from "./services/api";
import { isLandPoint } from "./data/landMask";
import HorizonStars from "./components/HorizonStars";

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
    name: "Arabian Sea",
    bounds: { minLat: 5, maxLat: 25, minLon: 50, maxLon: 75 },
  },

  BAY_OF_BENGAL: {
    lat: 15,
    lon: 90,
    name: "Bay of Bengal",
    bounds: { minLat: 5, maxLat: 25, minLon: 75, maxLon: 100 },
  },

  INDIAN_OCEAN: {
    lat: -10,
    lon: 95,
    name: "Indian Ocean",
    bounds: { minLat: -25, maxLat: 5, minLon: 50, maxLon: 110 },
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

/*
  Palette colors are allocated ONCE (module scope) instead of
  creating new THREE.Color objects for every texture pixel —
  the old per-pixel allocation made each rebuild visibly
  pause (perceived layer flicker).
*/
const TEMPERATURE_COLOR_STOPS = [
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

const TEMP_SCRATCH_COLOR = new THREE.Color();


function temperatureToColor(
  temperature,
  outColor = null
) {
  const stops = TEMPERATURE_COLOR_STOPS;

  const value =
    THREE.MathUtils.clamp(
      temperature,
      stops[0].temp,
      stops[stops.length - 1].temp
    );

  const target =
    outColor || TEMP_SCRATCH_COLOR;

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

      return target
        .copy(lower.color)
        .lerp(upper.color, factor);
    }
  }

  return target.copy(
    stops[stops.length - 1].color
  );
}


/* ============================================================
   REAL TEMPERATURE DATA LOOKUP (BUCKETED INTERPOLATION)

   The backend model-field response is a regular latitude/
   longitude grid (CMEMS GLORYS, optionally downsampled by
   the endpoint). Points are bucketed into a fixed 1-degree
   spatial lattice ONCE per fetch; each texture pixel then
   inverse-distance-blends the few grid points around it.

   This replaces two previous problems:
   - brute-force nearest-neighbour scans (O(points) per
     pixel -> visible multi-second pause per rebuild), and
   - nearest-POINT coloring, which drew hard Voronoi blobs
     with steep jumps between adjacent grid cells.

   The weighted blend gives the smooth continuous ocean
   surface the layer is supposed to be, and the cutoff
   radius lets it fade out at the true data edge.

   Returns null, or { value, nearestDistanceSquared } so the
   texture can feather pixel alpha near the data boundary.
============================================================ */

const MODEL_LATTICE_CELL = 1;
const MODEL_BLEND_CUTOFF_SQ = 4; /* ignore samples beyond 2 deg */
const MODEL_BLEND_EPSILON = 0.0001;

const MODEL_SAMPLE_OUT = {
  value: 0,
  nearestDistanceSquared: 0,
};

function buildTemperatureModelLookup(modelPoints) {
  if (!Array.isArray(modelPoints) || modelPoints.length === 0) {
    return null;
  }

  const buckets = new Map();

  for (const point of modelPoints) {
    const pLat = Number(point?.latitude);
    const pLon = Number(point?.longitude);
    const pValue = Number(point?.value);

    if (
      !Number.isFinite(pLat) ||
      !Number.isFinite(pLon) ||
      !Number.isFinite(pValue)
    ) {
      continue;
    }

    const key =
      Math.floor(pLat / MODEL_LATTICE_CELL) +
      "," +
      Math.floor(pLon / MODEL_LATTICE_CELL);

    let bucket = buckets.get(key);

    if (!bucket) {
      bucket = [];
      buckets.set(key, bucket);
    }

    bucket.push({
      latitude: pLat,
      longitude: pLon,
      value: pValue,
    });
  }

  if (buckets.size === 0) {
    return null;
  }

  return function lookup(latitude, longitude, out = MODEL_SAMPLE_OUT) {
    const centerLatCell = Math.floor(latitude / MODEL_LATTICE_CELL);
    const centerLonCell = Math.floor(longitude / MODEL_LATTICE_CELL);

    let weightedValue = 0;
    let totalWeight = 0;
    let nearestDistanceSquared = Infinity;

    for (let dLat = -2; dLat <= 2; dLat++) {
      for (let dLon = -2; dLon <= 2; dLon++) {
        const bucket = buckets.get(
          centerLatCell + dLat + "," + (centerLonCell + dLon)
        );

        if (!bucket) {
          continue;
        }

        for (const point of bucket) {
          let dLonValue = point.longitude - longitude;
          if (dLonValue > 180) dLonValue -= 360;
          if (dLonValue < -180) dLonValue += 360;

          const dLatValue = point.latitude - latitude;

          const distanceSquared =
            dLatValue * dLatValue +
            dLonValue * dLonValue;

          if (distanceSquared > MODEL_BLEND_CUTOFF_SQ) {
            continue;
          }

          if (distanceSquared < nearestDistanceSquared) {
            nearestDistanceSquared = distanceSquared;
          }

          const weight =
            1 /
            (distanceSquared + MODEL_BLEND_EPSILON);

          weightedValue += point.value * weight;
          totalWeight += weight;
        }
      }
    }

    if (totalWeight <= 0 || nearestDistanceSquared === Infinity) {
      return null;
    }

    out.value = weightedValue / totalWeight;
    out.nearestDistanceSquared = nearestDistanceSquared;

    return out;
  };
}


/* ============================================================
   OCEAN-ONLY REGION CHECK
============================================================ */

/*
  Results are memoized at 0.5-degree resolution: the mask is
  coarse by design, and the texture loop hits ~65k pixels on
  every depth change — caching keeps rebuilds fast, which is
  part of the flicker fix.
*/
const OCEAN_REGION_CACHE = new Map();

function isOceanRegion(lat, lon) {
  /*
    COASTLINE MASK (src/data/landMask.js):
    The previous rectangle test treated lat 6-35 / lon 68-90
    as land, which painted most of the Arabian Sea and the
    Bay of Bengal as "land" and left the temperature field
    an incomplete patch. The polygon mask follows the actual
    Indian Ocean coastlines instead.
  */
  const key =
    Math.round(lat * 2) * 1000 +
    Math.round(lon * 2);

  const cached = OCEAN_REGION_CACHE.get(key);

  if (cached !== undefined) {
    return cached;
  }

  const result = !isLandPoint(lat, lon);

  OCEAN_REGION_CACHE.set(key, result);

  return result;
}


/* ============================================================
   TEMPERATURE DATA HELPERS

   The overlay is a real spherical surface, not a shell/rim effect.

   Data priority per ocean cell:
   1. Nearby Argo temperature observation
   2. Backend model temperature point
   3. Visual fallback only when neither source has data

   IMPORTANT:
   The temperature field is rendered slightly above Sentinel-2
   and samples an equirectangular data texture using the sphere's
   actual surface position -> latitude/longitude.
============================================================ */

const TEMPERATURE_OVERLAY_RADIUS =
  DETAIL_SATELLITE_RADIUS + 0.004;

function getArgoTemperature(observation) {
  if (!observation || typeof observation !== "object") {
    return null;
  }

  const directKeys = [
    "temperature",
    "temp",
    "sea_surface_temperature",
    "temperature_c",
    "temp_c",
    "TEMP",
    "TEMP_ADJUSTED",
    "temp_adjusted",
  ];

  for (const key of directKeys) {
    const value = Number(observation[key]);
    if (Number.isFinite(value) && value >= -5 && value <= 45) {
      return value;
    }
  }

  /*
    Some observation APIs return:
      { variable: "temperature", value: 28.4 }
  */
  const variableName = String(
    observation.variable ||
    observation.parameter ||
    observation.name ||
    ""
  ).toLowerCase();

  if (
    variableName.includes("temp") ||
    variableName.includes("temperature")
  ) {
    const value = Number(observation.value);
    if (Number.isFinite(value) && value >= -5 && value <= 45) {
      return value;
    }
  }

  /*
    Support a simple nested measurement array if the backend
    exposes Argo profile samples this way.
  */
  const measurements =
    observation.measurements ||
    observation.profile ||
    observation.data;

  if (Array.isArray(measurements)) {
    let shallowest = null;

    for (const sample of measurements) {
      if (!sample || typeof sample !== "object") continue;

      const sampleTemperature =
        Number(
          sample.temperature ??
          sample.temp ??
          sample.TEMP ??
          sample.TEMP_ADJUSTED
        );

      if (
        !Number.isFinite(sampleTemperature) ||
        sampleTemperature < -5 ||
        sampleTemperature > 45
      ) {
        continue;
      }

      const sampleDepth =
        Number(
          sample.depth ??
          sample.pressure ??
          sample.z ??
          999999
        );

      if (
        !Number.isFinite(sampleDepth) ||
        sampleDepth < 0
      ) {
        continue;
      }

      if (
        shallowest === null ||
        sampleDepth < shallowest.depth
      ) {
        shallowest = {
          depth: sampleDepth,
          temperature: sampleTemperature,
        };
      }
    }

    if (shallowest) {
      return shallowest.temperature;
    }
  }

  return null;
}


/* ============================================================
   ARGO WEIGHTED TEMPERATURE
============================================================ */

/*
  Build a depth-filtered list of Argo temperature samples
  near the requested depth. Argo returns one row per
  pressure level (0-2000 dbar); without filtering, surface
  and deep-water temperatures were averaged together.
*/
function collectDepthFilteredArgo(
  argoObservations,
  depth
) {
  if (
    !Array.isArray(argoObservations) ||
    argoObservations.length === 0
  ) {
    return [];
  }

  const samples = [];

  for (const observation of argoObservations) {
    const oLat = Number(observation?.latitude);
    const oLon = Number(observation?.longitude);
    const oDepth = Number(observation?.depth);
    const temperature = getArgoTemperature(observation);

    if (
      !Number.isFinite(oLat) ||
      !Number.isFinite(oLon) ||
      !Number.isFinite(temperature)
    ) {
      continue;
    }

    /* Observed depth is in dbar (~ metres); the model grid
       uses metres. Tolerance covers sparse float sampling. */
    if (
      Number.isFinite(oDepth) &&
      Math.abs(oDepth - depth) > 50
    ) {
      continue;
    }

    samples.push({
      latitude: oLat,
      longitude: oLon,
      temperature,
    });
  }

  return samples;
}


/*
  Gaussian-weighted scatter-field interpolation over the
  depth-filtered Argo samples.

  Samples are bucketed into a coarse 5-degree lat/lon lattice
  ONCE per texture build; a pixel then blends only the few
  floats in its surrounding cells instead of scanning every
  sample (the old O(samples) per-pixel scan stalled each
  rebuild — the visible flicker).

  Returns null, or { value, confidence } where confidence
  (0-1, from the weight mass) feathers pixel alpha so the
  field fades where floats are sparse instead of ending in
  hard edges or holes.
*/

const ARGO_LATTICE_CELL = 5;
const ARGO_BLEND_CUTOFF_SQ = 100; /* 10-degree reach, as before */
const ARGO_BLEND_SIGMA_SQ = 32; /* 2 * sigma², sigma = 4 deg */

const ARGO_SAMPLE_OUT = { value: 0, confidence: 0 };

function buildArgoTemperatureLookup(argoSamples) {
  if (
    !Array.isArray(argoSamples) ||
    argoSamples.length === 0
  ) {
    return null;
  }

  const buckets = new Map();

  for (const sample of argoSamples) {
    const sLat = Number(sample?.latitude);
    const sLon = Number(sample?.longitude);
    const sValue = Number(sample?.temperature);

    if (
      !Number.isFinite(sLat) ||
      !Number.isFinite(sLon) ||
      !Number.isFinite(sValue)
    ) {
      continue;
    }

    const key =
      Math.floor(sLat / ARGO_LATTICE_CELL) +
      "," +
      Math.floor(sLon / ARGO_LATTICE_CELL);

    let bucket = buckets.get(key);

    if (!bucket) {
      bucket = [];
      buckets.set(key, bucket);
    }

    bucket.push({
      latitude: sLat,
      longitude: sLon,
      value: sValue,
    });
  }

  if (buckets.size === 0) {
    return null;
  }

  /*
    ±2 cells of a 5-degree lattice covers the original
    10-degree gaussian reach.
  */
  return function lookup(latitude, longitude, out = ARGO_SAMPLE_OUT) {
    const centerLatCell = Math.floor(latitude / ARGO_LATTICE_CELL);
    const centerLonCell = Math.floor(longitude / ARGO_LATTICE_CELL);

    let weightedTemperature = 0;
    let totalWeight = 0;

    for (let dLat = -2; dLat <= 2; dLat++) {
      for (let dLon = -2; dLon <= 2; dLon++) {
        const bucket = buckets.get(
          centerLatCell + dLat + "," + (centerLonCell + dLon)
        );

        if (!bucket) {
          continue;
        }

        for (const sample of bucket) {
          let dLonValue = sample.longitude - longitude;
          if (dLonValue > 180) dLonValue -= 360;
          if (dLonValue < -180) dLonValue += 360;

          const distanceSquared =
            (sample.latitude - latitude) *
              (sample.latitude - latitude) +
            dLonValue * dLonValue;

          if (distanceSquared > ARGO_BLEND_CUTOFF_SQ) {
            continue;
          }

          const weight = Math.exp(
            -distanceSquared / ARGO_BLEND_SIGMA_SQ
          );

          weightedTemperature += sample.value * weight;
          totalWeight += weight;
        }
      }
    }

    if (totalWeight <= 0) {
      return null;
    }

    out.value = weightedTemperature / totalWeight;
    out.confidence = Math.min(totalWeight, 1);

    return out;
  };
}


/* ============================================================
   FALLBACK ONLY
============================================================ */

function createTemperatureFallback(
  latitude,
  longitude,
  depth
) {
  const latitudeWarmth =
    31.5 -
    Math.abs(latitude - 5) * 0.26;

  const basinVariation =
    Math.sin(
      (longitude + 35) *
        Math.PI /
        55
    ) * 1.8 +
    Math.cos(
      (longitude - 80) *
        Math.PI /
        95
    ) * 1.2;

  const equatorialWarmBand =
    Math.exp(
      -Math.pow(
        (latitude - 2) / 12,
        2
      )
    ) * 2.2;

  const depthCooling =
    Math.min(depth, 2000) * 0.004;

  return THREE.MathUtils.clamp(
    latitudeWarmth +
      basinVariation +
      equatorialWarmBand -
      depthCooling,
    4,
    34
  );
}


/* ============================================================
   TEMPERATURE DATA TEXTURE

   Equirectangular RGBA texture:
     RGB = final temperature color
     A   = ocean-data visibility mask

   The shader below samples this using the actual sphere surface
   position, so the colors stay on the curved globe instead of
   becoming a camera-facing/rim effect.
============================================================ */

/* ============================================================
   DATASET FOOTPRINT

   Geographic bounding box of the actual backend data (Argo
   observations + model grid). The temperature field is painted
   ONLY inside this extent — a pixel outside the dataset is
   never colored, so continents far from any measurement can
   never receive a temperature value.
============================================================ */

function buildDatasetFootprint(
  modelPoints,
  argoSamples,
  padDegrees = 8
) {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;
  let hasData = false;

  const consider = (lat, lon) => {
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lon)
    ) {
      return;
    }

    hasData = true;

    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
  };

  for (const point of modelPoints || []) {
    consider(
      Number(point?.latitude),
      Number(point?.longitude)
    );
  }

  for (const sample of argoSamples || []) {
    consider(
      sample.latitude,
      sample.longitude
    );
  }

  if (!hasData) {
    return null;
  }

  /*
    Pad by the interpolation reach so the field ends where
    the data reasonably fades out, not at the raw points.
  */
  return {
    minLat: minLat - padDegrees,
    maxLat: maxLat + padDegrees,
    minLon: minLon - padDegrees,
    maxLon: maxLon + padDegrees,
  };
}


function createTemperatureDataTexture({
  depth = 0,
  modelPoints = [],
  argoObservations = [],
}) {
  const width = 512;
  const height = 256;

  const pixels =
    new Uint8Array(
      width * height * 4
    );

  /*
    Drop any observation whose coordinate falls on land so a
    bad row can never bleed color onto a coastline. One-time
    cost, never per frame.
  */
  const oceanArgoObservations =
    Array.isArray(argoObservations)
      ? argoObservations.filter(
          (observation) => {
            const oLat =
              Number(
                observation?.latitude
              );

            const oLon =
              Number(
                observation?.longitude
              );

            return (
              Number.isFinite(oLat) &&
              Number.isFinite(oLon) &&
              isOceanRegion(oLat, oLon)
            );
          }
        )
      : [];

  /*
    Same for model grid points.
  */
  const oceanModelPoints =
    modelPoints.filter((point) => {
      const pLat = Number(point?.latitude);
      const pLon = Number(point?.longitude);        return (
          Number.isFinite(pLat) &&
          Number.isFinite(pLon) &&
          isOceanRegion(pLat, pLon)
        );
    });

  const modelLookup =
    buildTemperatureModelLookup(
      oceanModelPoints
    );

  /*
    Depth-filtered Argo samples for the requested level.
  */
  const argoWithTemperature =
    collectDepthFilteredArgo(
      oceanArgoObservations,
      depth
    );

  /*
    Both data lookups bucket their samples ONCE per texture
    build (never per pixel, never per frame), so a depth
    change rebuilds the field quickly instead of freezing —
    the visible flicker.
  */
  const argoTemperatureLookup =
    buildArgoTemperatureLookup(
      argoWithTemperature
    );

  /*
    Extent of the data actually used for this texture.

    The footprint gate applies ONLY when real model-grid data
    exists (the grid defines the true dataset extent). In demo
    mode (model NetCDF unavailable, backend serves a few demo
    Argo rows) the footprint would shrink the field to a tiny
    patch around the demo floats — instead the existing Indian
    Ocean fallback field is retained, still ocean-masked.
  */
  const datasetFootprint =
    oceanModelPoints.length > 0
      ? buildDatasetFootprint(
          oceanModelPoints,
          argoWithTemperature
        )
      : null;

  for (let y = 0; y < height; y++) {
    /*
      DataTexture.flipY is false, so row 0 samples at
      v = 0 (the south pole). Row y must hold latitude
      -90 -> +90, not the previous +90 -> -90 ordering
      that rendered the field upside-down.
    */
    const latitude =
      -90 +
      (y / (height - 1)) *
        180;

    for (let x = 0; x < width; x++) {
      let longitude =
        (x / (width - 1)) *
          360 -
        180;

      if (longitude > 180) {
        longitude -= 360;
      }

      const pixelIndex =
        (y * width + x) * 4;

      /*
        LAND MASK:
        Reuse the existing project mask so temperature colors
        remain on ocean surfaces rather than continents.
      */
      const ocean =
        isOceanRegion(
          latitude,
          longitude
        );

      if (!ocean) {
        pixels[pixelIndex] = 0;
        pixels[pixelIndex + 1] = 0;
        pixels[pixelIndex + 2] = 0;
        pixels[pixelIndex + 3] = 0;
        continue;
      }

      /*
        DATASET FOOTPRINT:
        Outside every backend data source the pixel stays
        transparent (alpha 0 -> shader discards), leaving
        Sentinel-2 imagery completely untouched.
      */
      if (
        datasetFootprint &&
        (latitude <
          datasetFootprint.minLat ||
          latitude >
            datasetFootprint.maxLat ||
          longitude <
            datasetFootprint.minLon ||
          longitude >
            datasetFootprint.maxLon)
      ) {
        continue;
      }

      /*
        SOURCE PRIORITY:
        Argo observations take priority over the model around
        their actual locations. Each lookup returns null
        outside its data reach plus a confidence/feather
        factor, so the field fades where data thins out
        instead of ending in a hard edge.
      */
      let temperature = null;
      let alphaFactor = 0;

      const argoSample =
        argoTemperatureLookup &&
        argoTemperatureLookup(
          latitude,
          longitude
        );

      if (argoSample) {
        temperature = argoSample.value;
        alphaFactor = argoSample.confidence;
      }

      if (
        temperature === null &&
        modelLookup
      ) {
        const modelSample = modelLookup(
          latitude,
          longitude
        );

        if (modelSample) {
          temperature = modelSample.value;

          /*
            Feather: full strength within ~0.5 deg of a real
            grid point, fading to nothing at ~2 deg.
          */
          alphaFactor =
            1 -
            THREE.MathUtils.smoothstep(
              modelSample.nearestDistanceSquared,
              0.25,
              4
            );
        }
      }

      if (temperature === null) {
        if (datasetFootprint) {
          /*
            Inside the data footprint but no observation
            reached this pixel: stay transparent instead of
            inventing a value. This is what previously let the
            synthetic fallback wash over landmasses.
          */
          continue;
        }

        /*
          No backend data at all (demo mode): retain the
          existing Indian Ocean fallback, still ocean-masked
          by the coastline polygons above.
        */
        temperature =
          createTemperatureFallback(
            latitude,
            longitude,
            depth
          );

        alphaFactor = 1;
      }

      if (alphaFactor < 0.05) {
        continue;
      }

      const color =
        temperatureToColor(
          temperature
        );

      pixels[pixelIndex] =
        Math.round(color.r * 255);

      pixels[pixelIndex + 1] =
        Math.round(color.g * 255);

      pixels[pixelIndex + 2] =
        Math.round(color.b * 255);

      /*
        Semi-transparent so Sentinel-2 imagery remains
        visible through the thermal field. The alpha is
        scaled by how well-supported the value is, which
        feathers the data boundary.
      */
      pixels[pixelIndex + 3] = Math.round(
        208 * alphaFactor
      );
    }
  }

  const texture =
    new THREE.DataTexture(
      pixels,
      width,
      height,
      THREE.RGBAFormat,
      THREE.UnsignedByteType
    );

  /*
    Palette hexes are baked as raw sRGB bytes and the custom
    shader writes them straight to the framebuffer, so the
    on-globe colors match the TemperatureLegend stops
    exactly. Marking the texture sRGB would double-encode
    and visibly darken the field.
  */

  texture.wrapS =
    THREE.RepeatWrapping;

  texture.wrapT =
    THREE.ClampToEdgeWrapping;

  texture.minFilter =
    THREE.LinearFilter;

  texture.magFilter =
    THREE.LinearFilter;

  texture.generateMipmaps =
    false;

  texture.needsUpdate =
    true;

  return texture;
}


/* ============================================================
   TEMPERATURE SURFACE
============================================================ */

function TemperatureLayer({
  depth = 0,
  radius =
    TEMPERATURE_OVERLAY_RADIUS,
  modelPoints = [],
  argoObservations = [],
}) {
  const materialRef =
    useRef(null);

  const texture =
    useMemo(
      () =>
        createTemperatureDataTexture({
          depth,
          modelPoints,
          argoObservations,
        }),
      [
        depth,
        modelPoints,
        argoObservations,
      ]
    );

  useEffect(() => {
    return () => {
      texture.dispose();
    };
  }, [texture]);

  useFrame(
    ({ clock }) => {
      if (!materialRef.current) {
        return;
      }

      materialRef.current.uniforms.uTime.value =
        clock.elapsedTime;
    }
  );

  return (
    <mesh
      renderOrder={60}
      frustumCulled={false}
    >
      {/*
        A true sphere surface. No custom grid geometry and no
        camera-facing plane, so the field follows the globe.
      */}
      <sphereGeometry
        args={[
          radius,
          256,
          128,
        ]}
      />

      <shaderMaterial
        ref={materialRef}
        transparent
        depthWrite={false}
        depthTest={true}
        side={THREE.FrontSide}
        blending={THREE.NormalBlending}
        uniforms={{
          uTemperature: {
            value: texture,
          },
          uTime: {
            value: 0,
          },
        }}
        vertexShader={`
          varying vec3 vSurfacePosition;

          void main() {
            vSurfacePosition =
              normalize(position);

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
          uniform sampler2D
            uTemperature;

          uniform float
            uTime;

          varying vec3
            vSurfacePosition;

          void main() {
            vec3 p =
              normalize(
                vSurfacePosition
              );

            /*
              This must match satelliteLatLonToVector():
                theta = longitude + 70°
            */
            float latitude =
              asin(
                clamp(
                  p.y,
                  -1.0,
                  1.0
                )
              );

            float longitude =
              atan(
                p.x,
                p.z
              ) -
              radians(70.0);

            /*
              Keep longitude in
              [-PI, PI].
            */
            if (longitude < -3.14159265) {
              longitude +=
                6.28318530;
            }

            if (longitude > 3.14159265) {
              longitude -=
                6.28318530;
            }

            float u =
              longitude /
                6.28318530 +
              0.5;

            float v =
              latitude /
                3.14159265 +
              0.5;

            /*
              Clamp V and wrap U.
            */
            v =
              clamp(
                v,
                0.001,
                0.999
              );

            vec4 field =
              texture2D(
                uTemperature,
                vec2(
                  fract(u),
                  v
                )
              );

            if (field.a < 0.03) {
              discard;
            }

            /*
              Subtle movement ONLY in brightness.
              The scientific temperature position/value is not
              moved around by the animation.
            */
            float flow1 =
              sin(
                p.x * 17.0 +
                p.z * 9.0 +
                p.y * 7.0 +
                uTime * 0.35
              );

            float flow2 =
              sin(
                p.z * 23.0 -
                p.x * 13.0 +
                uTime * 0.22
              );

            float shimmer =
              1.0 +
              flow1 * 0.018 +
              flow2 * 0.010;

            vec3 finalColor =
              clamp(
                field.rgb *
                shimmer,
                0.0,
                1.0
              );

            gl_FragColor =
              vec4(
                finalColor,
                field.a * 0.92
              );
          }
        `}
        toneMapped={false}
      />
    </mesh>
  );
}


/* ============================================================
   SALINITY POINT INFO — ANCHORED

   Small data box pinned to the clicked marker via drei's
   Html (renders in DOM but tracks the 3D point). Replaces
   the old bottom-right floating overlay.
============================================================ */

function AnchoredSalinityInfo({
  point,
  onClose = null,
  lightMode = false,
  /*
    Optional overrides so other point layers (e.g. Sea Surface
    Height) can reuse this anchored info box without duplicating
    it. Defaults preserve the existing Salinity behavior.
  */
  title = "SALINITY",
  unitLabel = "PSU",
  sourceLabel = "CMEMS model grid",
}) {
  const pos = useMemo(
    () =>
      satelliteLatLonToVector(
        point.latitude,
        point.longitude,
        2.04
      ),
    [point.latitude, point.longitude]
  );

  return (
    <group position={pos}>
      <Html
        center
        distanceFactor={8}
        zIndexRange={[40, 30]}
        style={{
          pointerEvents: "auto",
        }}
      >
        <div
          className={
            lightMode
              ? "salinity-info light"
              : "salinity-info"
          }
        >
          <div className="salinity-info-head">

            <div>
              {title}
            </div>

            <button
              type="button"
              className="salinity-info-close"
              onClick={onClose || undefined}
              aria-label="Close salinity details"
            >
              ×
            </button>
          </div>

          <div className="salinity-info-value">
            {point.value.toFixed(2)} {unitLabel}
          </div>

          <div className="salinity-info-row">
            <span>Latitude</span>
            <span>
              {point.latitude.toFixed(2)}°N
            </span>
          </div>

          <div className="salinity-info-row">
            <span>Longitude</span>
            <span>
              {point.longitude.toFixed(2)}°E
            </span>
          </div>

          <div className="salinity-info-row">
            <span>Depth</span>
            <span>{point.depth} m</span>
          </div>

          <div className="salinity-info-row">
            <span>Source</span>
            <span>{sourceLabel}</span>
          </div>

        </div>
      </Html>
    </group>
  );
}


/* ============================================================
   SALINITY LAYER

   Small ocean-only markers driven by real salinity values
   from the backend model-field API. Clicking a marker shows
   the actual dataset value — no invented data.
============================================================ */

function SalinityLayer({
  points = [],
  depth = 0,
  onSelect = null,
}) {
  const meshRef =
    useRef(null);

  const MARKER_RADIUS = 2.04;
  const MARKER_SIZE = 0.014;

  const count = points.length;

  /*
    Instance matrices are written in an effect (not useMemo)
    so the mesh ref is guaranteed to be attached — on first
    mount the ref is still null during render.
  */
  useEffect(() => {
    if (!meshRef.current || count === 0) return;

    const dummy = new THREE.Object3D();

    for (let i = 0; i < count; i++) {
      const pt = points[i];

      /* Points come from the model-field grid; keep only
         genuine ocean locations. */
      if (isOceanRegion(pt.latitude, pt.longitude)) {
        const pos = satelliteLatLonToVector(
          pt.latitude,
          pt.longitude,
          MARKER_RADIUS
        );

        dummy.position.copy(pos);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();

        meshRef.current.setMatrixAt(i, dummy.matrix);
      } else {
        /* Park land instances at the globe centre. */
        dummy.position.set(0, 0, 0);
        dummy.scale.setScalar(0.0001);
        dummy.updateMatrix();

        meshRef.current.setMatrixAt(i, dummy.matrix);
      }
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [points, count]);

  /*
    Very subtle breathing so the field feels alive.
    Scales only the visual size — never the data — and stays
    tiny/slow per the ocean-drift requirement.
  */
  useFrame(({ clock }) => {
    if (!meshRef.current || count === 0) return;

    const t = clock.elapsedTime;
    const pulse = 0.95 + Math.sin(t * 0.6) * 0.05;

    meshRef.current.scale.setScalar(pulse);
  });

  if (count === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[null, null, count]}
      frustumCulled={false}
      renderOrder={28}
      onClick={(event) => {
        if (!onSelect) return;

        const index = event.instanceId;

        if (index !== undefined && points[index]) {
          event.stopPropagation();

          /*
            Model-field points carry no per-point depth; the
            request depth is the true depth of every value in
            this batch, so attach it for the info box.
          */
          onSelect({
            ...points[index],
            depth,
          });
        }
      }}
    >
      <sphereGeometry args={[MARKER_SIZE, 8, 8]} />
      <meshBasicMaterial
        color="#ffffff"
        transparent
        opacity={0.8}
        depthWrite={false}
        depthTest={true}
        toneMapped={false}
      />
    </instancedMesh>
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

  /*
    SMOOTH TILE FADE-IN:
    Each tile starts fully transparent and animates to opaque
    once its texture arrives, so tiles crossfade over the base
    globe instead of popping in one by one.
  */
  const meshRef = useRef(null);
  const fadeRef = useRef(0);

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

  /*
    Tiles fade in from the base globe color — never pop.
  */
  if (material) {
    material.transparent = true;
    material.opacity = fadeRef.current;
  }

  useFrame((_, delta) => {
    const mesh = meshRef.current;

    if (!mesh || fadeRef.current >= 1) {
      return;
    }

    fadeRef.current = Math.min(
      1,
      fadeRef.current + delta * 1.8
    );

    mesh.material.opacity = fadeRef.current;

    if (fadeRef.current >= 1) {
      /* Fully faded: back to opaque fast-path rendering. */
      mesh.material.transparent = false;
      mesh.material.opacity = 1;
    }
  });

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
      ref={meshRef}
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
   SEA SURFACE HEIGHT LAYER

   Reuses the Salinity marker architecture with the new
   sea_surface_height variable from the same model-field API.
   Rendered only while the layer is active.
============================================================ */

function SeaSurfaceHeightLayer({
  points = [],
  depth = 0,
  onSelect = null,
}) {
  return (
    <SalinityLayer
      points={points}
      depth={depth}
      onSelect={onSelect}
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
    correct lat/lon on the globe surface. Runs in an effect
    so the mesh ref is attached before matrices are written.
  */
  useEffect(() => {
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
  ] = useState(null);

  const [
    depth,
    setDepth,
  ] = useState(0);

  /*
    HEADER DASHBOARD — thin slide-out navigation.
    dashOpen controls the panel; dashSection holds the ONE
    focused section (null = nav menu). Only the selected
    section ever renders — no stacking, no extra overlays.
  */
  const [
    dashOpen,
    setDashOpen,
  ] = useState(false);

  const [
    dashSection,
    setDashSection,
  ] = useState(null);

  /*
    APP BOOT OVERLAY — shows the RATNAKARA logo while the globe
    scene mounts, then fades out once the canvas is alive and
    the first imagery has started arriving. Hard fallback timer
    guarantees the overlay can never stick.
  */
  const [bootReady, setBootReady] = useState(false);
  const [bootGone, setBootGone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let raf = 0;
    const timers = [];
    const start = Date.now();
    let canvasAt = 0;

    const finish = () => {
      if (cancelled) return;
      setBootReady(true);
      timers.push(setTimeout(() => setBootGone(true), 750));
    };

    const poll = () => {
      if (cancelled) return;

      const canvas = document.querySelector(".app canvas");

      if (canvas) {
        if (!canvasAt) canvasAt = Date.now();

        const tileArrived = performance
          .getEntriesByType("resource")
          .some(
            (entry) =>
              /eox\.at/.test(entry.name) &&
              entry.responseEnd > 0
          );

        const minBeat = Date.now() - start > 900;
        const globeSettled =
          tileArrived || Date.now() - canvasAt > 3000;

        if (minBeat && globeSettled) {
          finish();
          return;
        }
      }

      raf = requestAnimationFrame(poll);
    };

    raf = requestAnimationFrame(poll);
    timers.push(setTimeout(finish, 7000));

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
    };
  }, []);

  const [
    expandedLayer,
    setExpandedLayer,
  ] = useState(null);

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
     PHASE 7 — SALINITY LAYER DATA
  ========================================================== */

  const [
    salinityPoints,
    setSalinityPoints,
  ] = useState([]);

  const [
    selectedSalinity,
    setSelectedSalinity,
  ] = useState(null);


  /* ==========================================================
     SEA SURFACE HEIGHT LAYER DATA

     Same model-field API, new variable. Mirrors the Salinity
     state block exactly.
  ========================================================== */

  const [
    sshPoints,
    setSshPoints,
  ] = useState([]);

  const [
    selectedSsh,
    setSelectedSsh,
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


  /*
    When the WARNINGS layer is switched OFF, no warning may
    stay active invisibly — clear the pinpoint and card.
  */

  useEffect(() => {
    if (!visibleLayers.warnings) {
      setActiveWarning(null);
    }
  }, [visibleLayers.warnings]);


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


  /*
    Dashboard handlers. Selecting the open section again
    closes the whole dashboard back to the clean globe.
  */
  const toggleDashboard = () => {
    setDashOpen((open) => !open);
    setDashSection(null);
    setExpandedLayer(null);
  };

  const openDashSection = (name) => {
    if (dashOpen && dashSection === name) {
      setDashOpen(false);
      setDashSection(null);
      setExpandedLayer(null);

      return;
    }

    setDashSection(name);
    setDashOpen(true);
    setExpandedLayer(null);
  };


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
      /*
        SECOND CLICK ALWAYS STOPS:
        Toggling a layer off must work even while the one-shot
        data animation timer is still running — otherwise the
        camera lock swallowed the click and the layer could
        never be turned off with a single press.
      */
      if (
        activeLayer ===
        layerName
      ) {
        clearLayerAnimationTimer();

        setCameraState("idle");

        setActiveLayer(null);

        setCoastalLinesOpen(false);

        /* Closing a layer also closes its info overlay. */
        if (layerName === "Salinity") {
          setSelectedSalinity(null);
        }

        if (layerName === "Sea Surface Height") {
          setSelectedSsh(null);
        }

        return;
      }

      if (
        cameraState !==
        "idle"
      ) {
        return;
      }

      setActiveLayer(
        layerName
      );

      /*
        SINGLE FOCUS RULE:
        Selecting a layer from the Layers list swaps the
        dashboard to that layer's focused view — the Layers
        list does not stack underneath it.
      */

      setSelectedSalinity(null);

      setSelectedSsh(null);

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

      /*
        Clicking the same coastal entry again stops the
        coastal animation: clear the pinpoint/warning card
        and fly back to the default view using the existing
        camera animation.
      */
      if (
        activeLocationKey ===
        locationKey
      ) {
        setActiveWarning(null);

        setSelectedLocation({
          ...DEFAULT_CAMERA,
        });

        setActiveLocationKey(null);

        setActiveLayer(null);

        setCameraState(
          "locationAnimating"
        );

        return;
      }

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

     When a region is selected (Arabian Sea / Bay of Bengal /
     Indian Ocean buttons) its application bounds are sent to
     the backend so only that region's data is displayed.
  ========================================================== */

  /*
    Active application region (from the region navigation
    buttons) — used to scope data fetches and chat context.
    null when no region is selected: the whole dataset is shown.
  */
  const activeRegion =
    activeLocationKey && LOCATIONS[activeLocationKey]
      ? LOCATIONS[activeLocationKey]
      : null;

  useEffect(() => {
    if (activeLayer !== "Temperature") {
      setModelPoints([]);
      setModelLoading(false);
      setModelError(null);
      return;
    }

    let cancelled = false;

    setModelLoading(true);
    setModelError(null);

    fetchModelField({
      variable: "temperature",
      depth: depth,
      time: "2026-06-23T00:00:00",
      max_points: 5000,
      ...(activeRegion
        ? {
            lat_min: activeRegion.bounds.minLat,
            lat_max: activeRegion.bounds.maxLat,
            lon_min: activeRegion.bounds.minLon,
            lon_max: activeRegion.bounds.maxLon,
          }
        : {}),
    })
      .then((data) => {
        if (cancelled) return;

        setModelPoints(
          Array.isArray(data.points)
            ? data.points
            : []
        );

        console.log(
          `[RATNAKARA] model-field: ${data.points.length} points at depth ${data.depth}m`
        );
      })
      .catch((err) => {
        if (cancelled) return;

        console.error("[RATNAKARA] model-field failed:", err);
        setModelPoints([]);
        setModelError(
          err.message || "Failed to load model data"
        );
      })
      .finally(() => {
        if (!cancelled) {
          setModelLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeLayer, depth, activeRegion]);


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
    /* Fetch U/V only while the Currents layer is active. */
    if (activeLayer !== "Currents") {
      setCurrentVectors([]);
      return;
    }

    const time = "2026-06-23T00:00:00";

    Promise.all([
      fetchModelField({
        variable: "u_current",
        depth,
        time,
        max_points: 500,
        ...(activeRegion
          ? {
              lat_min: activeRegion.bounds.minLat,
              lat_max: activeRegion.bounds.maxLat,
              lon_min: activeRegion.bounds.minLon,
              lon_max: activeRegion.bounds.maxLon,
            }
          : {}),
      }),
      fetchModelField({
        variable: "v_current",
        depth,
        time,
        max_points: 500,
        ...(activeRegion
          ? {
              lat_min: activeRegion.bounds.minLat,
              lat_max: activeRegion.bounds.maxLat,
              lon_min: activeRegion.bounds.minLon,
              lon_max: activeRegion.bounds.maxLon,
            }
          : {}),
      }),
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
              /* speed = |uv|, direction = atan2(v, u) — derived from the
                 real model components, not synthesized. */
              speed: Math.sqrt(uVal * uVal + vPt.value * vPt.value),
              direction: Math.atan2(vPt.value, uVal),
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
        setCurrentVectors([]);
      });
  }, [activeLayer, depth, activeRegion]);


  /* ==========================================================
     PHASE 7 — REAL SALINITY DATA

     Fetches salinity from the existing model-field API only
     while the Salinity layer is selected, at the current depth.
  ========================================================== */

  useEffect(() => {
    if (activeLayer !== "Salinity") {
      return;
    }

    let cancelled = false;

    fetchModelField({
      variable: "salinity",
      depth: depth,
      time: "2026-06-23T00:00:00",
      max_points: 5000,
      ...(activeRegion
        ? {
            lat_min: activeRegion.bounds.minLat,
            lat_max: activeRegion.bounds.maxLat,
            lon_min: activeRegion.bounds.minLon,
            lon_max: activeRegion.bounds.maxLon,
          }
        : {}),
    })
      .then((data) => {
        if (!cancelled) {
          setSalinityPoints(data.points);
          console.log(
            `[RATNAKARA] Salinity: ${data.points.length} points at depth ${data.depth}m`
          );
        }
      })
      .catch((err) => {
        console.error("[RATNAKARA] Salinity failed:", err);

        if (!cancelled) {
          setSalinityPoints([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeLayer, depth, activeRegion]);


  /* ==========================================================
     SEA SURFACE HEIGHT DATA

     Fetches the sea_surface_height variable from the same
     model-field API only while the SSH layer is selected.
     Surface variable: depth is reported as 0 m by the API.
  ========================================================== */

  useEffect(() => {
    if (activeLayer !== "Sea Surface Height") {
      return;
    }

    let cancelled = false;

    fetchModelField({
      variable: "sea_surface_height",
      depth: 0,
      time: "2026-06-23T00:00:00",
      max_points: 5000,
      ...(activeRegion
        ? {
            lat_min: activeRegion.bounds.minLat,
            lat_max: activeRegion.bounds.maxLat,
            lon_min: activeRegion.bounds.minLon,
            lon_max: activeRegion.bounds.maxLon,
          }
        : {}),
    })
      .then((data) => {
        if (!cancelled) {
          setSshPoints(data.points);
          console.log(
            `[RATNAKARA] SSH: ${data.points.length} points`
          );
        }
      })
      .catch((err) => {
        console.error("[RATNAKARA] SSH failed:", err);

        if (!cancelled) {
          setSshPoints([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeLayer, activeRegion]);


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
      /*
        Context for data-grounded answers: the selected region and
        parameter let the backend retrieve REAL model/observation values
        (datasets remain the source of truth — Gemini only interprets).
      */
      const layerVariableMap = {
        Temperature: "temperature",
        Salinity: "salinity",
        Currents: "u_current",
        "Sea Surface Height": "sea_surface_height",
      };

      const response = await fetchChat({
        question,
        context: {
          region: activeRegion?.name,
          latitude: selectedLocation?.lat,
          longitude: selectedLocation?.lon,
          depth,
          variable: layerVariableMap[activeLayer],
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
          APP BOOT OVERLAY — branded loading screen
      ====================================================== */}

      {!bootGone && (
        <div
          className={
            bootReady
              ? "app-boot-overlay app-boot-overlay--fade"
              : "app-boot-overlay"
          }
          aria-hidden="true"
        >
          <div className="app-boot-logo">
            <div className="app-boot-mark"></div>
            <h1>RATNAKARA</h1>
            <p>Ocean Intelligence Platform</p>
          </div>
        </div>
      )}

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

        {/*
          LEFT EDGE: the hamburger owns the far left of the
          header; the dashboard slides in from the page's
          left edge underneath it.
        */}
        <div className="dash-header-group">

          <button
            type="button"
            className={
              dashOpen
                ? "dash-toggle open"
                : "dash-toggle"
            }
            onClick={toggleDashboard}
            aria-label="Toggle dashboard"
            title="Dashboard"
          >
            <span></span>
            <span></span>
            <span></span>
          </button>

          <div
            className="dash-logo"
            aria-hidden="true"
          ></div>

          <div className="brand">

            <h1>
              RATNAKARA
            </h1>

            <p>
              Ocean Intelligence Platform
            </p>

          </div>

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
            HEADER DASHBOARD — thin slide-out navigation.

            Opened from the header hamburger. ONE focused
            section renders at a time; closing returns to
            the clean globe. Replaces the old floating
            LAYERS panel.
        ==================================================== */}

        <aside
          className={
            dashOpen
              ? "ocean-dash visible"
              : "ocean-dash"
          }

          aria-hidden={!dashOpen}
        >

          <button
            type="button"
            className="dash-back"

            onClick={() => {
              if (expandedLayer) {
                setExpandedLayer(null);
              }
              else if (dashSection) {
                setDashSection(null);
              }

              else {
                setDashOpen(false);
              }
            }}
          >

            <span className="dash-back-icon">
              {(expandedLayer || dashSection) ? "←" : "✕"}
            </span>

            <span>
              {(expandedLayer || dashSection) ? "BACK" : "CLOSE"}
            </span>

          </button>


          {/* ----------------------------------------------
              NAV MENU — only when no section AND no layer
              is focused, so a selected layer's focused
              view is ever the single visible content.
          ---------------------------------------------- */}

          {dashSection === null &&
            !expandedLayer && (

            <nav className="dash-nav">

              <button
                type="button"
                className="dash-nav-btn"
                onClick={() =>
                  openDashSection("Ocean Layers")
                }
              >
                <span className="dash-nav-icon">🗂</span>
                <span>OCEAN LAYERS</span>
              </button>

              <button
                type="button"
                className="dash-nav-btn"
                onClick={() =>
                  openDashSection("Settings")
                }
              >
                <span className="dash-nav-icon">⚙️</span>
                <span>SETTINGS</span>
              </button>

              <button
                type="button"
                className="dash-nav-btn"
                onClick={() =>
                  openDashSection("Report Analysis")
                }
              >
                <span className="dash-nav-icon">📊</span>
                <span>REPORT ANALYSIS</span>
              </button>

              <button
                type="button"
                className="dash-nav-btn"
                onClick={() =>
                  openDashSection("AI Ocean Assistant")
                }
              >
                <span className="dash-nav-icon">🌊</span>
                <span>AI OCEAN ASSISTANT</span>
              </button>

              <div className="dash-nav-spacer"></div>

              <button
                type="button"
                className="dash-nav-btn dash-nav-small"
                onClick={() =>
                  openDashSection("Profile")
                }
              >
                <span className="dash-nav-icon">👤</span>
                <span>PROFILE</span>
              </button>

              <button
                type="button"
                className="dash-nav-btn dash-nav-small"
                onClick={() =>
                  openDashSection("Logout")
                }
              >
                <span className="dash-nav-icon">⎋</span>
                <span>LOGOUT</span>
              </button>

            </nav>
          )}


          {/* ----------------------------------------------
              LAYERS — only this section renders when
              Layers is selected. Existing layer buttons
              and filter are unchanged.
          ---------------------------------------------- */}

          {dashSection === "Ocean Layers" && (
            <div
              className="dash-content"
              key="OceanLayers"
            >

              <div className="dash-content-title">
                OCEAN LAYERS
              </div>


          {/* ==================================================
              TEMPERATURE — expandable dropdown
          ================================================== */}

          <button
            className={
              activeLayer ===
              "Temperature"
                ? "layer-button selected"
                : "layer-button"
            }

            onClick={() => {
              /*
                Toggle the dropdown AND activate the layer.
                Second click collapses dropdown; layer stays active.
              */
              setExpandedLayer(
                expandedLayer === "Temperature"
                  ? null
                  : "Temperature"
              );
              if (activeLayer !== "Temperature") {
                handleLayerSelect("Temperature");
              }
            }}
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

            <span
              style={{
                marginLeft: "auto",
                fontSize: 10,
                opacity: 0.65,
                transition: "transform 0.2s ease",
                transform:
                  expandedLayer === "Temperature"
                    ? "rotate(180deg)"
                    : "rotate(0deg)",
              }}
            >
              ▾
            </span>

          </button>

          {/* Temperature expanded: depth slider */}
          {expandedLayer === "Temperature" && (
            <div className="dash-content dash-layer-expand" key="TempDepth" style={{ paddingLeft: 12, marginBottom: 6 }}>
              <div className="depth-values">
                <span>Depth</span>
                <strong>{depth} m</strong>
              </div>
              <input
                className="depth-slider"
                type="range"
                min="0"
                max="2000"
                step="50"
                value={depth}
                onChange={(e) => setDepth(Number(e.target.value))}
              />
              <div className="depth-labels">
                <span>0 m</span>
                <span>2000 m</span>
              </div>
              <div className="depth-values" style={{ marginTop: 4 }}>
                <span>Status</span>
                <strong style={{ fontSize: 10 }}>
                  {modelLoading
                    ? "Loading…"
                    : modelError
                      ? "Fallback"
                      : modelPoints.length > 0
                        ? `${modelPoints.length} pts`
                        : "Fallback"}
                </strong>
              </div>
            </div>
          )}


          {/* ==================================================
              SALINITY — expandable dropdown
          ================================================== */}

          <button
            className={
              activeLayer ===
              "Salinity"
                ? "layer-button selected"
                : "layer-button"
            }

            onClick={() => {
              setExpandedLayer(
                expandedLayer === "Salinity"
                  ? null
                  : "Salinity"
              );
              if (activeLayer !== "Salinity") {
                handleLayerSelect("Salinity");
              }
            }}
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

            <span
              style={{
                marginLeft: "auto",
                fontSize: 10,
                opacity: 0.65,
                transition: "transform 0.2s ease",
                transform:
                  expandedLayer === "Salinity"
                    ? "rotate(180deg)"
                    : "rotate(0deg)",
              }}
            >
              ▾
            </span>

          </button>

          {/* Salinity expanded: depth slider */}
          {expandedLayer === "Salinity" && (
            <div className="dash-content dash-layer-expand" key="SalDepth" style={{ paddingLeft: 12, marginBottom: 6 }}>
              <div className="depth-values">
                <span>Depth</span>
                <strong>{depth} m</strong>
              </div>
              <input
                className="depth-slider"
                type="range"
                min="0"
                max="2000"
                step="50"
                value={depth}
                onChange={(e) => setDepth(Number(e.target.value))}
              />
              <div className="depth-labels">
                <span>0 m</span>
                <span>2000 m</span>
              </div>
            </div>
          )}


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
              SEA SURFACE HEIGHT

              New GLORYS variable from the existing model-field
              API. Same marker-layer architecture as Salinity.
          ================================================== */}

          <button
            className={
              activeLayer ===
              "Sea Surface Height"
                ? "layer-button selected"
                : "layer-button"
            }

            onClick={() => {
              if (
                activeLayer ===
                "Sea Surface Height"
              ) {
                clearLayerAnimationTimer();

                setCameraState("idle");

                setActiveLayer(null);

                setSelectedSsh(null);

                return;
              }

              handleLayerSelect(
                "Sea Surface Height"
              );
            }}
          >

            <span className="layer-icon">
              📏
            </span>

            <span>

              <strong>
                Sea Surface Height
              </strong>

              <small>
                GLORYS zos — ocean topography
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
              FILTER ENGINE
          ================================================== */}

          <div className="panel-divider"></div>

          <div className="panel-section-title">
            FILTER ENGINE
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


            </div>
          )}


          {/* ----------------------------------------------
              SETTINGS — focused section (theme toggle)
          ---------------------------------------------- */}

          {dashSection === "Settings" && (
            <div
              className="dash-content"
              key="Settings"
            >

              <div className="dash-content-title">
                SETTINGS
              </div>

              <button
                type="button"
                className="dash-setting-row"
                onClick={() =>
                  setLightMode(
                    (value) => !value
                  )
                }
              >

                <span>
                  Light mode
                </span>

                <span
                  className={
                    lightMode
                      ? "theme-switch light"
                      : "theme-switch"
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
                </span>

              </button>

            </div>
          )}


          {/* ----------------------------------------------
              REPORT ANALYSIS — focused placeholder
          ---------------------------------------------- */}

          {dashSection === "Report Analysis" && (
            <div
              className="dash-content"
              key="Report"
            >

              <div className="dash-content-title">
                REPORT ANALYSIS
              </div>

              <div className="dash-content-note">
                Batch model-vs-Argo validation reports will
                open here.
              </div>

            </div>
          )}


          {/* ----------------------------------------------
              AI OCEAN ASSISTANT — focused placeholder
          ---------------------------------------------- */}

          {dashSection === "AI Ocean Assistant" && (
            <div
              className="dash-content"
              key="AI"
            >

              <div className="dash-content-title">
                AI OCEAN ASSISTANT
              </div>

              <div className="dash-content-note">
                Conversational ocean queries — use the wave
                button bottom-right.
              </div>

            </div>
          )}


          {/* ----------------------------------------------
              PROFILE — focused section, bottom-anchored
          ---------------------------------------------- */}

          {dashSection === "Profile" && (
            <div
              className="dash-content"
              key="Profile"
            >

              <div className="dash-content-title">
                PROFILE
              </div>

              {/*
                ======================================================
                REGISTRATION UI SLOT — PLACEHOLDER
                ======================================================
                Reserved area for the future registration / login UI.
                Replace the div below with your registration component
                when the code is ready, e.g.:

                  import RegisterForm from "./components/RegisterForm";
                  ...
                  <RegisterForm />

                Nothing else in this dashboard needs to change — this
                section already renders when PROFILE is selected.
                ======================================================
              */}
              <div
                className="register-slot"
                id="register-slot"
              >
                <div className="register-slot-icon">👤</div>

                <div className="register-slot-title">
                  Registration coming soon
                </div>

                <div className="register-slot-note">
                  Account creation and sign-in will live here. This
                  panel is reserved for the registration UI.
                </div>

                {/*
                  FUTURE: mount your registration form here, e.g.
                  <RegisterForm onRegister={...} />
                */}
              </div>

            </div>
          )}


          {/* ----------------------------------------------
              LOGOUT — focused action state
          ---------------------------------------------- */}

          {dashSection === "Logout" && (
            <div
              className="dash-content"
              key="Logout"
            >

              <div className="dash-content-title">
                LOGOUT
              </div>

              <div className="dash-content-note">
                You have been signed out.
              </div>

            </div>
          )}

        </aside>


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
              <HorizonStars />
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
                    radius={TEMPERATURE_OVERLAY_RADIUS}
                    modelPoints={modelPoints}
                    argoObservations={argoObservations}
                  />
                )}


              {activeLayer ===
                "Salinity" && (
                  <SalinityLayer
                    points={salinityPoints}
                    depth={depth}
                    onSelect={setSelectedSalinity}
                  />
                )}


              {/* Info box pinned to the clicked marker. */}
              {activeLayer ===
                "Salinity" &&
                selectedSalinity && (
                  <AnchoredSalinityInfo
                    point={selectedSalinity}
                    onClose={() =>
                      setSelectedSalinity(null)
                    }
                    lightMode={
                      lightMode
                    }
                  />
                )}


              {activeLayer ===
                "Sea Surface Height" && (
                  <SeaSurfaceHeightLayer
                    points={sshPoints}
                    depth={0}
                    onSelect={setSelectedSsh}
                  />
                )}


              {/* SSH info box pinned to the clicked marker. */}
              {activeLayer ===
                "Sea Surface Height" &&
                selectedSsh && (
                  <AnchoredSalinityInfo
                    point={selectedSsh}
                    onClose={() =>
                      setSelectedSsh(null)
                    }
                    lightMode={
                      lightMode
                    }
                    title="SEA SURFACE HEIGHT"
                    unitLabel="m"
                    sourceLabel="GLORYS zos"
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


        {/* SALINITY POINT INFO — now anchored to the clicked
            marker inside the Canvas (see AnchoredSalinityInfo);
            the old bottom-right floating overlay is removed. */}


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
              position: "fixed",
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
              position: "fixed",
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
              right: activeWarning ? 348 : 16,
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
              right: activeWarning ? 348 : 16,
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
