import { ImageResponse } from "next/og";

// The preview every shared link carries — WhatsApp, iMessage, X, LinkedIn, Slack.
// Drawn in the landing page's own palette (app/clariti-entry.css) so the card and
// the page it opens read as the same thing.
export const alt = "Clariti — understand your health documents";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const kinds = ["Medical bills", "Insurance EOBs", "Lab results", "Scan reports", "Discharge notes"];

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
          background: "#f7faf8",
          color: "#233330",
          fontFamily: "Georgia, 'Times New Roman', serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 22, marginBottom: 44 }}>
          <div
            style={{
              width: 76,
              height: 76,
              borderRadius: 22,
              background: "#4d8d83",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 42,
              fontWeight: 700,
            }}
          >
            C
          </div>
          <div style={{ fontSize: 40, fontWeight: 700 }}>Clariti</div>
        </div>
        <div style={{ fontSize: 68, lineHeight: 1.1, maxWidth: 980 }}>
          Confusing health paperwork, explained in plain language.
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 44 }}>
          {kinds.map((kind) => (
            <div
              key={kind}
              style={{
                display: "flex",
                padding: "12px 22px",
                borderRadius: 999,
                background: "#edf5f2",
                color: "#2f6e66",
                fontSize: 26,
                fontFamily: "Helvetica, Arial, sans-serif",
                fontWeight: 700,
              }}
            >
              {kind}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 40, fontSize: 24, color: "#76827e", fontFamily: "Helvetica, Arial, sans-serif" }}>
          useclariti.app · Explains paperwork. Does not diagnose.
        </div>
      </div>
    ),
    { ...size }
  );
}
