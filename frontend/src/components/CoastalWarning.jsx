import { useRef, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";


/* ============================================================
   GEO HELPER — must match Ratnakara globe orientation
============================================================ */

function latLonToVector3(lat, lon, radius) {
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lon + 70);

  return new THREE.Vector3(
    radius * Math.sin(phi) * Math.sin(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.cos(theta)
  );
}


/* ============================================================
   PINPOINT MARKER (3D)

   A red glowing point with a pulsing ring above the
   Earth surface. Lightweight Three.js objects only.
============================================================ */

export function PinpointMarker({
  latitude,
  longitude,
  visible = false,
  severity = "HIGH",
}) {
  const groupRef = useRef(null);
  const ringRef = useRef(null);
  const glowRef = useRef(null);
  const beaconRef = useRef(null);

  const PINPOINT_RADIUS = 2.04;

  const position = useMemo(
    () => latLonToVector3(latitude, longitude, PINPOINT_RADIUS),
    [latitude, longitude]
  );

  /* Color based on severity */
  const color = useMemo(() => {
    switch (severity) {
      case "CRITICAL":
        return new THREE.Color("#ff0000");
      case "HIGH":
        return new THREE.Color("#ff2419");
      case "MEDIUM":
        return new THREE.Color("#ff8c19");
      default:
        return new THREE.Color("#ff2419");
    }
  }, [severity]);

  /* Animated pulse + ring expansion */
  useFrame((state) => {
    if (!visible || !groupRef.current) return;

    const time = state.clock.elapsedTime;

    /* Core glow pulse */
    if (glowRef.current) {
      const pulseScale = 1 + Math.sin(time * 2.5) * 0.15;
      glowRef.current.scale.setScalar(pulseScale);
      glowRef.current.material.opacity =
        0.55 + Math.sin(time * 2.5) * 0.15;
    }

    /* Ring expansion + fade */
    if (ringRef.current) {
      const ringPhase = (time * 0.8) % 1;
      const ringScale = 1 + ringPhase * 3.5;
      const ringOpacity = (1 - ringPhase) * 0.5;

      ringRef.current.scale.setScalar(ringScale);
      ringRef.current.material.opacity = ringOpacity;
    }

    /* Beacon vertical line pulse */
    if (beaconRef.current) {
      const beaconAlpha = 0.5 + Math.sin(time * 3.0) * 0.2;
      beaconRef.current.material.opacity = beaconAlpha;
    }
  });

  if (!visible) return null;

  return (
    <group ref={groupRef} position={position}>
      {/* Inner glowing point */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[0.018, 16, 16]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.6}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {/* Expanding ring */}
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.015, 0.025, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.4}
          depthWrite={false}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>

      {/* Small vertical beacon */}
      <mesh ref={beaconRef} position={[0, 0.035, 0]}>
        <cylinderGeometry args={[0.002, 0.002, 0.04, 8]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.5}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}


/* ============================================================
   COASTAL WARNING INFORMATION CARD (HTML overlay)

   Renders as an absolutely positioned HTML panel
   over the Three.js canvas. Shows advisory details
   and a satellite image placeholder.
============================================================ */

export function WarningCard({
  advisory,
  onClose,
  lightMode = false,
}) {
  if (!advisory) return null;

  const severityColor = {
    LOW: "#28e56f",
    MEDIUM: "#ff8c19",
    HIGH: "#ff2419",
    CRITICAL: "#ff0000",
  };

  const severityBg = {
    LOW: "rgba(40, 229, 111, 0.10)",
    MEDIUM: "rgba(255, 140, 25, 0.10)",
    HIGH: "rgba(255, 36, 25, 0.10)",
    CRITICAL: "rgba(255, 0, 0, 0.12)",
  };

  const cardBg = lightMode
    ? "rgba(248, 253, 255, 0.96)"
    : "rgba(10, 18, 32, 0.96)";

  const textColor = lightMode ? "#163743" : "#e2e8f0";
  const mutedColor = lightMode ? "#8fadb8" : "#94a3b8";
  const borderColor = lightMode
    ? "rgba(22, 135, 201, 0.20)"
    : "rgba(148, 163, 184, 0.18)";

  const validDate = new Date(advisory.validUntil);
  const validTime = validDate.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        width: 300,
        background: cardBg,
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: `1px solid ${borderColor}`,
        borderRadius: 14,
        boxShadow: "0 12px 40px rgba(0,0,0,0.28)",
        zIndex: 30,
        padding: "16px 18px",
        fontFamily: 'Inter, "Segoe UI", Arial, sans-serif',
        color: textColor,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 12,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: "0.5px",
              color: textColor,
            }}
          >
            {advisory.name}
          </div>
          <div
            style={{
              fontSize: 9,
              letterSpacing: "1.2px",
              color: mutedColor,
              marginTop: 2,
              textTransform: "uppercase",
            }}
          >
            DEMO ADVISORY
          </div>
        </div>

        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            color: mutedColor,
            fontSize: 18,
            cursor: "pointer",
            padding: "0 4px",
            lineHeight: 1,
          }}
          aria-label="Close advisory"
        >
          ×
        </button>
      </div>

      {/* Severity badge */}
      <div
        style={{
          display: "inline-block",
          padding: "3px 10px",
          borderRadius: 6,
          background: severityBg[advisory.severity] || severityBg.MEDIUM,
          color: severityColor[advisory.severity] || severityColor.MEDIUM,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.8px",
          marginBottom: 10,
        }}
      >
        {advisory.title}
      </div>

      {/* Data rows */}
      <div style={{ fontSize: 11, lineHeight: 1.8, color: textColor }}>
        <DataRow
          label="Wave Height"
          value={`${advisory.waveHeight} m`}
          textColor={textColor}
          mutedColor={mutedColor}
        />
        <DataRow
          label="Current"
          value={`${advisory.currentSpeed} m/s`}
          textColor={textColor}
          mutedColor={mutedColor}
        />
        <DataRow
          label="Temperature"
          value={`${advisory.temperature}°C`}
          textColor={textColor}
          mutedColor={mutedColor}
        />
      </div>

      {/* Message */}
      <div
        style={{
          fontSize: 10,
          color: mutedColor,
          margin: "8px 0",
          lineHeight: 1.5,
          borderTop: `1px solid ${borderColor}`,
          paddingTop: 8,
        }}
      >
        {advisory.message}
      </div>

      {/* Valid until */}
      <div
        style={{
          fontSize: 10,
          color: mutedColor,
          marginBottom: 10,
        }}
      >
        Valid until{" "}
        <span style={{ color: textColor, fontWeight: 600 }}>
          {validTime}
        </span>
      </div>

      {/* Satellite image area */}
      <div
        style={{
          width: "100%",
          height: 80,
          borderRadius: 8,
          background: lightMode
            ? "rgba(225, 243, 249, 0.6)"
            : "rgba(30, 41, 59, 0.6)",
          border: `1px solid ${borderColor}`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 3,
        }}
      >
        {advisory.satelliteImage ? (
          <img
            src={advisory.satelliteImage}
            alt={`Satellite view of ${advisory.name}`}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              borderRadius: 8,
            }}
          />
        ) : (
          <>
            <div
              style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: "1px",
                color: mutedColor,
              }}
            >
              SATELLITE VIEW
            </div>
            <div
              style={{
                fontSize: 8,
                color: mutedColor,
              }}
            >
              Imagery unavailable
            </div>
          </>
        )}
      </div>
    </div>
  );
}


/* ============================================================
   DATA ROW HELPER
============================================================ */

function DataRow({ label, value, textColor, mutedColor }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "2px 0",
      }}
    >
      <span style={{ color: mutedColor, fontSize: 10 }}>{label}</span>
      <span style={{ color: textColor, fontWeight: 600, fontSize: 11 }}>
        {value}
      </span>
    </div>
  );
}
