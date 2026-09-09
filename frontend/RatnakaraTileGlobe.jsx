import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

/*
============================================================
 RATNAKARA TILE GLOBE
 -----------------------------------------------------------
 Custom progressive-detail globe foundation.

 LOD:
   0 = entire globe
   1 = 4 tiles
   2 = 16 tiles
   3 = 64 tiles
   4 = 256 tiles

 At this stage we generate the tile structure and render
 a clean Earth surface. Real imagery comes next.
============================================================
*/

const EARTH_RADIUS = 2;

const MAX_LOD = 4;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/*
------------------------------------------------------------
 Convert geographic coordinates to a point on our sphere.

 We use:
   longitude = -180 ... 180
   latitude  = -90 ... 90
------------------------------------------------------------
*/

function latLonToVector3(lat, lon, radius = EARTH_RADIUS) {
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lon);

  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

/*
------------------------------------------------------------
 Create one curved geographic tile.

 IMPORTANT:
 The tile is generated directly on the sphere instead of
 taking a flat Web Mercator tile and stretching it afterward.

 This avoids the projection problem that caused the old
 NASA implementation to produce black gaps.
------------------------------------------------------------
*/

function createTileGeometry(
  minLat,
  maxLat,
  minLon,
  maxLon,
  segments = 8
) {
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let y = 0; y <= segments; y++) {
    const v = y / segments;

    const lat =
      minLat +
      (maxLat - minLat) * v;

    for (let x = 0; x <= segments; x++) {
      const u = x / segments;

      const lon =
        minLon +
        (maxLon - minLon) * u;

      const point =
        latLonToVector3(
          lat,
          lon
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

  for (let y = 0; y < segments; y++) {
    for (let x = 0; x < segments; x++) {
      const a =
        y * (segments + 1) + x;

      const b = a + 1;

      const c =
        a + (segments + 1);

      const d = c + 1;

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

  geometry.setIndex(indices);

  geometry.computeVertexNormals();

  return geometry;
}

/*
------------------------------------------------------------
 Generate geographic tiles for an LOD.
------------------------------------------------------------
*/

function generateTiles(lod) {
  const count =
    Math.pow(2, lod);

  const tiles = [];

  for (let y = 0; y < count; y++) {
    const minLat =
      -90 + (180 * y) / count;

    const maxLat =
      -90 + (180 * (y + 1)) / count;

    for (let x = 0; x < count; x++) {
      const minLon =
        -180 + (360 * x) / count;

      const maxLon =
        -180 + (360 * (x + 1)) / count;

      tiles.push({
        x,
        y,
        lod,
        minLat,
        maxLat,
        minLon,
        maxLon,
        key: `${lod}/${x}/${y}`,
      });
    }
  }

  return tiles;
}

/*
============================================================
 TILE GLOBE
============================================================
*/

export default function RatnakaraTileGlobe({
  camera,
  textureUrl = "/textures/bluemarble.jpg",
}) {
  const groupRef =
    useRef(null);

  const tilesByLod =
    useMemo(() => {
      const result = {};

      for (
        let lod = 0;
        lod <= MAX_LOD;
        lod++
      ) {
        result[lod] =
          generateTiles(lod);
      }

      return result;
    }, []);

  /*
  ----------------------------------------------------------
   Load base Earth texture.
  ----------------------------------------------------------
  */

  const texture =
    useMemo(() => {
      const loader =
        new THREE.TextureLoader();

      const loaded =
        loader.load(textureUrl);

      loaded.colorSpace =
        THREE.SRGBColorSpace;

      loaded.anisotropy = 4;

      loaded.minFilter =
        THREE.LinearMipmapLinearFilter;

      loaded.magFilter =
        THREE.LinearFilter;

      loaded.generateMipmaps = true;

      return loaded;
    }, [textureUrl]);

  /*
  ----------------------------------------------------------
   Decide LOD from camera distance.

   Far away:
      LOD 0

   Close:
      LOD 4
  ----------------------------------------------------------
  */

  function getLOD() {
    if (!camera) {
      return 0;
    }

    const distance =
      camera.position.length();

    if (distance > 9) return 0;

    if (distance > 6.5) return 1;

    if (distance > 4.8) return 2;

    if (distance > 3.5) return 3;

    return 4;
  }

  const activeLOD =
    clamp(
      getLOD(),
      0,
      MAX_LOD
    );

  /*
  ----------------------------------------------------------
   For now we only render the active tile grid.

   Later we will change this to:

      parent tile
          ↓
      visible children

   so low-resolution tiles remain visible while detailed
   tiles are loading.
  ----------------------------------------------------------
  */

  useEffect(() => {
    return () => {
      texture.dispose();
    };
  }, [texture]);

  const tiles =
    tilesByLod[activeLOD];

  return (
    <group ref={groupRef}>
      {tiles.map((tile) => {
        const geometry =
          createTileGeometry(
            tile.minLat,
            tile.maxLat,
            tile.minLon,
            tile.maxLon,
            4
          );

        return (
          <mesh
            key={tile.key}
            geometry={geometry}
          >
            <meshStandardMaterial
              map={texture}
              roughness={0.9}
              metalness={0}
            />
          </mesh>
        );
      })}
    </group>
  );
}