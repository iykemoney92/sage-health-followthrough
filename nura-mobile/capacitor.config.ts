import type { CapacitorConfig } from "@capacitor/cli";

// Nura is a server-rendered Next.js app (auth middleware, API routes, cookies) —
// it can't be statically exported into the shell, so the WebView loads the live
// deployment directly instead of bundling `www/`. Override with NURA_SERVER_URL
// for pointing a dev/staging build at a preview deployment or localhost.
const serverUrl = process.env.NURA_SERVER_URL || "https://usenura.app/welcome";

const config: CapacitorConfig = {
  appId: "app.usenura.mobile",
  appName: "Nura",
  webDir: "www",
  server: {
    // /welcome, not "/" — someone opening the app already installed it off
    // a store listing, so they get a fast path into an account instead of
    // the marketing pitch. Signed-in users bounce straight through to
    // /today via middleware.ts (same redirect /login and /signup get).
    url: serverUrl,
    cleartext: false,
    // Capacitor's iOS WebView only treats a top-level navigation as "inside
    // the app" if its URL starts with `server.url` verbatim — since that's
    // scoped to /welcome, navigating to sibling routes like /login or
    // /signup fails that check and gets kicked out to Safari. Allowlisting
    // the host keeps same-origin navigation inside the WebView regardless
    // of path.
    allowNavigation: [new URL(serverUrl).hostname],
  },
  ios: {
    // "never", not "always": with "always" iOS insets the WebView's scroll view
    // for the safe areas while CSS still measures the full WebView height, so
    // `height: 100dvh` overflows the visible area by the top inset and pushes
    // the bottom of the page — the chat composer — off screen. The web app
    // already sets viewport-fit=cover and pads with env(safe-area-inset-*)
    // throughout, so letting CSS own the insets is the consistent half to keep.
    contentInset: "never",
  },
};

export default config;
