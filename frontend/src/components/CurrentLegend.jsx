/* ============================================================
   CURRENT FLOW LEGEND

   Explains what the moving particles represent:

   CURRENT FLOW
   ← slower — — — faster →

   LOW ─── MEDIUM ─── HIGH

   Borrowing the INFORMATION DESIGN idea from
   SAMUDRA/INCOIS (ocean information hierarchy),
   but visually original to Ratnakara.
============================================================ */


export default function CurrentLegend({ visible = true, lightMode = false }) {
  if (!visible) return null;

  const textColor = lightMode ? "#163743" : "#e2e8f0";
  const mutedColor = lightMode ? "#63818b" : "#94a3b8";
  const bg = lightMode
    ? "rgba(248, 253, 255, 0.88)"
    : "rgba(10, 18, 32, 0.88)";
  const borderColor = lightMode
    ? "rgba(22, 135, 201, 0.15)"
    : "rgba(148, 163, 184, 0.12)";

  const flowColors = [
    { label: "LOW", color: "#bdefff", opacity: 0.4 },
    { label: "MEDIUM", color: "#bdefff", opacity: 0.65 },
    { label: "HIGH", color: "#e6fbff", opacity: 0.9 },
  ];

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
        minWidth: 160,
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
        CURRENT FLOW
      </div>

      {/* Speed arrow */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 8,
          color: mutedColor,
          marginBottom: 8,
        }}
      >
        <span>← slower</span>
        <span>faster →</span>
      </div>

      {/* Intensity indicators */}
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        {flowColors.map((item) => (
          <div
            key={item.label}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <div
              style={{
                width: 14,
                height: 3,
                borderRadius: 2,
                background: item.color,
                opacity: item.opacity,
              }}
            />
            <span style={{ fontSize: 8, color: mutedColor }}>
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
