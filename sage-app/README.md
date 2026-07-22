# Sage App

This repo is currently a scaffold, not a UI build.

Sage is a WhatsApp-first planning and follow-through agent. The app owns the durable product state and tool endpoints the ElevenLabs agent calls.

## Current Shape

- `app/api/agent/*` — future ElevenLabs webhook/MCP-compatible tool endpoints.
- `app/api/webhooks/elevenlabs/*` — future ElevenLabs lifecycle webhooks.
- `lib/agent-tools` — tool orchestration layer.
- `lib/domain` — core Sage product logic.
- `lib/integrations` — external providers such as ElevenLabs, WhatsApp, Anthropic, and Supabase.
- `lib/repositories` — persistence adapters.
- `lib/schemas` — Zod contracts shared by tools and domain services.
- `supabase/migrations` — database schema.
- `types` — shared TypeScript product types.

No user-facing pages should be built until the agent tool contract is stable.

## Near-Term Build Order

1. Define tool input/output schemas.
2. Implement demo-data-backed agent tools.
3. Connect one ElevenLabs tool: `create_followthrough_plan`.
4. Persist plans/check-ins to Supabase.
5. Build dashboard pages after real plan state exists.

