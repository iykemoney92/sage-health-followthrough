# Build Plan

Mapped against the real schedule from [event-details.md](../../event-details.md): doors open 10:00 AM Sat July 25, submissions due 12:30 PM Sun July 26. That's ~26.5 hours; assume 6–7 hours of sleep somewhere in there, so realistically **~19–20 working hours**. This plan assumes a small team (2–4 people) working in parallel, not one person doing everything serially.

## Phase 0 — Setup (10:00 AM–12:00 PM, 2h)

- Scaffold `sage/app/` (Next.js + TypeScript + Tailwind + shadcn/ui)
- Create Supabase project, run the schema from [03-data-model.md](03-data-model.md)
- Wire env vars: `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ELEVENLABS_API_KEY`
- Deploy an empty shell to Vercel immediately — confirms the pipeline works before anything depends on it
- Seed one demo user row

**Exit condition:** empty app live on a Vercel URL, DB reachable from a route handler.

## Phase 1 — Core AI loop, no UI polish (12:00 PM–4:00 PM, 4h)

- `lib/claude.ts`: shared system prompt (safety boundaries baked in per [02-architecture.md](02-architecture.md)), plan-generation prompt, check-in-generation prompt, summarization prompt
- `POST /api/plans/generate` — intake text in, plan + sessions written to DB
- `POST /api/checkins/generate` — session in, script + quick replies out
- `POST /api/checkins/[sessionRunId]/respond` — reply in, transcript updated, summary generated, progress updated
- Test all three with curl/Postman against the "Stabilise My Week" demo scenario from the brief — no frontend needed yet

**Exit condition:** the entire product loop works end-to-end via API calls alone. This is the highest-risk part of the build; everything after this is UI work on top of a proven loop.

## Phase 2 — Screens (4:00 PM–9:00 PM, 5h)

Parallelizable across people once Phase 1's API contracts are fixed:

- Nav shell (Today / My Plans / Calendar / Me) + Tailwind theme tokens matching the palette in the brief
- Today dashboard
- My Plans + Plan Detail (journey timeline, current/upcoming sessions)
- Onboarding/intake screen wired to `/api/plans/generate`
- Chat simulator (WhatsApp-style bubbles, quick-reply buttons) wired to the check-in endpoints

**Exit condition:** a judge can go from typing the demo message to seeing a generated plan to completing one check-in, entirely through the UI.

## Dinner / break (9:00 PM–10:00 PM)

## Phase 3 — Calendar, voice, Me screen (10:00 PM–1:00 AM, 3h)

- Calendar view rendering sessions across plans
- `POST /api/voice` (ElevenLabs) + "Play voice check-in" button
- Me screen: preferences, memory/context list (even if static/read-only for demo), safety/support resources copy

**Exit condition:** every screen in the nav has real content, not a placeholder.

## Sleep (1:00 AM–7:00 AM, ~6h)

Don't skip this. A judge notices a team that's visibly fried more than they notice a missing nice-to-have feature.

## Phase 4 — Polish + demo rehearsal (7:00 AM–11:30 AM Sun, 4.5h)

- Fix whatever broke overnight (deploy drift, flaky Claude JSON parsing — add retry/repair logic if needed)
- Seed realistic demo data so the app doesn't look empty on load
- Tighten copy against the brief's "Sage should / should not say" list
- Rehearse the 90-second narrative from the brief's Success Criteria section, timed
- Freeze the build — no new features after ~11:00 AM

## Buffer (11:30 AM–12:30 PM)

Submission logistics, final deploy check, screen-recording a backup demo video in case live wifi/API calls fail during judging.

## What to cut first if behind schedule

In order:
1. Voice (ElevenLabs) — nice-to-have, not core to the loop
2. Calendar view — Today + My Plans already carry the narrative
3. Uploads (GP note/PDF parsing) — mention it as "coming next" verbally instead of building it
4. Real Supabase Auth — stay on the single seeded demo user

Never cut: the plan-generation → check-in → summary loop. That's the entire product thesis.
