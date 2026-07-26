const BASE_URL = process.env.CLARITI_BASE_URL ?? "http://localhost:3001";
const SECRET = process.env.AGENT_TOOL_SECRET;

if (!SECRET) {
  console.error("[clariti] AGENT_TOOL_SECRET is required.");
  process.exit(1);
}

const response = await fetch(`${BASE_URL}/api/agent/trigger-follow-ups`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-agent-secret": SECRET,
  },
});

const payload = await response.json().catch(() => null);
if (!response.ok || !payload?.ok) {
  console.error("[clariti] trigger failed:", payload?.error ?? response.statusText);
  process.exit(1);
}

const triggered = payload.triggered ?? [];
if (triggered.length === 0) {
  console.log("[clariti] no due follow-ups");
} else {
  for (const item of triggered) {
    if (item.status === "placed") console.log(`[clariti] called follow-up ${item.followUpId} (${item.conversationId ?? "no conversation id"})`);
    else console.log(`[clariti] ${item.status} follow-up ${item.followUpId}${item.error ? `: ${item.error}` : ""}`);
  }
}
