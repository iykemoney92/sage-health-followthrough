# Nura production ops (droplet)

Voice / check-in dispatch must fire near `scheduled_for`. GitHub Actions
`schedule` is too unreliable for that (jobs queue for minutes or get cancelled).

## Primary scheduler

Runs on the **MigoAI production droplet** (`134.209.186.1`), same host that
already runs `uptime-check.sh` via root crontab.

| Path | Role |
|------|------|
| `/opt/nura/.env` | `AGENT_TOOL_SECRET=...` (and optional URLs) |
| `/opt/nura/scripts/dispatch-check-ins.sh` | Every minute: due check-ins **and** ~1h reminders |
| root crontab | `* * * * *` → script → `/var/log/nura-checkin.log` |

### What the minute tick does

1. `POST /api/agent/trigger-check-ins` — place due voice/WhatsApp/push check-ins
2. `POST /api/agent/check-in-reminders` — email + browser push ~60 minutes before `scheduled_for`

Optional env:

```
CHECKIN_REMINDER_MINUTES_BEFORE=60
NURA_DISPATCH_URL=https://usenura.app/api/agent/trigger-check-ins
NURA_REMINDER_URL=https://usenura.app/api/agent/check-in-reminders
```

## Install / update

From a machine with `~/.ssh/migoai_digitalocean`:

```bash
# copy script
scp -i ~/.ssh/migoai_digitalocean \
  nura-app/infra/scripts/dispatch-check-ins.sh \
  root@134.209.186.1:/opt/nura/scripts/dispatch-check-ins.sh

# ensure secret (once)
ssh -i ~/.ssh/migoai_digitalocean root@134.209.186.1 \
  'install -d -m 700 /opt/nura /opt/nura/scripts && chmod 700 /opt/nura/.env'

# crontab entry (idempotent)
ssh -i ~/.ssh/migoai_digitalocean root@134.209.186.1 \
  '(crontab -l 2>/dev/null | grep -v nura/scripts/dispatch-check-ins; \
    echo "* * * * * /opt/nura/scripts/dispatch-check-ins.sh >> /var/log/nura-checkin.log 2>&1") | crontab -'
```

## Backups

- Vercel Hobby cron: once daily at 08:00 UTC (catch-up only)
- GitHub Actions: `workflow_dispatch` manual re-fire only (no schedule)

## Why not BullMQ on the Migo worker?

Possible later, but cron+curl matches existing droplet ops, has zero coupling to
MigoAI deploys, and fails independently if the worker container restarts.
