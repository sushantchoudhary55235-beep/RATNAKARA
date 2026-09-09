import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

/* ============================================================
   RATNAKARA EARTH
   Stable base globe before adding satellite tiles
============================================================ */

const EARTH_RADIUS = 2;

export default function RatnakaraTileGlobe({
  mode = "Temperature",
  depth = 100,
}) {
  const earthRef = useRef();
  const atmosphereRef = useRef();

  const [texture, setTexture] = useState(null);

  /* ==========================================================
     LOAD EARTH TEXTURE
  ========================================================== */

  useEffect(() => {
    const loader = new THREE.TextureLoader();

    loader.load(
      "/textures/bluemarble.jpg",

      (loadedTexture) => {
        loadedTexture.colorSpace = THREE.SRGBColorSpace;
        loadedTexture.anisotropy = 8;

        setTexture(loadedTexture);
      },

      undefined,

      (error) => {
        console.error(
          "Ratnakara Earth texture failed to load:",
          error
        );
      }
    );

    return () => {
      setTexture((oldTexture) => {
        if (oldTexture) {
          oldTexture.dispose();
        }

        return null;
      });
    };
  }, []);

  /* ==========================================================
     SMOOTH EARTH ROTATION
  ========================================================== */

  useFrame((_, delta) => {
    if (earthRef.current) {
      earthRef.current.rotation.y += delta * 0.025;
    }

    if (atmosphereRef.current) {
      atmosphereRef.current.rotation.y += delta * 0.012;
    }
  });

  return (
    <group>

      {/* ======================================================
          EARTH
      ====================================================== */}

      <mesh
        ref={earthRef}
        rotation={[0, -0.35, 0]}
      >

        <sphereGeometry
          args={[EARTH_RADIUS, 128, 128]}
        />

        <meshStandardMaterial
          map={texture || undefined}
          color={texture ? "#ffffff" : "#087e8b"}
          roughness={0.85}
          metalness={0}
        />

      </mesh>


      {/* ======================================================
          ATMOSPHERE
      ====================================================== */}

      <mesh
        ref={atmosphereRef}
        scale={[1.035, 1.035, 1.035]}
      >

        <sphereGeometry
          args={[EARTH_RADIUS, 96, 96]}
        />

        <meshBasicMaterial
          color="#4cc9f0"
          transparent
          opacity={0.075}
          side={THREE.BackSide}
        />

      </mesh>


      {/* ======================================================
          OUTER GLOW
      ====================================================== */}

      <mesh
        scale={[1.065, 1.065, 1.065]}
      >

        <sphereGeometry
          args={[EARTH_RADIUS, 64, 64]}
        />

        <meshBasicMaterial
          color="#087e8b"
          transparent
          opacity={0.035}
          side={THREE.BackSide}
        />

      </mesh>

    </group>
  );
}