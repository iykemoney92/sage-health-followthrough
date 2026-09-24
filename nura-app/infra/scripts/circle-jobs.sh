#!/usr/bin/env bash
# Daily Care-circle jobs for the MigoAI production droplet (root crontab, 07:30 UTC).
#
# 1) /api/agent/circle-updates  - Nura writes each watched plan a fresh update once a week
# 2) /api/agent/circle-alerts   - tells opted-in circles about check-ins missed since yesterday
#
# Both routes are idempotent and self-gating, so an extra run never double-sends. Scheduled
# here rather than in vercel.json because Vercel's Hobby tier caps a project at two cron jobs
# and both slots are taken (the check-in backup and trial reminders).
#
# Required env file: /opt/nura/.env  (AGENT_TOOL_SECRET=...)
# Optional: NURA_BASE_URL=https://usenura.app

set -euo pipefail

ENV_FILE="${NURA_ENV_FILE:-/opt/nura/.env}"
LOG_TAG="nura-circle"

if [[ ! -f "$ENV_FILE" ]]; then
  logger -t "$LOG_TAG" "missing env file: $ENV_FILE"
  exit 1
fi

set -a
eval "$(grep -E '^(AGENT_TOOL_SECRET|NURA_BASE_URL)=' "$ENV_FILE" | sed 's/\r$//')"
set +a

BASE="${NURA_BASE_URL:-https://usenura.app}"
SECRET="${AGENT_TOOL_SECRET:-}"
if [[ -z "$SECRET" ]]; then
  logger -t "$LOG_TAG" "AGENT_TOOL_SECRET not set in $ENV_FILE"
  exit 1
fi

FAIL=0
for route in circle-updates circle-alerts; do
  BODY="$(curl -sS --max-time 55 -X POST "$BASE/api/agent/$route" -H "x-agent-secret: $SECRET" -H 'content-type: application/json' -d '{}' || echo '{"ok":false,"error":"curl failed"}')"
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) $route $(echo "$BODY" | head -c 300)"
  if ! echo "$BODY" | grep -q '"ok":true'; then
    logger -t "$LOG_TAG" "$route failed: $(echo "$BODY" | head -c 200)"
    FAIL=1
  fi
done
exit "$FAIL"
