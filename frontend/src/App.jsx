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
  useEffect,
  useRef,
  useState,
} from "react";

import * as THREE from "three";

import "./App.css";


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
    lon: 110,
  },

  INDIAN_OCEAN: {
    lat: -10,
    lon: 95,
  },
};

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
    minLat: -5,
    maxLat: 30,
    minLon: 45,
    maxLon: 82,
  },

  {
    name: "Bay of Bengal",
    minLat: -5,
    maxLat: 30,
    minLon: 80,
    maxLon: 115,
  },

  {
    name: "Indian Ocean",
    minLat: -40,
    maxLat: 5,
    minLon: 40,
    maxLon: 125,
  },
];

const INDIAN_COASTAL_PRIORITY = [
  { minLat: 8, maxLat: 25, minLon: 68, maxLon: 75 },
  { minLat: 8, maxLat: 21, minLon: 72, maxLon: 78 },
  { minLat: 8, maxLat: 16, minLon: 73, maxLon: 78 },
  { minLat: 7, maxLat: 13, minLon: 74, maxLon: 78 },
  { minLat: 7, maxLat: 13, minLon: 76, maxLon: 81 },
  { minLat: 8, maxLat: 19, minLon: 77, maxLon: 85 },
  { minLat: 15, maxLat: 22, minLon: 80, maxLon: 88 },
  { minLat: 20, maxLat: 25, minLon: 85, maxLon: 90 },
  { minLat: 5, maxLat: 11, minLon: 78, maxLon: 84 },
];


/* ============================================================
   SATELLITE LAYER
============================================================ */

const SATELLITE_RADIUS = 2.025;

const DETAIL_SATELLITE_RADIUS = 2.030;


/* ============================================================
   GLOBAL SENTINEL ZOOM
============================================================ */

/*
   IMPORTANT:

   We are now using EOX EPSG:4326 / WGS84 tiles.

   This means:

   longitude and latitude map directly onto the globe.

   No Web Mercator reprojection is required.
*/

const GLOBAL_SATELLITE_ZOOM = 2;


/* ============================================================
   HIGH DETAIL SENTINEL ZOOM
============================================================ */

const DETAIL_SATELLITE_ZOOM = 7;

const MEDIUM_SATELLITE_ZOOM = 3;

const MEDIUM_ZOOM_ENTER_DISTANCE = 8;

const MEDIUM_ZOOM_EXIT_DISTANCE = 8.6;

const DETAIL_ZOOM_ENTER_DISTANCE = 4.8;

const DETAIL_ZOOM_EXIT_DISTANCE = 5.4;


/* ============================================================
   EOX CLOUDLESS SENTINEL-2 WGS84 TILE SERVICE
============================================================ */

/*
   OLD:

   s2cloudless-2025_3857/default/g

   NEW:

   s2cloudless-2025/default/WGS84

   EPSG:4326 gives us direct geographic coordinates.

   This removes the Web-Mercator -> sphere reprojection
   from the satellite geometry.
*/

const SATELLITE_TILE_URL =
  "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2025/default/WGS84";


/* ============================================================
   WGS84 TILE HELPERS
============================================================ */

/*
   EOX WGS84 tile pyramid:

   At zoom Z:

   columns = 2^(Z + 1)
   rows    = 2^Z

   This represents the entire:

   longitude = -180 ... +180
   latitude  = +90 ... -90
*/


function wgs84TileCountX(zoom) {
  return Math.pow(2, zoom + 1);
}


function wgs84TileCountY(zoom) {
  return Math.pow(2, zoom);
}


/* ============================================================
   LONGITUDE -> WGS84 TILE X
============================================================ */

function lonToWGS84TileX(
  lon,
  zoom
) {
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


/* ============================================================
   LATITUDE -> WGS84 TILE Y
============================================================ */

function latToWGS84TileY(
  lat,
  zoom
) {
  const tileCount =
    wgs84TileCountY(zoom);

  /*
     WGS84 is linear latitude.

     North = 0
     South = tileCount
  */

  const normalized =
    (90 - lat) / 180;

  return (
    THREE.MathUtils.clamp(
      normalized,
      0,
      0.999999999
    ) *
    tileCount
  );
}


/* ============================================================
   WGS84 TILE X -> LONGITUDE
============================================================ */

function wgs84TileXToLon(
  x,
  zoom
) {
  const tileCount =
    wgs84TileCountX(zoom);

  return (
    (x / tileCount) *
      360 -
    180
  );
}


/* ============================================================
   WGS84 TILE Y -> LATITUDE
============================================================ */

function wgs84TileYToLat(
  y,
  zoom
) {
  const tileCount =
    wgs84TileCountY(zoom);

  return (
    90 -
    (y / tileCount) *
      180
  );
}


/* ============================================================
   BACKWARD-COMPATIBLE HELPERS

   These are retained so the rest of the application
   structure remains familiar.
============================================================ */

function lonToTileX(
  lon,
  zoom
) {
  return lonToWGS84TileX(
    lon,
    zoom
  );
}


function latToTileY(
  lat,
  zoom
) {
  return latToWGS84TileY(
    lat,
    zoom
  );
}


function tileXToLon(
  x,
  zoom
) {
  return wgs84TileXToLon(
    x,
    zoom
  );
}


function tileYToLat(
  y,
  zoom
) {
  return wgs84TileYToLat(
    y,
    zoom
  );
}


/* ============================================================
   LAT/LON TO RATNAKARA GLOBE POSITION
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
   CREATE DIRECT WGS84 SATELLITE TILE GEOMETRY

   IMPORTANT DIFFERENCE:

   There is NO Web-Mercator conversion here.

   The tile boundaries are directly:

   longitude
   latitude

   Therefore neighboring tiles share exactly the same
   geographic edge.
============================================================ */

function createSatelliteTileGeometry(
  tileX,
  tileY,
  zoom,
  radius
) {
  /*
     Higher segments make the curved geographic tile
     follow the sphere more smoothly.

     This is geometry subdivision only.

     It does NOT create additional satellite cells.
  */

  const segments = 16;

  const positions = [];
  const uvs = [];
  const indices = [];


  /*
     Exact tile boundaries.

     NO artificial overlap.

     This is important because overlap was causing
     multiple curved surfaces to compete at their edges.
  */

  const startX =
    tileX;

  const endX =
    tileX + 1;

  const startY =
    tileY;

  const endY =
    tileY + 1;


  /* ==========================================================
     VERTICES
  ========================================================== */

  for (
    let row = 0;
    row <= segments;
    row++
  ) {
    const v =
      row /
      segments;


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
        column /
        segments;


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


      /*
         Direct tile UV.

         No clamping caused by overlap.
      */

      uvs.push(
        u,
        1 - v
      );
    }
  }


  /* ==========================================================
     TRIANGLES
  ========================================================== */

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

      const b =
        a + 1;

      const c =
        a +
        (segments + 1);

      const d =
        c + 1;


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


  geometry.setIndex(
    indices
  );


  geometry.computeVertexNormals();


  return geometry;
}


/* ============================================================
   CLEAN SATELLITE MATERIAL

   NO GAP SHADER.

   NO BLACK-PIXEL DETECTION.

   NO COLOR REPLACEMENT.

   The satellite image is displayed exactly as supplied
   by EOX.
============================================================ */

function createSatelliteMaterial(
  texture
) {
  return new THREE.MeshBasicMaterial({
    map: texture,

    side:
      THREE.FrontSide,

    transparent:
      false,

    opacity:
      1,

    depthWrite:
      true,

    depthTest:
      true,

    toneMapped:
      false,
  });
}


/* ============================================================
   INDIVIDUAL SENTINEL TILE
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


    /*
       Wrap longitude.

       WGS84 has twice as many columns as rows.
    */

    const wrappedX =
      (
        tileX %
          tileCountX +
        tileCountX
      ) %
      tileCountX;


    /*
       Latitude rows do not wrap.
    */

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


    /*
       EOX WGS84 URL:

       /WGS84/{zoom}/{row}/{column}.jpg
    */

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
          8;


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


      (error) => {
        console.warn(
          "[Ratnakara] Sentinel-2 WGS84 tile failed:",
          url,
          error
        );


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
     Dispose geometry/material/texture
     when the tile disappears.
  */

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

      /*
         Detail imagery remains slightly above
         the global imagery.

         The difference is intentionally very small.
      */

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
   GLOBAL SENTINEL GLOBE
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


  /*
     GLOBAL WGS84 ZOOM 2

     8 × 4 = 32 tiles.

     Unlike the previous 3857 implementation,
     these tiles map directly to latitude/longitude.
  */

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
   HIGH-DETAIL SENTINEL LAYER
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

    const updateDetail =
      () => {
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
            distance < MEDIUM_ZOOM_ENTER_DISTANCE
          ) {
            mediumActive.current = true;
          } else if (
            mediumActive.current &&
            distance > MEDIUM_ZOOM_EXIT_DISTANCE
          ) {
            mediumActive.current = false;
          }

          if (
            !detailActive.current &&
            priorityRegion &&
            distance < DETAIL_ZOOM_ENTER_DISTANCE
          ) {
            detailActive.current = true;
          } else if (
            detailActive.current &&
            (
              !priorityRegion ||
              distance > DETAIL_ZOOM_EXIT_DISTANCE
            )
          ) {
            detailActive.current = false;
          }
        } else {
          mediumActive.current = false;
          detailActive.current = false;
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
                        x: mediumTileX,
                        y: mediumTileY,
                        z: MEDIUM_SATELLITE_ZOOM,
                      }
                    : null,
                detail:
                  detailActive.current
                    ? {
                        x: detailTileX,
                        y: detailTileY,
                        z: DETAIL_SATELLITE_ZOOM,
                      }
                    : null,
              }
            : null;

        const stateKey =
          nextState === null
            ? "hidden"
            : JSON.stringify(nextState);

        if (
          lastState.current !==
          stateKey
        ) {
          lastState.current =
            stateKey;

          if (mounted) {
            setCenterTile(nextState);
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

    for (let y = -2; y <= 2; y++) {
      for (let x = -2; x <= 2; x++) {
        const tileX = center.x + x;
        const tileY = center.y + y;

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
    SATELLITE_RADIUS + 0.002,
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
      {/* GLOBAL SENTINEL BASE */}

      <GlobalSatelliteGlobe />


      {/* HIGH DETAIL */}

      <DetailSatelliteLayer />
    </>
  );
}


/* ============================================================
   ATMOSPHERE
============================================================ */

function Atmosphere() {
  return (
    <mesh
      scale={[
        1.055,
        1.055,
        1.055,
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
        color="#4fb9cf"

        transparent

        opacity={0.10}

        side={
          THREE.BackSide
        }

        blending={
          THREE.AdditiveBlending
        }

        depthWrite={false}
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
   GEOGRAPHIC POSITION
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
    ) -
    70;


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
   DEEP-ZOOM REGION CHECK
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
}) {
  const controlsRef =
    useRef(null);


  const targetPosition =
    useRef(
      new THREE.Vector3()
    );


  const targetLookAt =
    useRef(
      new THREE.Vector3(
        0,
        0,
        0
      )
    );


  const animating =
    useRef(false);


  const deepZoomActive =
    useRef(false);


  /* ==========================================================
     FLY TO SELECTED LOCATION
  ========================================================== */

  useEffect(() => {
    if (!activeLocation) {
      return;
    }


    const distance =
      3.35;


    const lat =
      THREE.MathUtils.degToRad(
        activeLocation.lat
      );


    const lon =
      THREE.MathUtils.degToRad(
        activeLocation.lon +
          70
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


  /* ==========================================================
     CAMERA FRAME LOOP
  ========================================================== */

  useFrame(
    (state, delta) => {
      const controls =
        controlsRef.current;


      if (!controls) {
        return;
      }


      /* ========================================================
         SMOOTH FLY ANIMATION
      ======================================================== */

      if (animating.current) {
        const cameraAlpha =
          1 -
          Math.exp(
            -5.5 *
              delta
          );


        const targetAlpha =
          1 -
          Math.exp(
            -6.5 *
              delta
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
        }
      }


      /* ========================================================
         DEEP ZOOM CHECK
      ======================================================== */

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


      /* ========================================================
         ZOOM LIMIT
      ======================================================== */

      if (
        insideDeepRegion !==
        deepZoomActive.current
      ) {
        deepZoomActive.current =
          insideDeepRegion;


        if (
          insideDeepRegion
        ) {
          controls.minDistance =
            2.055;
        } else {
          controls.minDistance =
            2.75;
        }
      }


      /* ========================================================
         SAFETY DISTANCE
      ======================================================== */

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


      /* ========================================================
         ORBIT CONTROLS
      ======================================================== */

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

      zoomSpeed={0.65}

      minDistance={2.055}

      maxDistance={14}

      minPolarAngle={0.05}

      maxPolarAngle={
        Math.PI - 0.05
      }

      autoRotate={false}

      onStart={() => {
        animating.current =
          false;
      }}

    />
  );
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

  const normalizedFilter =
    filterQuery.trim().toLowerCase();

  const matchingHazards =
    normalizedFilter
      ? SEARCHABLE_HAZARDS.filter(
          (hazard) =>
            hazard.name
              .toLowerCase()
              .includes(normalizedFilter) ||
            hazard.description
              .toLowerCase()
              .includes(normalizedFilter)
        )
      : [];

  return (
    <div className="app">

      {/* ======================================================
          HEADER
      ====================================================== */}

      <header className="header">

        <div className="brand">

          <h1>
            RATNAKARA
          </h1>

          <p>
            Ocean Intelligence Platform
          </p>

        </div>


        <nav>

          <button
            onClick={() =>
              setSelectedLocation(
                LOCATIONS.ARABIAN_SEA
              )
            }
          >
            Arabian Sea
          </button>


          <button
            onClick={() =>
              setSelectedLocation(
                LOCATIONS.BAY_OF_BENGAL
              )
            }
          >
            Bay of Bengal
          </button>


          <button
            onClick={() =>
              setSelectedLocation(
                LOCATIONS.INDIAN_OCEAN
              )
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
        >

          <span></span>

          <span></span>

          <span></span>

        </button>


        {/* ====================================================
            LEFT OCEAN PANEL
        ==================================================== */}

        <div
          className={
            panelOpen
              ? "ocean-panel visible"
              : "ocean-panel"
          }
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


          {/* TEMPERATURE */}

          <button
            className={
              activeLayer ===
              "Temperature"
                ? "layer-button selected"
                : "layer-button"
            }

            onClick={() =>
              setActiveLayer(
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


          {/* SALINITY */}

          <button
            className={
              activeLayer ===
              "Salinity"
                ? "layer-button selected"
                : "layer-button"
            }

            onClick={() =>
              setActiveLayer(
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


          {/* CURRENTS */}

          <button
            className={
              activeLayer ===
              "Currents"
                ? "layer-button selected"
                : "layer-button"
            }

            onClick={() =>
              setActiveLayer(
                "Currents"
              )
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


          {/* COASTAL LINES */}

          <button
            className={
              activeLayer ===
              "Coastal Lines"
                ? "layer-button selected"
                : "layer-button"
            }

            onClick={() =>
              setActiveLayer(
                "Coastal Lines"
              )
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

          </button>

          {matchingHazards.length > 0 && (
            <>
              <div className="panel-divider"></div>

              <div className="panel-section-title">
                HAZARDS
              </div>

              {matchingHazards.map(
                (hazard) => (
                  <button
                    key={hazard.name}
                    className={
                      activeLayer === hazard.name
                        ? "layer-button selected"
                        : "layer-button"
                    }
                    onClick={() =>
                      setActiveLayer(
                        hazard.name
                      )
                    }
                  >
                    <span className="layer-icon">
                      {hazard.icon}
                    </span>

                    <span>
                      <strong>
                        {hazard.name}
                      </strong>

                      <small>
                        {hazard.description}
                      </small>
                    </span>
                  </button>
                )
              )}
            </>
          )}


          <div className="panel-divider"></div>


          {/* DEPTH */}

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
            THREE.JS GLOBE
        ==================================================== */}

        <Canvas
          dpr={1}

          camera={{
            position: [
              0,
              0,
              10,
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
          }}
        >

          {/* ==================================================
              BACKGROUND
          ================================================== */}

          <color
            attach="background"
            args={[
              "#020b14",
            ]}
          />


          {/* ==================================================
              STARS
          ================================================== */}

          <Stars
            radius={90}

            depth={55}

            count={1200}

            factor={1.4}

            saturation={0}

            fade

            speed={0.08}
          />


          {/* ==================================================
              LIGHTING
          ================================================== */}

          <ambientLight
            intensity={2.2}
          />


          <directionalLight
            position={[
              5,
              5,
              5,
            ]}

            intensity={3.2}
          />

          <directionalLight
            position={[
              -8,
              5,
              6,
            ]}
            color="#fff1cf"
            intensity={2.4}
          />


          <directionalLight
            position={[
              -5,
              2,
              4,
            ]}

            intensity={1.4}
          />


          {/* ==================================================
              BASIC BLUE OCEAN GLOBE

              ORIGINAL BASE GLOBE PRESERVED
          ================================================== */}

          <mesh>

            <sphereGeometry
              args={[
                2,
                64,
                64,
              ]}
            />

            <meshBasicMaterial
              color="#0b2a36"
            />

          </mesh>


          {/* ==================================================
              GLOBAL SENTINEL-2
          ================================================== */}

          <SatelliteLayer />


          {/* ==================================================
              ATMOSPHERE
          ================================================== */}

          <Atmosphere />


          {/* ==================================================
              OCEAN POINTS
          ================================================== */}

          <OceanGlowPoints />


          {/* ==================================================
              CAMERA
          ================================================== */}

          <CameraController
            activeLocation={
              selectedLocation
            }
          />

        </Canvas>

      </main>

    </div>
  );
}


export default App;
