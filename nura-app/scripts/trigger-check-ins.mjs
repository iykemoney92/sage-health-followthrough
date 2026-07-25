import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const envPath = path.join(rootDir, ".env.local");

if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex === -1) continue;
    const key = trimmed.slice(0, equalsIndex).trim();
    const value = trimmed.slice(equalsIndex + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

const BASE_URL = process.env.NURA_BASE_URL || "http://localhost:3000";
const SECRET = process.env.AGENT_TOOL_SECRET;
const INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS || 10_000);

if (!SECRET) {
  console.error("AGENT_TOOL_SECRET is not set in .env.local. Add it, then re-run this script.");
  process.exit(1);
}

async function tick() {
  try {
    const response = await fetch(`${BASE_URL}/api/agent/trigger-check-ins`, {
      method: "POST",
      headers: { "x-agent-secret": SECRET },
    });
    const body = await response.json().catch(() => null);

    if (!response.ok) {
      console.error(`[nura] trigger check failed (${response.status}):`, body?.error ?? "unknown error");
      return;
    }

    for (const item of body?.triggered ?? []) {
      if (item.status === "placed") {
        console.log(`[nura] 📞 called ${item.toNumber} for "${item.planTitle}" (conversation ${item.conversationId})`);
      } else if (item.status === "failed") {
        console.log(`[nura] ⚠️  call failed for "${item.planTitle}": ${item.error}`);
      } else if (item.status === "skipped_no_phone") {
        console.log(`[nura] ⏭️  skipped "${item.planTitle}" check-in — no linked phone number`);
      }
    }
  } catch (error) {
    console.error("[nura] poll request failed:", error instanceof Error ? error.message : error);
  }
}

console.log(`[nura] polling ${BASE_URL} every ${INTERVAL_MS}ms for due check-ins. Ctrl+C to stop.`);
tick();
setInterval(tick, INTERVAL_MS);
