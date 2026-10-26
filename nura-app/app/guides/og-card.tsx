import { ImageResponse } from "next/og";

// Share card for the guides, in the same palette as the site-wide card (app/opengraph-image.tsx).
export const OG_SIZE = { width: 1200, height: 630 };

export function guideOgImage(heading: string, kicker: string) {
  const fontSize = heading.length > 70 ? 54 : heading.length > 48 ? 62 : 70;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 88px",
          background: "#f7f5ef",
          color: "#183129",
          fontFamily: "Helvetica, Arial, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 22, marginBottom: 40 }}>
          <div
            style={{
              width: 76,
              height: 76,
              borderRadius: 22,
              background: "#3f7b57",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 42,
              fontWeight: 700,
            }}
          >
            N
          </div>
          <div style={{ fontSize: 40, fontWeight: 700 }}>Nura</div>
          <div
            style={{
              display: "flex",
              marginLeft: 8,
              padding: "10px 20px",
              borderRadius: 999,
              background: "#edf4eb",
              color: "#2f6847",
              fontSize: 24,
              fontWeight: 700,
            }}
          >
            {kicker}
          </div>
        </div>
        <div style={{ fontSize, lineHeight: 1.12, maxWidth: 1020, fontWeight: 700 }}>{heading}</div>
        <div style={{ marginTop: 44, fontSize: 24, color: "#5f6f68" }}>
          usenura.app/guides · General information, not medical advice.
        </div>
      </div>
    ),
    { ...OG_SIZE },
  );
}
