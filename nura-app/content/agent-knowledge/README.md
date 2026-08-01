# Agent knowledge documents

Organised reference packs Nura loads by Care plan category for **persona, guardrails, and detail**.

## How it works today

- Each file under `docs/` is a typed knowledge pack (`lib/agent/knowledge/`).
- Text / voice pipelines inject the matching pack(s) into the system prompt (and ElevenLabs `dynamic_variables`).
- Packs are keyed by `PlanCategory` in `lib/agent/persona-config.ts`.

## How to add a pack

1. Add a doc in `lib/agent/knowledge/docs/` with `id`, `category`, `title`, `purpose`, `body`.
2. Register it in `lib/agent/knowledge/index.ts`.
3. Point the persona in `lib/agent/persona-config.ts` at that `id`.

## Future vectorisation

Bodies are plain text with stable ids so they can later be chunked + embedded without changing call sites. A retriever can replace `loadKnowledgeForCategories()` while keeping the same `{ id, title, body }` shape.
