/**
 * Captures App Store / Play Store screenshots from a running Clariti server.
 *
 * Apple sizes iPhone screenshots at exact pixel dimensions that no ordinary
 * browser window will produce — 6.7" is a 430 × 932 layout at 3×. Driving Chrome
 * over the DevTools Protocol lets us set the device pixel ratio directly, so the
 * output is genuinely rendered at 3× rather than an upscale of a 2× capture.
 *
 * Unlike Nura's equivalent, every interesting Clariti screen is behind auth and
 * needs a document already attached to look like anything, so this signs in
 * first through the app's own modal rather than shooting preview routes.
 *
 * Usage:
 *   pnpm dev
 *   SHOT_EMAIL=you@example.com SHOT_PASSWORD=... pnpm shots
 *
 * The account should be one that already has a saved analysis, a document, and a
 * follow-up — an empty account produces screenshots of empty states.
 */
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9223;
const BASE = process.env.SHOT_BASE_URL ?? "http://localhost:3001";
const EMAIL = process.env.SHOT_EMAIL;
const PASSWORD = process.env.SHOT_PASSWORD;

// fileURLToPath, not .pathname: a repo path containing spaces stays
// percent-encoded in .pathname and would create a literally-named directory.
const OUT_ROOT = fileURLToPath(new URL("../../store-assets/", import.meta.url));

/**
 * The two iPhone sizes App Store Connect requires. Everything else is derived by
 * Apple from these, so shooting more is wasted effort.
 */
const DEVICES = [
  { dir: "clariti-ios-6.7", width: 430, height: 932, scale: 3 },
  { dir: "clariti-ios-6.5", width: 414, height: 896, scale: 3 },
];

/**
 * SHOT_SESSION_ID opens the workspace on a specific saved analysis. Without it
 * /workspace resolves a session client-side and the capture lands on the loading
 * state — a screenshot of a spinner is worse than no screenshot.
 */
const SESSION_ID = process.env.SHOT_SESSION_ID;

const SHOTS = [
  { name: "01-start", path: "/" },
  { name: "02-workspace", path: SESSION_ID ? `/workspace?sessionId=${SESSION_ID}` : "/workspace" },
  { name: "03-history", path: "/history" },
  { name: "04-documents", path: "/documents" },
  { name: "05-plus", path: "/billing" },
];

/** Chrome and app furniture that is not part of the product being shown. */
const HIDE_CSS = `
  .cookie-notice { display: none !important; }
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

function waitForLoad(socket) {
  return new Promise((resolve) => {
    const onMessage = (event) => {
      if (JSON.parse(event.data).method === "Page.loadEventFired") {
        socket.removeEventListener("message", onMessage);
        resolve();
      }
    };
    socket.addEventListener("message", onMessage);
  });
}

async function connect() {
  // Chrome needs a moment before the debugging endpoint answers. Attach to a page
  // target, not the browser endpoint — the browser one has no Page domain.
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

async function evaluate(socket, expression) {
  const { result, exceptionDetails } = await rpc(socket, "Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (exceptionDetails) throw new Error(exceptionDetails.text);
  return result.value;
}

/**
 * Signs in through the modal on `/`.
 *
 * React controls both fields, so setting `.value` directly is not enough — the
 * component's state would never see it and the form would submit empty. Setting
 * through the native setter and dispatching an input event is what React's
 * synthetic event system actually listens for.
 */
async function signIn(socket) {
  await rpc(socket, "Page.navigate", { url: `${BASE}/?auth=1&mode=signin` });
  await waitForLoad(socket);
  await sleep(700);

  const signedIn = await evaluate(
    socket,
    `(async () => {
      const setValue = (element, value) => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
        setter.call(element, value);
        element.dispatchEvent(new Event("input", { bubbles: true }));
      };
      const email = document.querySelector('input[type="email"]');
      const password = document.querySelector('input[type="password"]');
      if (!email || !password) return "no-form";

      setValue(email, ${JSON.stringify(EMAIL)});
      setValue(password, ${JSON.stringify(PASSWORD)});
      email.closest("form").requestSubmit();

      for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 250));
        const status = await fetch("/api/auth/status", { cache: "no-store" }).then((r) => r.json()).catch(() => null);
        if (status?.authenticated) return "ok";
      }
      return "timeout";
    })()`,
  );

  if (signedIn !== "ok") throw new Error(`Sign-in failed (${signedIn}). Check SHOT_EMAIL / SHOT_PASSWORD.`);
}

const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    "--user-data-dir=/tmp/clariti-shot-profile",
    "--hide-scrollbars",
    "--no-first-run",
    "about:blank",
  ],
  { stdio: "ignore" },
);

try {
  if (!EMAIL || !PASSWORD) {
    throw new Error("Set SHOT_EMAIL and SHOT_PASSWORD to an account that already has a saved analysis.");
  }

  const socket = new WebSocket(await connect());
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });

  await rpc(socket, "Page.enable");

  for (const device of DEVICES) {
    await rpc(socket, "Emulation.setDeviceMetricsOverride", {
      width: device.width,
      height: device.height,
      deviceScaleFactor: device.scale,
      mobile: true,
    });

    // Sign in once per device profile: changing the metrics reloads the page but
    // keeps the cookie jar, so this is cheap after the first pass.
    await signIn(socket);

    const outDir = `${OUT_ROOT}${device.dir}/`;
    await mkdir(outDir, { recursive: true });

    for (const shot of SHOTS) {
      await rpc(socket, "Page.navigate", { url: `${BASE}${shot.path}` });
      await waitForLoad(socket);
      await evaluate(
        socket,
        `(() => {
          const style = document.createElement("style");
          style.textContent = ${JSON.stringify(HIDE_CSS)};
          document.head.appendChild(style);
          return document.fonts.ready.then(() => true);
        })()`,
      );
      // Data loads after hydration on every one of these pages. Rather than guess
      // a settle time, wait for the page's own loading copy to disappear — the
      // workspace fetches a document, its messages and its analysis, and takes
      // several times longer than the list pages.
      await evaluate(
        socket,
        `(async () => {
          for (let i = 0; i < 60; i++) {
            const text = document.body.innerText || "";
            const busy = /Loading saved analysis|Getting your document|Checking your account|One moment/i.test(text);
            if (!busy && text.length > 200) return true;
            await new Promise((r) => setTimeout(r, 250));
          }
          return false;
        })()`,
      );
      await sleep(600);

      const { data } = await rpc(socket, "Page.captureScreenshot", {
        format: "png",
        captureBeyondViewport: false,
      });
      await writeFile(`${outDir}${shot.name}.png`, Buffer.from(data, "base64"));
      console.log(`captured ${device.dir}/${shot.name}`);
    }
  }

  socket.close();
} finally {
  chrome.kill();
}
