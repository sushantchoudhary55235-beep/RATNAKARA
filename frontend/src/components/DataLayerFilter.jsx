import { useState } from "react";


/* ============================================================
   DATA LAYER FILTER

   Compact overlay control group for toggling
   the three main data visualization layers:

   [ ● CURRENT ]  [ ● TEMPERATURE ]  [ ● WARNINGS ]

   Each layer can be independently enabled/disabled.
   Does not unmount or destroy the underlying globe.
============================================================ */

const LAYERS = [
  { id: "current", label: "CURRENT", icon: "🌊" },
  { id: "temperature", label: "TEMPERATURE", icon: "🌡" },
  { id: "warnings", label: "WARNINGS", icon: "⚠️" },
];


export default function DataLayerFilter({
  visibleLayers,
  onToggleLayer,
  lightMode = false,
}) {
  const bg = lightMode
    ? "rgba(248, 253, 255, 0.92)"
    : "rgba(10, 18, 32, 0.92)";

  const textColor = lightMode ? "#163743" : "#e2e8f0";
  const mutedColor = lightMode ? "#63818b" : "#94a3b8";
  const activeBg = lightMode
    ? "rgba(8, 126, 139, 0.15)"
    : "rgba(59, 130, 246, 0.18)";
  const borderColor = lightMode
    ? "rgba(22, 135, 201, 0.18)"
    : "rgba(148, 163, 184, 0.15)";

  return (
    <div
      style={{
        position: "absolute",
        bottom: 24,
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        alignItems: "center",
        gap: 4,
        padding: "6px 10px",
        background: bg,
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: `1px solid ${borderColor}`,
        borderRadius: 10,
        boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
        zIndex: 25,
        fontFamily: 'Inter, "Segoe UI", Arial, sans-serif',
      }}
    >
      <span
        style={{
          fontSize: 8,
          fontWeight: 700,
          letterSpacing: "1.2px",
          color: mutedColor,
          marginRight: 6,
          whiteSpace: "nowrap",
        }}
      >
        LAYERS
      </span>

      {LAYERS.map((layer) => {
        const isActive = visibleLayers[layer.id];

        return (
          <button
            key={layer.id}
            onClick={() => onToggleLayer(layer.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "5px 10px",
              borderRadius: 7,
              border: "none",
              background: isActive ? activeBg : "transparent",
              color: isActive ? textColor : mutedColor,
              fontSize: 9,
              fontWeight: isActive ? 700 : 500,
              letterSpacing: "0.6px",
              cursor: "pointer",
              transition: "all 0.2s ease",
              whiteSpace: "nowrap",
            }}
            title={`Toggle ${layer.label} layer`}
          >
            <span style={{ fontSize: 11 }}>{layer.icon}</span>
            {layer.label}
          </button>
        );
      })}
    </div>
  );
}
