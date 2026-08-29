import type { NextConfig } from "next";

// Clariti handles uploaded medical documents, so the defaults matter more here than
// they would on a marketing site. These are the headers that are safe to apply
// globally — anything needing a per-route exception is set on the route itself.
const securityHeaders = [
  // The app is only ever served over HTTPS (Vercel + the Capacitor WebView, which
  // refuses cleartext). Two years with preload is the threshold hstspreload.org
  // requires, and there are no http-only subdomains to break.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Nothing in Clariti is meant to be embedded, and a health document viewer inside
  // someone else's iframe is a clickjacking target.
  { key: "X-Frame-Options", value: "DENY" },
  // Full URLs can carry a session or document id; other origins get the bare origin.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The web app never uses these. The native shell asks for camera and photo access
  // through iOS/Android permissions, not through the Permissions Policy, so denying
  // them here does not affect document attachment in the app.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
];

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],

  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        // Apple fetches this to verify Universal Links and rejects it unless the
        // content type is JSON. The file has no extension (Apple requires that exact
        // path), so Next would otherwise serve it as octet-stream.
        source: "/.well-known/apple-app-site-association",
        headers: [{ key: "Content-Type", value: "application/json" }],
      },
    ];
  },
};

export default nextConfig;
