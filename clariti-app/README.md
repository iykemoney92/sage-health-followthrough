# Clariti

Clariti is a consumer health document copilot. Upload a medical bill, an insurance EOB, a lab
result, or a radiology report and Clariti explains it in plain English — what it actually says,
what is worth questioning, and what to do next.

**Live:** https://useclariti.app

The same product also ships to the App Store and Google Play as a Capacitor shell that loads
the live site in a native WebView — see [`../clariti-mobile`](../clariti-mobile/README.md).

Clariti explains the wording in a document. It does not diagnose, replace a clinician, or make
coverage or legal determinations. `docs/ARCHITECTURE.md` has the full safety boundary.

## Stack

- Next.js App Router, React 19, TypeScript, Tailwind CSS v4, Zod
- Supabase — auth, Postgres, and private document storage
- Anthropic Claude, via the Vercel AI Gateway — extraction, explanation, storyboarding
- Resend — auth email and follow-up check-in email
- RevenueCat — Clariti Plus on the web and through StoreKit inside the native shell
- Shotstack — stitches the generated clips into the explainer video

## What it does

- `/` — pick a document kind and attach a file. Bills, EOBs, lab results, radiology and
  pathology reports, discharge summaries, referral letters, visit notes, prior authorisations.
- `/workspace` — chat about the document. Clariti returns a source-grounded, plain-English
  analysis: key points, flags worth raising, questions for your clinician, and next actions.
- Generates a short explainer video and a static illustration from a saved analysis.
- Compares two documents of the same kind so you can see what changed between them (Plus).
- Schedules an email check-in on a next action, and sends it when it comes due.
- `/history`, `/documents`, `/follow-ups`, `/billing`, and `/settings` round out the product.

Free accounts get 3 document analyses and 1 explainer video. Clariti Plus lifts both caps, adds
document comparison, and comes with a 7-day trial.

### Not currently shipping

Outbound phone calls. `/api/calls/outbound` returns 410 and the cron skips any follow-up still
on the `phone` channel — email check-ins replaced them. The ElevenLabs client and the call
context builder are still in the tree behind that disabled route.

## Running it locally

```bash
pnpm install
pnpm dev        # http://localhost:3000
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Copy `.env.example` to `.env.local` and fill in your own keys. Document upload and explanation
need only a Supabase project and an AI Gateway (or Anthropic) key. Video generation
additionally needs a funded Shotstack account; without it the rest of the app works and video
degrades to an in-app error rather than a crash.

`scripts/configure-supabase-auth.mjs` writes Clariti's Supabase Auth settings — site URL, the
redirect allow-list (including the native `app.useclariti.mobile://auth/callback` the shell
signs in through), and Resend SMTP:

```bash
SUPABASE_ACCESS_TOKEN=sbp_... node scripts/configure-supabase-auth.mjs
```

## CI/CD

GitHub Actions + Vercel. Entry workflow: **Clariti Deploy** (calls reusable **Clariti CI**,
then deploys).

| Stage | Workflow | What |
|---|---|---|
| CI | [clariti-ci.yml](../.github/workflows/clariti-ci.yml) | `typecheck` → `lint` → `test` (when present) → `build` |
| CD | [clariti-deploy.yml](../.github/workflows/clariti-deploy.yml) | PR → Vercel preview; `main` → production (`useclariti.app`) |
| Mobile | [clariti-mobile-build.yml](../.github/workflows/clariti-mobile-build.yml) | Android debug APK + unsigned iOS simulator build |

Triggers on changes under `clariti-app/**`. Monorepo scoping: `vercel.json`'s `ignoreCommand`
diffs against `$VERCEL_GIT_PREVIOUS_SHA` — the commit Vercel last deployed — so a push carrying
several commits still builds when any one of them touched `clariti-app/`. It falls back to
`HEAD^` locally, and builds rather than skips whenever that base commit is not in the clone.

Until `VERCEL_TOKEN` is set, the deploy jobs soft-skip and **Vercel Git** remains the production
deployer. After the token is set, Actions can own previews and production (optionally turn off
automatic production deploys in Vercel → Git to avoid doubles).

### One-time Actions deploy setup

```bash
# From https://vercel.com/account/tokens
gh secret set VERCEL_TOKEN

# Clariti-scoped repo variables. The unprefixed VERCEL_ORG_ID / VERCEL_PROJECT_ID in this repo
# belong to a different project, so Clariti's workflow reads its own pair.
gh variable set CLARITI_VERCEL_ORG_ID --body "team_ySN0QFvlHlmOVbv3HT7bE1aS"
gh variable set CLARITI_VERCEL_PROJECT_ID --body "prj_I8vg3Ry5Vdvbl6vhCZRCKD3D0Mw9"
```

In GitHub → Settings → Branches, require **Clariti Deploy / Quality gate** before merging to
`main`.

## Scheduled work

`vercel.json` runs `GET /api/agent/trigger-follow-ups` hourly. Each tick claims every due
check-in atomically before sending anything, so overlapping runs cannot email the same person
twice, and it emails whatever is due within the hour rather than holding everything for one
fixed daily slot.

Anything more frequent than once a day needs a paid Vercel plan. On Hobby the deployment is
rejected outright rather than downgraded to daily, so if production ever stops deploying with a
cron complaint, drop the schedule back to `0 9 * * *` — check-ins then run late by up to a day
but nothing else changes.

The route needs a secret and refuses to run without one:

- `CRON_SECRET` — Vercel Cron sends it as `Authorization: Bearer <CRON_SECRET>`. **Set this in
  the Vercel project or the schedule silently 503s.**
- `AGENT_TOOL_SECRET` — sent as `x-agent-secret` by `pnpm trigger:follow-ups`, for firing the
  same sweep by hand.

A send that fails is logged as `[agent/trigger-follow-ups] check-in email failed` with the
follow-up and owner ids, recorded on the row in `call_status` / `call_error`, and released so
the next tick retries it. Every send carries a per-follow-up idempotency key, so a retry cannot
deliver twice, and a check-in more than three days overdue is marked `missed_stale` instead.

## Project layout

- `app/` — routes, layouts, and API route handlers. Styling is split into per-surface CSS files
  (`sidebar.css`, `canvas.css`, `native.css`, …) imported by `app/layout.tsx`.
- `components/` — the app shell, auth modal, and workspace composition.
- `lib/domain/` — Clariti's business rules, framework-independent.
- `lib/schemas/` — Zod contracts shared by APIs, AI output, and persistence.
- `lib/ai/` — prompt orchestration and structured extraction.
- `lib/billing/` — subscription state, RevenueCat web and native purchase paths.
- `lib/integrations/` — Supabase, Resend, and ElevenLabs clients.
- `supabase/migrations/` — database schema.
- `scripts/` — Supabase auth configuration, manual follow-up trigger, store screenshots.
- `docs/` — architecture and safety boundary, project structure, UAT journey, UI notes.
