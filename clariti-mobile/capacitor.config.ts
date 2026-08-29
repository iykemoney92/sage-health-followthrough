import type { CapacitorConfig } from "@capacitor/cli";

// Clariti is a server-rendered Next.js app (auth proxy, API routes, cookies) —
// it can't be statically exported into the shell, so the WebView loads the live
// deployment directly instead of bundling `www/`. Override with CLARITI_SERVER_URL
// for pointing a dev/staging build at a preview deployment or localhost.
const serverUrl = process.env.CLARITI_SERVER_URL || "https://useclariti.app";

const config: CapacitorConfig = {
  appId: "app.useclariti.mobile",
  appName: "Clariti",
  webDir: "www",
  // With `server.url` pointing at useclariti.app, the WebView's origin is
  // identical to the website's — the server cannot otherwise tell an in-app
  // request from a browser one. Clariti needs to: Guideline 3.1.1 means the web
  // checkout must be unreachable from the app, and that has to be enforced
  // server-side too, not only by the client choosing a different button.
  appendUserAgent: "ClaritiApp",
  server: {
    // "/" rather than a marketing page: Clariti's root IS the product surface
    // (pick a document kind, attach a file), and it opens its own auth modal
    // via ?auth=1 when someone isn't signed in — so there is no separate
    // welcome route to land on the way Nura has.
    url: serverUrl,
    cleartext: false,
    // Capacitor's iOS WebView only treats a top-level navigation as "inside the
    // app" if its URL starts with `server.url` verbatim. Allowlisting the host
    // keeps same-origin navigation (/workspace, /history, /billing) inside the
    // WebView regardless of path, and survives a future change of entry route.
    allowNavigation: [new URL(serverUrl).hostname],
  },
  ios: {
    // "never", not "always": with "always" iOS insets the WebView's scroll view
    // for the safe areas while CSS still measures the full WebView height, so
    // `height: 100dvh` overflows the visible area by the top inset and pushes
    // the bottom of the page — the composer — off screen. The web app sets
    // viewport-fit=cover and pads with env(safe-area-inset-*) throughout, so
    // letting CSS own the insets is the consistent half to keep.
    contentInset: "never",
  },
};

export default config;
