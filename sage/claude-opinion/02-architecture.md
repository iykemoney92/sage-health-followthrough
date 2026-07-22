# Architecture

## Where the code lives

Folder sovereignty matters here: `sage/` currently holds only docs (`product-docs/`, `project-summary/`, `ui:ux/`, `design-refs/`, and now `claude-opinion/`). I'd propose the actual codebase becomes a new sibling folder:

```
sage/
  product-docs/        (existing — brief, design doc)
  project-summary/      (existing — source of truth for product)
  ui:ux/                 (existing — screenshot references)
  design-refs/           (existing — currently empty)
  claude-opinion/        (this folder — technical planning)
  app/                    (NEW — the Next.js codebase, proposed)
```

Keeping the codebase at `sage/app/` rather than dropping Next.js boilerplate straight into `sage/` keeps the doc folders and the code cleanly separated, and keeps `sage/` itself as "everything Sage" without the docs getting buried under `node_modules`, `.next`, etc. This is a recommendation, not a decision — flagged in [05-open-questions.md](05-open-questions.md).

## Next.js App Router layout

```
sage/app/
  src/
    app/
      (marketing)/
        page.tsx                  landing / start screen
      onboarding/
        page.tsx                  intake flow (text form; feeds plan generation)
      today/
        page.tsx
      plans/
        page.tsx                  My Plans
        [planId]/
          page.tsx                 Plan detail
      calendar/
        page.tsx
      me/
        page.tsx
      chat/
        page.tsx                  WhatsApp-style simulator (or a persistent drawer, see below)
      api/
        plans/
          generate/route.ts        POST — intake text -> Claude -> plan+sessions -> DB
        checkins/
          generate/route.ts        POST — session -> Claude -> check-in script
          [sessionRunId]/respond/route.ts   POST — user reply -> summarize -> update progress
        voice/
          route.ts                  POST — script text -> ElevenLabs -> audio url
    components/
      plan-card.tsx
      journey-timeline.tsx
      calendar-strip.tsx
      chat-bubble.tsx
      quick-replies.tsx
      nav.tsx                       Today / My Plans / Calendar / Me
    lib/
      claude.ts                     Anthropic client + prompt templates
      elevenlabs.ts
      supabase/
        client.ts                   browser client
        server.ts                   server client (route handlers, server components)
      types.ts                      shared types mirroring the DB schema
```

## Request flow: the three loops that make the demo

### 1. Intake → Plan generation

1. User submits free text (onboarding form or the chat simulator) describing what's going on.
2. `POST /api/plans/generate` sends that text to Claude with a system prompt that: extracts structured context, classifies plan type (`wellbeing` / `health_follow_up` / `mixed`), and produces a plan title, goal, and an ordered list of sessions (title, objective, suggested channel).
3. Response is validated (a fixed JSON shape Claude is instructed to return) and inserted into `plans` + `sessions`.
4. Redirect to the new plan's detail page.

### 2. Check-in → Response → Summary

1. From Plan Detail or Today, a "Start check-in" action calls `POST /api/checkins/generate` with the current session's id.
2. Claude generates the short conversational script (the "Today is Day 2..." style message) plus 3–4 quick-reply options, matching the tone rules in the brief (no diagnosis, no treatment instructions).
3. This renders in the chat UI as a Sage message with quick-reply buttons (or free text).
4. User responds (tap or type) → `POST /api/checkins/[sessionRunId]/respond` stores the exchange in `session_runs.transcript`, then calls Claude again to summarize progress and suggest the next action.
5. Session status and plan `progress` update; summary is shown back in the UI.

### 3. Voice (optional layer on top of loop 2)

A "Play voice check-in" button sends the generated script to `POST /api/voice`, which calls ElevenLabs TTS and returns an audio URL to play inline. This sits on top of the text loop rather than replacing it — no separate state machine needed.

## Where the chat UI lives

Two options, pick one early:
- **Dedicated `/chat` route** — simpler to build, but breaks the "WhatsApp is a primary action across the app" principle from the brief.
- **Persistent slide-over/drawer** available from Today, Plan Detail, etc. — truer to the brief, moderately more work (needs global state for open/close + which session is active).

My lean: build the dedicated route first (loop 2 above needs to work regardless), then wrap it in a drawer component once the core loop is proven. Don't build the drawer chrome before the underlying chat works.

## Safety boundaries as a system prompt, not a UI afterthought

The "Sage should / should not say" list in the brief should be baked into the Claude system prompt used for *every* generation call (plan generation, check-in generation, summarization) — not bolted on as a content filter after the fact. One shared `SAGE_SYSTEM_PROMPT` constant in `lib/claude.ts`, included in every call, is simpler and more reliable than per-endpoint prompt variations.
