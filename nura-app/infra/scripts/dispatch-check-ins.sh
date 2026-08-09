#!/usr/bin/env bash
# Reliable Nura dispatcher for the MigoAI production droplet.
# Runs every minute via root crontab (same pattern as uptime-check.sh).
#
# 1) Due check-ins → voice / WhatsApp / push
# 2) Upcoming check-in reminders → email + browser push (~1h before)
#
# Required env file: /opt/nura/.env
#   AGENT_TOOL_SECRET=...
# Optional:
#   NURA_DISPATCH_URL=https://usenura.app/api/agent/trigger-check-ins
#   NURA_REMINDER_URL=https://usenura.app/api/agent/check-in-reminders

set -euo pipefail

ENV_FILE="${NURA_ENV_FILE:-/opt/nura/.env}"
LOG_TAG="nura-checkin"

if [[ ! -f "$ENV_FILE" ]]; then
  logger -t "$LOG_TAG" "missing env file: $ENV_FILE"
  echo "missing env file: $ENV_FILE" >&2
  exit 1
fi

# shellcheck disable=SC1090
set -a
# shellcheck disable=SC2046
eval "$(grep -E '^(AGENT_TOOL_SECRET|CRON_SECRET|NURA_DISPATCH_URL|NURA_REMINDER_URL)=' "$ENV_FILE" | sed 's/\r$//')"
set +a

DISPATCH_URL="${NURA_DISPATCH_URL:-https://usenura.app/api/agent/trigger-check-ins}"
REMINDER_URL="${NURA_REMINDER_URL:-https://usenura.app/api/agent/check-in-reminders}"
SECRET="${AGENT_TOOL_SECRET:-}"

if [[ -z "$SECRET" && -n "${CRON_SECRET:-}" ]]; then
  AUTH_HEADER=(-H "Authorization: Bearer ${CRON_SECRET}")
elif [[ -n "$SECRET" ]]; then
  AUTH_HEADER=(-H "x-agent-secret: ${SECRET}")
else
  logger -t "$LOG_TAG" "AGENT_TOOL_SECRET / CRON_SECRET not set in $ENV_FILE"
  echo "AGENT_TOOL_SECRET / CRON_SECRET not set" >&2
  exit 1
fi

post_json() {
  local url="$1"
  local tmp
  tmp="$(mktemp)"
  local code
  code="$(
    curl -sS -o "$tmp" -w '%{http_code}' --max-time 45 -X POST "$url" \
      -H 'content-type: application/json' \
      "${AUTH_HEADER[@]}" \
      -d '{}' || echo "000"
  )"
  echo "$code" "$tmp"
}

summarize_dispatch() {
  python3 - "$1" <<'PY' 2>/dev/null || echo "?"
import json,sys
try:
  data=json.load(open(sys.argv[1]))
except Exception:
  print("?")
  raise SystemExit
items=data.get("triggered") or []
statuses={}
for i in items:
  s=i.get("status") or "unknown"
  statuses[s]=statuses.get(s,0)+1
summary=",".join(f"{k}:{v}" for k,v in sorted(statuses.items())) or "none"
print(f"dispatch n={len(items)} {summary} idle={data.get('idleScheduled',0)}")
PY
}

summarize_reminders() {
  python3 - "$1" <<'PY' 2>/dev/null || echo "?"
import json,sys
try:
  data=json.load(open(sys.argv[1]))
except Exception:
  print("?")
  raise SystemExit
print(
  "reminders emailed={0} pushed={1} skipped={2} fail={3} cand={4}".format(
    data.get("emailed", 0),
    data.get("pushed", 0),
    data.get("skipped", 0),
    data.get("failures", 0),
    data.get("candidates", 0),
  )
)
PY
}

FAIL=0
read -r DISPATCH_CODE DISPATCH_TMP < <(post_json "$DISPATCH_URL")
read -r REMINDER_CODE REMINDER_TMP < <(post_json "$REMINDER_URL")
trap 'rm -f "$DISPATCH_TMP" "$REMINDER_TMP"' EXIT

DISPATCH_SUMMARY="$(summarize_dispatch "$DISPATCH_TMP")"
REMINDER_SUMMARY="$(summarize_reminders "$REMINDER_TMP")"

if [[ "$DISPATCH_CODE" != "200" ]]; then
  BODY="$(tr '\n' ' ' < "$DISPATCH_TMP" | head -c 400)"
  logger -t "$LOG_TAG" "dispatch failed http=${DISPATCH_CODE} body=${BODY}"
  echo "dispatch failed http=${DISPATCH_CODE} body=${BODY}" >&2
  FAIL=1
fi

if [[ "$REMINDER_CODE" != "200" ]]; then
  BODY="$(tr '\n' ' ' < "$REMINDER_TMP" | head -c 400)"
  logger -t "$LOG_TAG" "reminders failed http=${REMINDER_CODE} body=${BODY}"
  echo "reminders failed http=${REMINDER_CODE} body=${BODY}" >&2
  FAIL=1
fi

LINE="$(date -u +%Y-%m-%dT%H:%M:%SZ) ${DISPATCH_SUMMARY} | ${REMINDER_SUMMARY}"
logger -t "$LOG_TAG" "ok ${DISPATCH_SUMMARY} | ${REMINDER_SUMMARY}"
echo "$LINE"

exit "$FAIL"
