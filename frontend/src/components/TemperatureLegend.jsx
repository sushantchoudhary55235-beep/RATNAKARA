/* ============================================================
   TEMPERATURE LEGEND

   Compact color bar showing the temperature-to-color mapping:

   4°C  → 12°C → 18°C → 24°C → 28°C → 34°C
   DEEP BLUE → CYAN → YELLOW → ORANGE → RED → MAROON

   Positioned below/near the globe. Does not cover controls.
============================================================ */

const TEMP_STOPS = [
  { temp: "4°C", color: "#0b3d91" },
  { temp: "12°C", color: "#00bcd4" },
  { temp: "18°C", color: "#fdd835" },
  { temp: "24°C", color: "#ff9800" },
  { temp: "28°C", color: "#f44336" },
  { temp: "34°C", color: "#880e4f" },
];


export default function TemperatureLegend({ visible = true, lightMode = false }) {
  if (!visible) return null;

  const textColor = lightMode ? "#163743" : "#e2e8f0";
  const mutedColor = lightMode ? "#63818b" : "#94a3b8";
  const bg = lightMode
    ? "rgba(248, 253, 255, 0.88)"
    : "rgba(10, 18, 32, 0.88)";
  const borderColor = lightMode
    ? "rgba(22, 135, 201, 0.15)"
    : "rgba(148, 163, 184, 0.12)";

  return (
    <div
      style={{
        position: "absolute",
        bottom: 24,
        left: 24,
        padding: "10px 14px",
        background: bg,
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        border: `1px solid ${borderColor}`,
        borderRadius: 10,
        boxShadow: "0 4px 14px rgba(0,0,0,0.16)",
        zIndex: 25,
        fontFamily: 'Inter, "Segoe UI", Arial, sans-serif',
        minWidth: 200,
      }}
    >
      <div
        style={{
          fontSize: 8,
          fontWeight: 700,
          letterSpacing: "1.2px",
          color: mutedColor,
          marginBottom: 8,
        }}
      >
        TEMPERATURE
      </div>

      {/* Color bar */}
      <div
        style={{
          width: "100%",
          height: 8,
          borderRadius: 4,
          background: `linear-gradient(to right, ${TEMP_STOPS.map(
            (s) => s.color
          ).join(", ")})`,
          marginBottom: 4,
        }}
      />

      {/* Labels */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 8,
          color: mutedColor,
        }}
      >
        {TEMP_STOPS.map((s) => (
          <span key={s.temp} style={{ whiteSpace: "nowrap" }}>
            {s.temp}
          </span>
        ))}
      </div>
    </div>
  );
}
