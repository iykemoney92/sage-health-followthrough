# Database backup policy

**Last updated:** 2026-07-28

## Current state (Supabase Free tier)

Project `ygzflyahftmyokfepyqf` is on Supabase's **Free** plan, which has **no automated backups of any kind** - no daily snapshots, no point-in-time recovery, no SLA. Free-tier projects also auto-pause after 7 days of inactivity (not a near-term risk once there's real traffic, but worth knowing).

**This means: if the database is ever corrupted, accidentally dropped, or hit by a bad migration, there is currently no way to restore it.** Given the project now stores real user health data, this is the single highest-priority infrastructure gap to close before continuing to onboard real users.

## Recommended posture

| Plan | Backups | Retention | Cost |
|---|---|---|---|
| Free (current) | None | - | $0 |
| Pro | Daily automated snapshots | 7 days | $25/mo |
| Team | Daily automated snapshots | 14 days | $599/mo |
| Enterprise | Daily automated snapshots + PITR | Up to 30 days | Custom |

**Recommendation: upgrade to Pro ($25/mo) before real-user launch.** This alone closes the backup gap and also unlocks Supabase branching (used for a properly isolated staging environment - see the staging setup notes) and leaked-password protection (flagged separately in the security checklist).

If point-in-time recovery (restore to any specific minute, not just once-a-day snapshots) becomes important later - e.g. once transaction volume is high enough that losing up to a day of data is unacceptable - that requires Team plan or above, or the PITR add-on.

## Manual interim mitigation (until upgraded)

Until the Pro upgrade happens, an ad-hoc logical backup can be taken at any time via:

```bash
supabase db dump --db-url "$SUPABASE_DB_URL" -f backup-$(date +%Y%m%d).sql
```

This is **not** a substitute for automated backups - it only protects against loss up to the moment it's run, and depends on someone remembering to run it. Treat it as a stopgap, not a policy.

## What's already in place

- Row Level Security is enabled on all user-data tables, limiting blast radius of a compromised anon-scoped client (see `supabase/migrations/0013_row_level_security.sql`).
- Users can self-export a full copy of their own data at any time (`/api/account/export`), which is a form of user-level backup even though it doesn't help with a database-wide incident.
