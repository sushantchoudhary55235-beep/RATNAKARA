import {
  useEffect,
  useRef,
} from "react";

import {
  useFrame,
  useThree,
} from "@react-three/fiber";

import * as THREE from "three";


/* ============================================================
   RATNAKARA — SENTINEL-2 SATELLITE LAYER

   Source:
   EOX Sentinel-2 Cloudless

   Global Blue Marble remains the base.
   Satellite imagery appears only around:
   - Arabian Sea
   - Bay of Bengal
   - Indian Ocean
============================================================ */


const EARTH_RADIUS = 2.008;


/* ============================================================
   SENTINEL TILE SETTINGS
============================================================ */

const MIN_ZOOM = 2;
const MAX_ZOOM = 5;


/* ============================================================
   SAME REGIONS AS YOUR APP
============================================================ */

const SATELLITE_REGIONS = [
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
   CHECK WHETHER CAMERA IS IN OUR OCEAN AREAS
============================================================ */

function isInsideRegion(lat, lon) {
  return SATELLITE_REGIONS.some(
    (region) =>
      lat >= region.minLat &&
      lat <= region.maxLat &&
      lon >= region.minLon &&
      lon <= region.maxLon
  );
}


/* ============================================================
   CAMERA → LAT/LON

   Matches your App.jsx longitude orientation.
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
   LAT/LON → WEB MERCATOR TILE
============================================================ */

function lonToTileX(lon, zoom) {
  const n =
    Math.pow(2, zoom);

  return Math.floor(
    ((lon + 180) / 360) * n
  );
}


function latToTileY(lat, zoom) {
  const n =
    Math.pow(2, zoom);

  const latRad =
    THREE.MathUtils.degToRad(
      THREE.MathUtils.clamp(
        lat,
        -85.0511,
        85.0511
      )
    );

  return Math.floor(
    (
      1 -
      Math.log(
        Math.tan(latRad) +
        1 / Math.cos(latRad)
      ) /
        Math.PI
    ) /
      2 *
      n
  );
}


/* ============================================================
   TILE → LONGITUDE
============================================================ */

function tileXToLon(x, zoom) {
  return (
    (x /
      Math.pow(2, zoom)) *
      360 -
    180
  );
}


/* ============================================================
   TILE → LATITUDE
============================================================ */

function tileYToLat(y, zoom) {
  const n =
    Math.PI -
    (2 * Math.PI * y) /
      Math.pow(2, zoom);

  return THREE.MathUtils.radToDeg(
    Math.atan(
      Math.sinh(n)
    )
  );
}


/* ============================================================
   LAT/LON → SPHERE POSITION
============================================================ */

function latLonToVector3(
  lat,
  lon,
  radius
) {
  const latRad =
    THREE.MathUtils.degToRad(
      lat
    );

  /*
     +70 is intentionally kept
     because it matches your existing
     App.jsx camera orientation.
  */

  const lonRad =
    THREE.MathUtils.degToRad(
      lon + 70
    );

  return new THREE.Vector3(
    radius *
      Math.cos(latRad) *
      Math.sin(lonRad),

    radius *
      Math.sin(latRad),

    radius *
      Math.cos(latRad) *
      Math.cos(lonRad)
  );
}


/* ============================================================
   CREATE SPHERICAL TILE
============================================================ */

function createTile(
  x,
  y,
  zoom,
  texture
) {
  const west =
    tileXToLon(
      x,
      zoom
    );

  const east =
    tileXToLon(
      x + 1,
      zoom
    );

  const north =
    tileYToLat(
      y,
      zoom
    );

  const south =
    tileYToLat(
      y + 1,
      zoom
    );


  /*
     Higher subdivisions prevent
     the tile from looking flat.
  */

  const segmentsX = 16;
  const segmentsY = 16;

  const positions = [];
  const uvs = [];
  const indices = [];


  for (
    let iy = 0;
    iy <= segmentsY;
    iy++
  ) {
    const v =
      iy / segmentsY;

    const lat =
      north +
      (south - north) * v;


    for (
      let ix = 0;
      ix <= segmentsX;
      ix++
    ) {
      const u =
        ix / segmentsX;

      const lon =
        west +
        (east - west) * u;

      const point =
        latLonToVector3(
          lat,
          lon,
          EARTH_RADIUS
        );

      positions.push(
        point.x,
        point.y,
        point.z
      );

      uvs.push(
        u,
        1 - v
      );
    }
  }


  for (
    let iy = 0;
    iy < segmentsY;
    iy++
  ) {
    for (
      let ix = 0;
      ix < segmentsX;
      ix++
    ) {
      const a =
        iy *
          (segmentsX + 1) +
        ix;

      const b =
        a + 1;

      const c =
        (iy + 1) *
          (segmentsX + 1) +
        ix;

      const d =
        c + 1;


      indices.push(
        a,
        c,
        b,

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


  const material =
    new THREE.MeshBasicMaterial({
      map: texture,

      transparent: true,

      opacity: 1,

      side:
        THREE.FrontSide,

      toneMapped: false,

      depthWrite: false,
    });


  const mesh =
    new THREE.Mesh(
      geometry,
      material
    );


  mesh.renderOrder = 5;


  return mesh;
}


/* ============================================================
   TILE URL
============================================================ */

function getTileURL(
  x,
  y,
  zoom
) {
  return (
    "https://tiles.maps.eox.at/" +
    "wmts/1.0.0/" +
    "s2cloudless-2025_3857/" +
    "default/g/" +
    `${zoom}/${y}/${x}.jpg`
  );
}


/* ============================================================
   SATELLITE COMPONENT
============================================================ */

export default function SatelliteLayer() {
  const {
    camera,
  } = useThree();


  const groupRef =
    useRef(null);


  const tilesRef =
    useRef(new Map());


  const loadingRef =
    useRef(new Set());


  const lastKeyRef =
    useRef("");


  /* ==========================================================
     LOAD TILE
  ========================================================== */

  function loadTile(
    x,
    y,
    zoom
  ) {
    if (!groupRef.current) {
      return;
    }


    const key =
      `${zoom}/${x}/${y}`;


    if (
      tilesRef.current.has(
        key
      )
    ) {
      return;
    }


    if (
      loadingRef.current.has(
        key
      )
    ) {
      return;
    }


    loadingRef.current.add(
      key
    );


    const loader =
      new THREE.TextureLoader();


    loader.setCrossOrigin(
      "anonymous"
    );


    loader.load(
      getTileURL(
        x,
        y,
        zoom
      ),

      (texture) => {
        loadingRef.current.delete(
          key
        );


        texture.colorSpace =
          THREE.SRGBColorSpace;


        texture.minFilter =
          THREE.LinearFilter;


        texture.magFilter =
          THREE.LinearFilter;


        texture.generateMipmaps =
          false;


        texture.needsUpdate =
          true;


        const tile =
          createTile(
            x,
            y,
            zoom,
            texture
          );


        tile.userData.tileKey =
          key;


        tilesRef.current.set(
          key,
          tile
        );


        if (
          groupRef.current
        ) {
          groupRef.current.add(
            tile
          );
        }


        console.log(
          "✅ Sentinel-2 tile loaded:",
          key
        );
      },

      undefined,

      (error) => {
        loadingRef.current.delete(
          key
        );

        console.warn(
          "⚠️ Sentinel-2 tile failed:",
          key,
          error
        );
      }
    );
  }


  /* ==========================================================
     LOAD TILES AROUND CAMERA
  ========================================================== */

  function updateTiles(
    lat,
    lon,
    zoom
  ) {
    const centerX =
      lonToTileX(
        lon,
        zoom
      );

    const centerY =
      latToTileY(
        lat,
        zoom
      );


    /*
       Load a 3 × 3 tile area
       around the camera.

       This prevents visible holes
       while rotating.
    */

    for (
      let dx = -1;
      dx <= 1;
      dx++
    ) {
      for (
        let dy = -1;
        dy <= 1;
        dy++
      ) {
        const x =
          centerX + dx;

        const y =
          centerY + dy;


        const max =
          Math.pow(
            2,
            zoom
          );


        /*
           Wrap longitude.
        */

        const wrappedX =
          (
            x % max +
            max
          ) % max;


        if (
          y < 0 ||
          y >= max
        ) {
          continue;
        }


        loadTile(
          wrappedX,
          y,
          zoom
        );
      }
    }
  }


  /* ==========================================================
     FRAME LOOP
  ========================================================== */

  useFrame(() => {
    if (
      !groupRef.current
    ) {
      return;
    }


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
      isInsideRegion(
        lat,
        lon
      );


    /*
       Satellite imagery starts
       when you're close enough.
    */

    const active =
      insideRegion &&
      distance < 3.7;


    groupRef.current.visible =
      active;


    if (!active) {
      return;
    }


    /*
       Select resolution
       according to camera distance.
    */

    let zoom;


    if (
      distance < 2.65
    ) {
      zoom = 5;
    } else if (
      distance < 3.1
    ) {
      zoom = 4;
    } else {
      zoom = 3;
    }


    zoom =
      THREE.MathUtils.clamp(
        zoom,
        MIN_ZOOM,
        MAX_ZOOM
      );


    const tileX =
      lonToTileX(
        lon,
        zoom
      );

    const tileY =
      latToTileY(
        lat,
        zoom
      );


    const key =
      `${zoom}/${tileX}/${tileY}`;


    /*
       Don't repeatedly request
       the same tile area.
    */

    if (
      key ===
      lastKeyRef.current
    ) {
      return;
    }


    lastKeyRef.current =
      key;


    updateTiles(
      lat,
      lon,
      zoom
    );
  });


  /* ==========================================================
     CLEANUP
  ========================================================== */

  useEffect(() => {
    return () => {
      tilesRef.current.forEach(
        (mesh) => {
          mesh.geometry.dispose();

          if (
            mesh.material.map
          ) {
            mesh.material.map.dispose();
          }

          mesh.material.dispose();
        }
      );


      tilesRef.current.clear();


      loadingRef.current.clear();
    };
  }, []);


  return (
    <group
      ref={groupRef}
      visible={false}
    />
  );
}