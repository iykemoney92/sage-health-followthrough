# 06 Reconciled Technical Plan

This document compares Claude's technical plan with Codex's technical plan and turns both into one build recommendation.

## Short Verdict

Claude and Codex mostly agree. The biggest reconciliation is execution order and scope discipline:

- Use Claude's stricter hackathon stance on **simulating WhatsApp** and using **ElevenLabs TTS only**.
- Use Codex's broader product abstraction: **Context -> Plan -> Sessions -> Check-ins -> Runs -> Summary**.
- Put the code in `sage/app/`, not the repo root and not a separate top-level `sage-app/`.
- Build a seeded demo UI early, but make the API/AI contracts real enough that the loop is not just a mock.

## Decision Matrix

| Area | Claude | Codex | Reconciled Decision |
|---|---|---|---|
| Code location | `sage/app/` | `sage-app/` | Use `sage/app/`. It keeps all Sage work together while separating code from docs. |
| WhatsApp | Simulator only | Simulator first, real integration if feasible | Simulator only for MVP. Real WhatsApp is stretch only after the demo loop is complete. |
| Voice | ElevenLabs TTS only | ElevenLabs if feasible | TTS only. No live voice-agent loop for hackathon MVP. |
| Auth | Seeded user, optional RLS | Avoid auth first | Seeded demo user. Add schema/RLS if quick, but no auth gate in the demo path. |
| Data model | Concrete Supabase SQL | Broader table draft + AI contracts | Use Claude's SQL as base, with small enum additions for future plan types. |
| AI contracts | Endpoint flow described | Explicit JSON contracts and Zod validation | Use Zod-validated JSON contracts for every AI call. |
| Build order | API loop first, then UI | UI first, then data/AI | Build seeded UI and API contracts in parallel if possible. If solo, UI shell first, then AI loop. |
| Scheduler | No cron, manual trigger | Store schedules, trigger demo manually | Manual `Trigger check-in now` for MVP; real scheduling later. |
| Uploads | Cut if behind | MVP input path but not core | Use text/upload placeholder; full parsing is stretch. |

## Final Architecture

```text
sage/
  app/                         Next.js codebase
  project-summary/             product source of truth
  product-docs/                design/product docs
  ui:ux/                       visual references
  codex-opinion/               Codex + reconciled technical planning
  claude-opinion/              Claude technical planning
```

Inside `sage/app/`:

```text
src/
  app/
    page.tsx
    onboarding/page.tsx
    today/page.tsx
    plans/page.tsx
    plans/[planId]/page.tsx
    calendar/page.tsx
    me/page.tsx
    chat/page.tsx
    api/
      plans/generate/route.ts
      checkins/generate/route.ts
      checkins/[sessionRunId]/respond/route.ts
      voice/route.ts
  components/
    layout/
    plans/
    calendar/
    chat/
    ui/
  lib/
    ai/
    data/
    demo/
    safety/
    supabase/
  types/
    sage.ts
  supabase/
    migrations/
    seed.sql
```

## Stack To Lock

- Next.js App Router + TypeScript
- Tailwind CSS
- shadcn/ui-style components or local primitives
- lucide-react
- Supabase Postgres + Storage
- Anthropic Claude for structured generation and summarization
- Zod for validating AI outputs
- ElevenLabs TTS only, if time allows
- WhatsApp-style in-app simulator for the demo
- Vercel for deployment

## Data Model Reconciliation

Use Claude's SQL model as the base because it is implementation-ready. Modify `plan_type` so the product can scale without schema churn:

```sql
create type plan_type as enum (
  'wellbeing',
  'health_follow_up',
  'occupational_health',
  'routine',
  'mixed'
);
```

Keep Claude's simpler session status model:

```sql
create type session_status as enum ('pending', 'active', 'completed', 'skipped');
```

Do not add a separate reminders table for MVP. A scheduled reminder is just a session/check-in with `scheduled_at` and `channel`.

## AI Layer

Use four functions:

- `generatePlan(input)`
- `generateCheckIn(sessionContext)`
- `summarizeSession(runTranscript)`
- `extractUploadedContext(fileText)` as stretch

Every AI response must:

- return JSON only
- match a Zod schema
- include no diagnosis
- include no medication-change instructions
- fail safely into seeded fallback data

Use one shared `SAGE_SYSTEM_PROMPT` across plan generation, check-in generation, and summarization.

## MVP Demo Flow

The MVP should prove this exact path:

1. User enters:
   “I’m overwhelmed, barely sleeping, and my GP told me to start walking daily.”
2. Sage generates `Stabilise My Week`.
3. The app shows `Today`.
4. User opens the plan detail page.
5. Calendar/check-in schedule is visible.
6. User starts a WhatsApp-style check-in.
7. User taps quick replies.
8. Sage updates session status, plan progress, and summary.
9. Optional: user plays ElevenLabs TTS of the check-in script.

## Build Order

### Phase 0: Scaffold And Deploy

- Scaffold `sage/app/`
- Add Tailwind/theme tokens
- Deploy empty app to Vercel
- Create Supabase project if available

Exit condition: app opens on a live URL.

### Phase 1: Seeded Product UI

- App shell
- Today
- My Plans
- Plan Detail
- Calendar
- Chat simulator
- Seeded `Stabilise My Week`

Exit condition: a judge can understand the product without AI enabled.

### Phase 2: AI/API Loop

- Add Zod schemas
- Add Claude prompts
- Add `/api/plans/generate`
- Add `/api/checkins/generate`
- Add `/api/checkins/[sessionRunId]/respond`
- Add seeded fallback when `ANTHROPIC_API_KEY` is missing

Exit condition: messy text can become a real plan and a check-in can update progress.

### Phase 3: Supabase Persistence

- Add migrations
- Add seed demo user
- Persist plans, sessions, and session runs
- Keep local demo fallback

Exit condition: app state survives refresh.

### Phase 4: Voice And Polish

- Add ElevenLabs TTS endpoint
- Add audio playback for check-in script
- Tighten copy and safety language
- Rehearse 90-second demo

Exit condition: demo is stable enough to run twice in a row.

## What To Cut First

Cut in this order if behind:

1. ElevenLabs voice
2. Upload parsing
3. Calendar detail interactions
4. Real Supabase Auth
5. Me screen depth

Never cut:

- plan generation
- plan detail
- check-in UI
- progress update
- safety boundaries

## Final Reconciled Opinion

The strongest build is not a full health platform. It is a calm, believable product demo where one overwhelmed message becomes a structured plan and Sage proactively helps the user follow through.

Build the simulator like it is real. Make the data model real enough to scale. Keep the integrations optional.
