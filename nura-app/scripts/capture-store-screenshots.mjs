/**
 * Captures App Store / Play Store screenshots from the local dev server.
 *
 * Apple wants 6.5" iPhone shots at exactly 1242 × 2688, which is a 414 × 896
 * layout at 3× — a device pixel ratio no ordinary browser window will give you.
 * Driving Chrome over DevTools Protocol lets us set the ratio directly, so the
 * output is genuinely rendered at 3× rather than an upscale of a 2× capture.
 *
 * Shots come from the /dev preview routes: they carry realistic content, need no
 * account, and are the same components the real screens render.
 *
 * Usage: pnpm dev, then `node scripts/capture-store-screenshots.mjs`
 */
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9222;
const BASE = process.env.SHOT_BASE_URL ?? "http://localhost:3000";
// fileURLToPath, not .pathname: a repo path containing spaces stays
// percent-encoded in .pathname and would create a literally-named directory.
const OUT_DIR = fileURLToPath(new URL("../../store-assets/ios-6.5/", import.meta.url));

// 414 × 896 at 3× — the 6.5" iPhone (XS Max / 11 Pro Max) Apple sizes against.
const WIDTH = 414;
const HEIGHT = 896;
const SCALE = 3;

const SHOTS = [
  { name: "01-today", path: "/dev/desktop-preview?view=today" },
  { name: "02-chat", path: "/dev/chat-preview" },
  { name: "03-plans", path: "/dev/desktop-preview?view=journeys" },
  { name: "04-me", path: "/dev/desktop-preview?view=me" },
  // Not the calendar: its preview renders an empty week, which would be a
  // misleading screenshot. The welcome screen carries the positioning instead.
  { name: "05-welcome", path: "/welcome" },
];

/** Chrome furniture that is not part of the product. */
const HIDE_CSS = `
  .desktop-preview-bar { display: none !important; }
  .cookie-notice { display: none !important; }
  .pull-refresh { display: none !important; }
  .app-update-notice { display: none !important; }
`;

let nextId = 1;
function rpc(socket, method, params = {}) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const onMessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.id !== id) return;
      socket.removeEventListener("message", onMessage);
      if (message.error) reject(new Error(`${method}: ${message.error.message}`));
      else resolve(message.result);
    };
    socket.addEventListener("message", onMessage);
    socket.send(JSON.stringify({ id, method, params }));
  });
}

async function connect() {
  // Chrome needs a moment before the debugging endpoint answers. Attach to a
  // page target, not the browser endpoint — the browser one has no Page domain.
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const targets = await response.json();
      const page = targets.find((target) => target.type === "page" && target.webSocketDebuggerUrl);
      if (page) return page.webSocketDebuggerUrl;
    } catch {
      // Endpoint not up yet.
    }
    await sleep(250);
  }
  throw new Error("Chrome never exposed a page target on its DevTools port");
}

const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    "--user-data-dir=/tmp/nura-shot-profile",
    "--hide-scrollbars",
    "--no-first-run",
    "about:blank",
  ],
  { stdio: "ignore" },
);

try {
  const socket = new WebSocket(await connect());
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });

  await rpc(socket, "Page.enable");
  await rpc(socket, "Emulation.setDeviceMetricsOverride", {
    width: WIDTH,
    height: HEIGHT,
    deviceScaleFactor: SCALE,
    mobile: true,
  });

  await mkdir(OUT_DIR, { recursive: true });

  for (const shot of SHOTS) {
    await rpc(socket, "Page.navigate", { url: `${BASE}${shot.path}` });
    // Wait for the load event rather than a fixed delay, then settle webfonts.
    await new Promise((resolve) => {
      const onMessage = (event) => {
        if (JSON.parse(event.data).method === "Page.loadEventFired") {
          socket.removeEventListener("message", onMessage);
          resolve();
        }
      };
      socket.addEventListener("message", onMessage);
    });
    await rpc(socket, "Runtime.evaluate", {
      expression: `
        (() => {
          const style = document.createElement("style");
          style.textContent = ${JSON.stringify(HIDE_CSS)};
          document.head.appendChild(style);
          return document.fonts.ready.then(() => true);
        })()
      `,
      awaitPromise: true,
    });
    await sleep(400);

    const { data } = await rpc(socket, "Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: false,
    });
    await writeFile(`${OUT_DIR}${shot.name}.png`, Buffer.from(data, "base64"));
    console.log(`captured ${shot.name}`);
  }

  socket.close();
} finally {
  chrome.kill();
}
