# 04 Scaffolding Plan

## Scaffolding Decision

Scaffold a new app under:

```text
sage-app/
```

Keep current docs and images under:

```text
sage/
```

This separates product thinking from implementation.

## Recommended Command

Use a Next.js TypeScript starter:

```bash
pnpm create next-app sage-app --typescript --tailwind --eslint --app --src-dir=false --import-alias "@/*"
```

If the interactive scaffold is annoying, create manually or use a non-interactive template.

## First Dependencies

```bash
pnpm add @supabase/supabase-js @supabase/ssr zod lucide-react clsx tailwind-merge date-fns
pnpm add @anthropic-ai/sdk
```

Add later only if needed:

```bash
pnpm add elevenlabs
```

## First Files To Create

```text
sage-app/
  app/
    layout.tsx
    page.tsx
    today/page.tsx
    plans/page.tsx
    plans/[id]/page.tsx
    calendar/page.tsx
    me/page.tsx
  components/
    app-shell.tsx
    plan-card.tsx
    plan-journey.tsx
    check-in-calendar.tsx
    whatsapp-panel.tsx
    tracking-panel.tsx
  lib/
    demo-data.ts
    plan-engine.ts
    ai/
      prompts.ts
      schemas.ts
      anthropic.ts
    safety/
      guardrails.ts
  types/
    sage.ts
```

## Build Phases

### Phase 1: Static Demo UI

Goal: make the product visible.

- App shell
- Today dashboard
- My Plans
- Plan Detail
- Calendar
- WhatsApp-style panel
- Seeded `Stabilise My Week` plan

### Phase 2: Local Plan Engine

Goal: make the UI driven by structured data.

- Define TypeScript types
- Create seeded plan/session objects
- Calculate progress from session status
- Add quick reply interaction that updates session state locally

### Phase 3: Supabase

Goal: persist plans and sessions.

- Add Supabase client
- Create migrations
- Seed demo user and plan
- Replace demo data where practical

### Phase 4: AI

Goal: turn messy context into a plan.

- Add Anthropic SDK
- Add Zod schemas
- Create `/api/ai/generate-plan`
- Create `/api/ai/summarize-session`
- Use seeded fallback if API key missing

### Phase 5: Demo Communication

Goal: make check-ins feel proactive.

- Add “Trigger check-in now”
- Show WhatsApp-style incoming messages
- Add voice check-in tile
- Integrate ElevenLabs only if setup is fast

## Environment Variables

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
ELEVENLABS_API_KEY=
```

Optional:

```text
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_FROM=
```

## Demo Seed

Always keep a local seeded demo that works without external APIs.

The hackathon demo should not fail because of:

- missing API key
- WhatsApp provisioning
- voice service downtime
- Supabase auth friction

## Codex Recommendation

Do not start with Supabase auth. Start with the end-to-end demo UI and plan loop. Add auth only after the core product feels alive.
