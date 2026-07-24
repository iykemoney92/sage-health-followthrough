# Nura App

Nura is a personal AI health companion scaffold for living health Plans, conversational organisation, and proactive follow-through.

This folder is intentionally separate from Sage and Clariti. It is based on the Nura concept in `../nura/06_Nura_AI_Health_Companion_Concept.docx` and the UI references in `../nura/ui:ux/`.

## Stack

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- Zod
- Supabase
- Anthropic

## Commands

```bash
pnpm install
pnpm dev
pnpm lint
pnpm typecheck
pnpm build
```

## Current Shape

- `/` shows the Today composer for chat, voice, and upload-driven plan creation.
- `/workspace` shows a living Plan workspace for the hackathon demo loop.
- `/plans`, `/calendar`, and `/me` scaffold the main product navigation.
- `docs/ARCHITECTURE.md` documents the intended product and technical loop.
- `types/nura.ts` and `lib/schemas/nura.ts` define the first shared contracts.
- `supabase/migrations/0001_init.sql` defines the first Plan, source context, check-in, observation, and summary tables.

This is a scaffold, not a finished production implementation.
