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


/* ============================================================
   SENTINEL-2 SATELLITE LAYER
   EOX CLOUDLESS SENTINEL-2 IMAGERY

   GLOBAL:
   Complete Sentinel overview.

   DETAIL:
   Higher-resolution Sentinel imagery around:
   - Arabian Sea
   - Bay of Bengal
   - Indian Ocean
============================================================ */

const SATELLITE_RADIUS = 2.008;

const DETAIL_SATELLITE_RADIUS = 2.012;


/* ============================================================
   GLOBAL SENTINEL ZOOM
============================================================ */

const GLOBAL_SATELLITE_ZOOM = 2;


/* ============================================================
   HIGH DETAIL SENTINEL ZOOM
============================================================ */

const DETAIL_SATELLITE_ZOOM = 5;

const DETAIL_ZOOM_DISTANCE = 5.2;


/* ============================================================
   EOX CLOUDLESS SENTINEL-2 TILE SERVICE
============================================================ */

const SATELLITE_TILE_URL =
  "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2025_3857/default/g";


/* ============================================================
   WEB MERCATOR HELPERS
============================================================ */

function lonToTileX(
  lon,
  zoom
) {
  const n =
    Math.pow(
      2,
      zoom
    );

  return (
    ((lon + 180) / 360) *
    n
  );
}


function latToTileY(
  lat,
  zoom
) {
  const n =
    Math.pow(
      2,
      zoom
    );

  const latRad =
    THREE.MathUtils.degToRad(
      lat
    );

  return (
    (
      1 -
      Math.asinh(
        Math.tan(latRad)
      ) /
        Math.PI
    ) /
      2 *
    n
  );
}


function tileXToLon(
  x,
  zoom
) {
  const n =
    Math.pow(
      2,
      zoom
    );

  return (
    (x / n) *
      360 -
    180
  );
}


function tileYToLat(
  y,
  zoom
) {
  const n =
    Math.pow(
      2,
      zoom
    );

  const mercatorY =
    Math.PI -
    (2 * Math.PI * y) /
      n;

  return (
    THREE.MathUtils.radToDeg(
      Math.atan(
        Math.sinh(
          mercatorY
        )
      )
    )
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
   CREATE GAP-FREE SPHERICAL SENTINEL TILE

   The geometry extends by a microscopic amount beyond
   the tile boundary.

   This prevents tiny cracks between adjacent tiles caused
   by floating-point precision on the curved sphere.

   UV coordinates remain clamped to the actual tile image.
============================================================ */

function createSatelliteTileGeometry(
  tileX,
  tileY,
  zoom,
  radius
) {
  const segments = 8;

  const positions = [];

  const uvs = [];

  const indices = [];


  /*
     Tiny geometric overlap.

     This is deliberately very small so neighboring
     imagery remains visually seamless.
  */

  const overlap = 0.0025;


  const startX =
    tileX -
    overlap;

  const endX =
    tileX +
    1 +
    overlap;

  const startY =
    tileY -
    overlap;

  const endY =
    tileY +
    1 +
    overlap;


  for (
    let row = 0;
    row <= segments;
    row++
  ) {
    const v =
      row /
      segments;


    const mercatorY =
      startY +
      v *
        (
          endY -
          startY
        );


    const lat =
      tileYToLat(
        mercatorY,
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


      const mercatorX =
        startX +
        u *
          (
            endX -
            startX
          );


      const lon =
        tileXToLon(
          mercatorX,
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
         Keep texture coordinates inside the
         actual tile image.
      */

      const textureU =
        THREE.MathUtils.clamp(
          mercatorX -
            tileX,
          0,
          1
        );


      const textureV =
        THREE.MathUtils.clamp(
          mercatorY -
            tileY,
          0,
          1
        );


      uvs.push(
        textureU,
        1 -
          textureV
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


  useEffect(() => {
    let mounted = true;


    const loader =
      new THREE.TextureLoader();


    loader.setCrossOrigin(
      "anonymous"
    );


    const tileCount =
      Math.pow(
        2,
        zoom
      );


    /*
       Wrap longitude.

       This prevents missing tiles at the
       international date line.
    */

    const wrappedX =
      (
        tileX %
          tileCount +
        tileCount
      ) %
      tileCount;


    /*
       Never request an invalid latitude tile.
    */

    if (
      tileY < 0 ||
      tileY >= tileCount
    ) {
      setFailed(true);

      return;
    }


    const url =
      `${SATELLITE_TILE_URL}/` +
      `${zoom}/` +
      `${tileY}/` +
      `${wrappedX}.jpg`;


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
          2;


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
          "[Ratnakara] Sentinel-2 tile failed:",
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
  ]);


  /*
     Broken or unavailable tiles are not rendered.

     The base Earth sphere underneath remains visible.
  */

  if (
    failed ||
    !texture
  ) {
    return null;
  }


  const geometry =
    createSatelliteTileGeometry(
      tileX,
      tileY,
      zoom,
      radius
    );


  return (
    <mesh
      geometry={geometry}
      renderOrder={
        radius >
        SATELLITE_RADIUS
          ? 20
          : 10
      }
    >
      <meshBasicMaterial
        map={texture}

        side={
          THREE.FrontSide
        }

        toneMapped={false}

        transparent={false}

        depthWrite={true}

        polygonOffset={true}

        polygonOffsetFactor={
          radius >
          SATELLITE_RADIUS
            ? -1
            : 0
        }

        polygonOffsetUnits={
          radius >
          SATELLITE_RADIUS
            ? -1
            : 0
        }
      />
    </mesh>
  );
}


/* ============================================================
   GLOBAL SENTINEL GLOBE
============================================================ */

function GlobalSatelliteGlobe() {
  const tileMeshes = [];


  const tileCount =
    Math.pow(
      2,
      GLOBAL_SATELLITE_ZOOM
    );


  /*
     GLOBAL ZOOM 2

     4 × 4 = 16 tiles

     Complete global Sentinel overview.
  */

  for (
    let y = 0;
    y < tileCount;
    y++
  ) {
    for (
      let x = 0;
      x < tileCount;
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
    centerTile,
    setCenterTile,
  ] = useState(null);


  const lastState =
    useRef("");


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


        const insideRegion =
          isInsideDeepZoomRegion(
            lat,
            lon
          );


        const shouldShow =
          distance <
            DETAIL_ZOOM_DISTANCE &&
          insideRegion;


        if (!shouldShow) {
          if (
            lastState.current !==
            "hidden"
          ) {
            lastState.current =
              "hidden";


            if (mounted) {
              setCenterTile(
                null
              );
            }
          }


          return;
        }


        const tileXFloat =
          lonToTileX(
            lon,
            DETAIL_SATELLITE_ZOOM
          );


        const tileYFloat =
          latToTileY(
            lat,
            DETAIL_SATELLITE_ZOOM
          );


        const tileX =
          Math.floor(
            tileXFloat
          );


        const tileY =
          Math.floor(
            tileYFloat
          );


        const stateKey =
          `${tileX}-${tileY}`;


        if (
          lastState.current !==
          stateKey
        ) {
          lastState.current =
            stateKey;


          if (mounted) {
            setCenterTile({
              x: tileX,
              y: tileY,
              z:
                DETAIL_SATELLITE_ZOOM,
            });
          }
        }
      };


    updateDetail();


    const interval =
      setInterval(
        updateDetail,
        300
      );


    return () => {
      mounted = false;

      clearInterval(
        interval
      );
    };
  }, [camera]);


  if (!centerTile) {
    return null;
  }


  const tileMeshes = [];


  /*
     5 × 5 high-resolution window.

     This follows the camera as it moves around
     the selected Indian Ocean regions.
  */

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
      tileMeshes.push(
        <SatelliteTile
          key={
            `${centerTile.z}-` +
            `${centerTile.x + x}-` +
            `${centerTile.y + y}`
          }

          tileX={
            centerTile.x + x
          }

          tileY={
            centerTile.y + y
          }

          zoom={
            centerTile.z
          }

          radius={
            DETAIL_SATELLITE_RADIUS
          }
        />
      );
    }
  }


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


      {/* HIGH DETAIL IN TARGET OCEAN REGIONS */}

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
        args={[2, 48, 48]}
      />

      <meshBasicMaterial
        color="#4fb9cf"
        transparent
        opacity={0.10}
        side={THREE.BackSide}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}


/* ============================================================
   OCEAN DATA POINTS
============================================================ */

function OceanGlowPoints() {
  const groupRef = useRef();

  const points = [
    [-1.65, 0.20, 0.92],
    [-1.20, -0.10, 1.42],
    [0.55, -0.45, 1.75],
    [1.15, 0.18, 1.35],
    [0.35, -0.95, 1.50],
  ];

  useFrame((state) => {
    if (!groupRef.current) {
      return;
    }

    const pulse =
      1 +
      Math.sin(
        state.clock.elapsedTime * 2.2
      ) *
        0.15;

    groupRef.current.scale.set(
      pulse,
      pulse,
      pulse
    );
  });

  return (
    <group ref={groupRef}>
      {points.map(
        (position, index) => (
          <mesh
            key={index}
            position={position}
          >
            <sphereGeometry
              args={[0.025, 10, 10]}
            />

            <meshBasicMaterial
              color="#58c7d1"
              transparent
              opacity={0.85}
            />
          </mesh>
        )
      )}
    </group>
  );
}


/* ============================================================
   GEOGRAPHIC POSITION
============================================================ */

function getCameraLatLon(camera) {
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
          position.y / distance,
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
      new THREE.Vector3(0, 0, 0)
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

    const distance = 3.35;

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

    animating.current = true;
  }, [activeLocation]);


  /* ==========================================================
     CAMERA FRAME LOOP
  ========================================================== */

  useFrame((state) => {
    const controls =
      controlsRef.current;

    if (!controls) {
      return;
    }


    /* ========================================================
       FLY ANIMATION
    ======================================================== */

    if (animating.current) {
      state.camera.position.lerp(
        targetPosition.current,
        0.06
      );

      controls.target.lerp(
        targetLookAt.current,
        0.08
      );

      if (
        state.camera.position.distanceTo(
          targetPosition.current
        ) < 0.01
      ) {
        state.camera.position.copy(
          targetPosition.current
        );

        controls.target.copy(
          targetLookAt.current
        );

        animating.current = false;
      }
    }


    /* ========================================================
       DEEP ZOOM CHECK
    ======================================================== */

    const {
      lat,
      lon,
    } = getCameraLatLon(
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

      if (insideDeepRegion) {
        controls.minDistance = 2.08;
      } else {
        controls.minDistance = 2.75;
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

       THIS IS WHAT HANDLES:
       - LEFT MOUSE DRAG = ROTATE
       - MOUSE WHEEL = ZOOM
       - RIGHT MOUSE = DISABLED/PAN OFF
    ======================================================== */

    controls.update();
  });


  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault

      enableRotate={true}
      enableZoom={true}
      enablePan={false}

      enableDamping={true}
      dampingFactor={0.055}

      rotateSpeed={0.8}
      zoomSpeed={0.6}

      minDistance={2.75}
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
  ] = useState("Temperature");

  const [
    depth,
    setDepth,
  ] = useState(0);

  const [
    panelOpen,
    setPanelOpen,
  ] = useState(false);


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

            <span>
              Filter layers...
            </span>

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
            count={600}
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
              -5,
              2,
              4,
            ]}
            intensity={1.4}
          />


          {/* ==================================================
              SENTINEL BASE SPHERE
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
              color="#071923"
            />

          </mesh>


          {/* ==================================================
              GLOBAL SENTINEL-2 SATELLITE IMAGERY
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