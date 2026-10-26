import { ImageResponse } from "next/og";

// The preview every shared link carries — WhatsApp, iMessage, X, LinkedIn, Slack.
// Drawn in the landing page's own palette (app/landing.css) so the card and the
// page it opens read as the same thing.
export const alt = "Nura — Care that continues after the appointment.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const steps = ["Tell Nura what’s going on", "It becomes a Care plan", "Check-ins keep it going"];

export default function OpengraphImage() {
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
        <div style={{ display: "flex", alignItems: "center", gap: 22, marginBottom: 44 }}>
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
        </div>
        <div style={{ fontSize: 72, lineHeight: 1.1, maxWidth: 1000, fontWeight: 700 }}>
          Care continues after you leave.
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 44 }}>
          {steps.map((step) => (
            <div
              key={step}
              style={{
                display: "flex",
                padding: "12px 22px",
                borderRadius: 999,
                background: "#edf4eb",
                color: "#2f6847",
                fontSize: 26,
                fontWeight: 700,
              }}
            >
              {step}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 40, fontSize: 24, color: "#5f6f68" }}>
          usenura.app · Organises and checks in. Does not diagnose.
        </div>
      </div>
    ),
    { ...size },
  );
}
