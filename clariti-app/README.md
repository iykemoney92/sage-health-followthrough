# Clariti App

Clariti is a consumer health document copilot scaffold.

This folder is intentionally separate from Sage. It contains the technical foundation for building Clariti from the existing product design references in `../clariti/ui:ux/`.

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

- `/` shows the scaffold status screen.
- `/workspace` shows a minimal three-panel shell for the future product UI.
- `docs/ARCHITECTURE.md` documents the planned product and technical loop.
- `types/clariti.ts` and `lib/schemas/clariti.ts` define the first shared contracts.

No final UI design has been implemented yet.
