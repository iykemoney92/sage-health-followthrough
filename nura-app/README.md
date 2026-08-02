# Nura App

Nura is a personal AI health companion scaffold for living health Plans, conversational organisation, and proactive follow-through.

This folder contains the Nura concept in `../nura/06_Nura_AI_Health_Companion_Concept.docx` and the UI references in `../nura/ui:ux/`.

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
pnpm test
pnpm build
```

## CI/CD

GitHub Actions + Vercel. Entry workflow: **Nura Deploy** (calls reusable **Nura CI**, then deploys).

| Stage | Workflow | What |
|---|---|---|
| CI | [nura-ci.yml](../.github/workflows/nura-ci.yml) | `typecheck` → `lint` → `test` → `build` |
| CD | [nura-deploy.yml](../.github/workflows/nura-deploy.yml) | PR → Vercel preview; `main` → production (`usenura.app`) |

Triggers on changes under `nura-app/**`. Monorepo scoping: `vercel.json` `ignoreCommand` skips Vercel Git builds when the commit did not touch `nura-app/`.

Until `VERCEL_TOKEN` is set, deploy jobs soft-skip and **Vercel Git** remains the production deployer. After the token is set, Actions can own previews + prod (optionally turn off automatic production deploys in Vercel → Git to avoid doubles).

### One-time Actions deploy setup

```bash
# From https://vercel.com/account/tokens
gh secret set VERCEL_TOKEN

# Repo variables (already set for this project if using the default Nura Vercel project):
gh variable set VERCEL_ORG_ID --body "team_ySN0QFvlHlmOVbv3HT7bE1aS"
gh variable set VERCEL_PROJECT_ID --body "prj_NH05v3xvJuoIKUYBgfOSUlEReSa5"
```

In GitHub → Settings → Branches, require **Nura Deploy / Quality gate** before merging to `main`.

## Current Shape

- `/` shows the conversation-first Nura story: chat, voice notes, media, Care plans, and follow-through.
- `/workspace` lets users message Nura, share files/media, continue in WhatsApp, and update Care plan context.
- `/plans`, `/calendar`, and `/me` scaffold the main product navigation.
- `docs/ARCHITECTURE.md` documents the intended product and technical loop.
- `types/nura.ts` and `lib/schemas/nura.ts` define the first shared contracts.
- `supabase/migrations/0001_init.sql` defines the first Plan, source context, check-in, observation, and summary tables.

This is a scaffold, not a finished production implementation.
