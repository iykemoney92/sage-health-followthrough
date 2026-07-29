# Incident response plan

**Last updated:** 2026-07-28
**Scope:** the Nura production app (`nura-app-sigma.vercel.app`) and its Supabase project (`ygzflyahftmyokfepyqf`).

## Current team

Solo-maintained at this stage - one on-call: the founder. Update this doc the moment that changes (a co-founder, contractor, or on-call rotation joins).

## Severity levels

| Level | Definition | Example |
|---|---|---|
| SEV1 | Full outage, or any real user data exposed/leaked | Site down, RLS bypass exposing another user's Threads |
| SEV2 | Core feature broken for many users, no data exposure | Check-ins not sending, sign-up broken |
| SEV3 | Degraded or broken for a subset of users | One integration (e.g. voice transcription) failing |
| SEV4 | Cosmetic or low-impact | UI glitch, non-critical broken link |

## Immediate response steps (any SEV1/SEV2)

1. **Confirm the issue** - check [Vercel deployment logs](https://vercel.com) and [Supabase logs](https://supabase.com/dashboard/project/ygzflyahftmyokfepyqf/logs/explorer) for errors around the reported time.
2. **Stop the bleeding first, root-cause second.** If a recent deploy caused it, roll back immediately:
   ```bash
   vercel rollback
   ```
   If a recent migration caused it, do not attempt a destructive fix under pressure - restore from the most recent backup once Pro-tier backups are in place (see `BACKUP_POLICY.md`), or fix forward with a corrective migration if the issue is understood and reversible.
3. **Contain a data exposure immediately** if one is suspected: rotate the affected secret(s) (`SUPABASE_SERVICE_ROLE_KEY`, `WHATSAPP_APP_SECRET`, `REVENUECAT_WEBHOOK_AUTH_HEADER`, etc.) via `vercel env rm` / `vercel env add`, and disable the affected endpoint or table access (e.g. temporarily tighten an RLS policy) while investigating.
4. **Communicate.** For SEV1/SEV2, post a short status note wherever users would look (support inbox auto-reply at minimum). Don't go silent while investigating.

## Data breach notification

If personal or health data may have been accessed by an unauthorized party:

1. Identify scope: which table(s), which rows, what time window, via `nura_revenuecat_webhook_events`-style audit trails or Supabase's query logs.
2. Contain: revoke/rotate the credential or close the access path that allowed it (see step 3 above).
3. Assess whether this triggers a legal notification obligation (e.g. GDPR's 72-hour breach notification requirement to the relevant supervisory authority, and notification to affected individuals if there's high risk to their rights). **This determination should involve legal counsel** - the specifics depend on jurisdiction, data sensitivity, and scale.
4. Notify affected users directly and plainly once contained, explaining what happened, what data was involved, and what's being done.
5. Write a postmortem (see below) even if no external notification was legally required.

## Rollback procedures

- **App code:** `vercel rollback` to the previous known-good deployment, or `vercel redeploy <previous-deployment-url>`.
- **Database migration:** every migration in `supabase/migrations/` should be written so its effect is understood before applying (this repo already follows that via the Supabase MCP `apply_migration` + `get_advisors` check pattern). If a migration needs reverting, write and apply a new corrective migration rather than trying to hand-edit history.
- **Third-party integration outage** (Anthropic, ElevenLabs, WhatsApp, RevenueCat): these are external dependencies with no failover today. If one is down, the affected feature should fail gracefully (return a clear error) rather than crash the whole request - confirm this is still true as new integrations are added.

## Postmortem

For any SEV1 or SEV2, write a short postmortem within a few days while it's fresh: what happened, when it was detected, what the impact was (who/how many/how long), root cause, and what changes (code, process, or monitoring) prevent a repeat. Keep it blameless - the goal is fixing systems, not assigning fault.

## Known gaps (update as these close)

- No error monitoring (Sentry) wired up yet - incidents are currently detected by user reports or manual log checks, not automatically.
- No automated database backups (Free tier - see `BACKUP_POLICY.md`).
- No on-call rotation - single point of failure is the founder's availability.
