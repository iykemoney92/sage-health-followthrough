# Clariti

Clariti is a consumer health document copilot. Upload a confusing medical bill, EOB, or radiology report and Clariti explains it in plain English, generates a short explainer video, and can place a real outbound phone call to walk you through it.

**Live demo:** https://clariti-health-followthrough.vercel.app

This folder is part of a hackathon monorepo (built alongside other, separate projects); Clariti's code lives entirely under `clariti-app/`.

## Stack

- Next.js App Router, React, TypeScript, Tailwind CSS, Zod
- Supabase (auth, storage, Postgres)
- Anthropic Claude (document extraction and explanation)
- ElevenLabs (outbound conversational voice agent)
- Shotstack (AI-generated, multi-scene explainer video stitching)

## What it does

- `/` — start a conversation and attach one health document (a bill, EOB, or radiology report).
- `/workspace` — chat with Clariti about the document; it produces a source-grounded, plain-English analysis (key points, flags, suggested clinician questions, next actions).
- Generates a short AI explainer video and a static illustration per document.
- Places a real outbound phone call (ElevenLabs conversational agent) that carries the document's full context into the conversation, so the call already knows what it's about.
- Tracks follow-up actions and scheduled calls so nothing about a document gets forgotten.
- `/history`, `/documents`, `/follow-ups`, `/settings` round out the product surface.

Clariti explains the wording in a document. It does not diagnose, replace a clinician, or make coverage/legal determinations — see `docs/ARCHITECTURE.md` for the full safety boundary.

## Running it locally

```bash
pnpm install
pnpm dev       # http://localhost:3001
pnpm lint
pnpm typecheck
pnpm build
```

Copy `.env.example` to `.env.local` and fill in your own keys. Note: document upload and explanation only need a Supabase project and an Anthropic (or AI Gateway) key. The outbound call and video-generation features additionally require funded ElevenLabs and Shotstack accounts — without those, everything else works and those two features degrade gracefully with an in-app error rather than crashing. **The fastest way to see every feature working, including the call and video, is the live demo link above.**

## Project layout

- `app/` — Next.js routes, layouts, and API route handlers.
- `components/` — reusable UI primitives and workspace composition.
- `lib/domain/` — Clariti business rules, framework-independent.
- `lib/schemas/` — Zod contracts shared by APIs, AI outputs, and persistence.
- `lib/ai/` — prompt orchestration and structured AI extraction.
- `lib/integrations/` — Supabase, Anthropic, ElevenLabs, and Shotstack clients.
- `lib/repositories/` — typed data-access methods over Supabase tables.
- `supabase/migrations/` — database schema.
- `docs/ARCHITECTURE.md` — full product and technical loop, safety boundaries.
