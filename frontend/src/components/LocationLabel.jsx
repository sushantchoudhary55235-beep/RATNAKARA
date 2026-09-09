/* ============================================================
   LOCATION LABEL

   Shows the coastal location name when a pinpoint
   is selected. Appears centered below the top area.

   Example:
   MUMBAI COAST
   Arabian Sea
============================================================ */


export default function LocationLabel({
  name,
  region,
  visible = false,
  lightMode = false,
}) {
  if (!visible || !name) return null;

  const textColor = lightMode ? "#163743" : "#ffffff";
  const mutedColor = lightMode ? "#52717c" : "#94a3b8";

  return (
    <div
      style={{
        position: "absolute",
        top: 16,
        left: "50%",
        transform: "translateX(-50%)",
        textAlign: "center",
        zIndex: 28,
        pointerEvents: "none",
        fontFamily: 'Inter, "Segoe UI", Arial, sans-serif',
      }}
    >
      <div
        style={{
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: "2px",
          color: textColor,
          textShadow: lightMode
            ? "none"
            : "0 2px 8px rgba(0,0,0,0.6)",
        }}
      >
        {name}
      </div>

      {region && (
        <div
          style={{
            fontSize: 9,
            letterSpacing: "1.2px",
            color: mutedColor,
            marginTop: 2,
            textTransform: "uppercase",
            textShadow: lightMode
              ? "none"
              : "0 1px 4px rgba(0,0,0,0.5)",
          }}
        >
          {region}
        </div>
      )}
    </div>
  );
}
