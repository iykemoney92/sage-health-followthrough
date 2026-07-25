# Cross-Product Infrastructure Plan — Clariti, Sage, Nura

This is the pre-hackathon provisioning reference for all three products. It exists so accounts,
projects, and keys can be created *before* the clock starts, not during it.

Sponsors for this event: **ElevenLabs, Supabase, Anthropic, OpenAI, Vercel** (Juno is also a
sponsor but is a competing consumer product, not developer infra — no integration role).

## Guiding principle

For every piece of product surface, use a sponsor product instead of hand-building it:

- An LLM call → Anthropic (Claude), via the Vercel AI SDK's tool-calling, not a hand-rolled prompt loop.
- A conversational voice/WhatsApp agent → ElevenLabs Agents Platform owns the loop; we only write
  the tool endpoints it calls.
- Auth/DB/file storage → Supabase, one project per product.
- Semantic search / retrieval → OpenAI embeddings + Supabase pgvector (Supabase's own
  "Automatic Embeddings" trigger pattern generates and syncs them — no separate vector DB, no
  hand-written embedding pipeline).
- Hosting → Vercel, one project per product, already scoped via each app's `vercel.json`.

## Product summary

| Product | One-liner | Primary channel | Status |
|---|---|---|---|
| **Clariti** | Consumer health document copilot — explains bills, EOBs, radiology reports | Web app (chat + adaptive canvas), with in-app voice call + scheduled outbound follow-up calls | Actively being built (UI substantially done) |
| **Sage** | WhatsApp-first proactive wellbeing/health follow-through companion | WhatsApp (text + voice), owned by an ElevenLabs agent | Authoritative plan written (`sage/technical-plan.md`), dashboard UI built on seed data, ElevenLabs agent + WhatsApp Business number already spiked/live-tested |
| **Nura** | Broader personal health companion — turns any health conversation/document into a living "Thread" with proactive follow-up and appointment-prep summaries | WhatsApp/voice (planned, same pattern as Sage) + web dashboard | Freshly scaffolded — schema exists, no provider decisions made yet |

Sage and Nura are conceptually close (both are proactive, living-plan, WhatsApp-first health
companions) and are **confirmed separate codebases**, but **share one WhatsApp Business number
and one ElevenLabs agent** (decision locked in below) — provision that shared channel once,
regardless of which of the two ends up being built.

**Only one product will actually be built out for the hackathon itself.** All three still get
fully provisioned now (it's cheap — free-tier accounts/projects, no lock-in), so that whichever
one gets chosen on the day, there's no setup delay eating into build time. This doc is
infra-readiness only; API wiring, integration, testing/QA, and deployment all happen during the
hackathon, after the pick is made.

## Per-sponsor provisioning checklist

### Anthropic
- [ ] One workspace, one API key, shared across all three apps (env var per app, same value is fine)
- [ ] Model: Claude Sonnet as default for structuring/summarizing (cheap, fast, plenty capable); reach for Opus only if a specific generation step is visibly weak
- [ ] No separate OCR tool needed — Claude's **Files API** takes PDFs/images directly (`file_id`, reusable across calls)

### Supabase
- [ ] **Three separate projects** — one each for Clariti, Sage, Nura (confirmed decision — matches the three independent schemas already written)
- [ ] Each project: enable **pgvector** extension (for embeddings), set up Auth (magic link is enough — don't build a full sign-up flow for a hackathon demo), create Storage buckets for uploaded documents/notes
- [ ] Apply each app's existing `supabase/migrations/0001_init.sql` to its project
- [ ] Set up Supabase's **Automatic Embeddings** pattern (Postgres trigger + Edge Function) on: Clariti's `clariti_documents.extracted_text`, Sage's `memories.content`, Nura's `nura_source_contexts.summary` / `nura_observations.value`
- [ ] Do **not** use Supabase Edge Functions for anything beyond the automatic-embeddings trigger — keep all other serverless logic on Vercel/Next.js route handlers, one function host per app, not two

### ElevenLabs
- [ ] Account/workspace set up
- [ ] **One shared agent + WhatsApp Business number for Sage and Nura** (locked in — they can share). Sage's agent already exists and was live-tested — confirm current status against `sage/codex-opinion/10-elevenlabs-whatsapp-live-setup-status.md` (last known blocker: needs a real test recipient number + two WhatsApp templates pending Meta review). Whichever of Sage/Nura is eventually chosen points its tool endpoints at this same agent — no need to decide which one now.
- [ ] Clariti needs its own separate agent (persona/context = document-explanation assistant, not a wellbeing companion), configured for **two invocation modes from one agent**: WebRTC in-app widget (for "Discuss with AI") and outbound telephony (for scheduled follow-up calls)
- [ ] **Meta/WhatsApp Business template approval has real lead time** — this is the single most time-sensitive item on this whole list. Submit templates as early as possible for the shared Sage/Nura number — it doesn't need the final product pick to be made first.

### OpenAI
- [ ] One API key, shared across all three apps
- [ ] Role: `text-embedding-3-small` for semantic search/retrieval (paired with Supabase pgvector) — this is the one capability gap neither Claude nor ElevenLabs fills
- [ ] Optional stretch, in priority order: (1) Moderation API as a second safety layer on Sage/Nura's crisis-language routing, (2) image generation for Clariti's canvas illustrations
- [ ] Explicitly **not** using OpenAI's Realtime API — it competes directly with ElevenLabs for the same voice-agent job; one voice provider per product, not two

### Vercel
- [ ] One team, three projects (Clariti, Sage, Nura already each have a `vercel.json`; Nura's is still the bare schema stub and needs the same build-scoping the other two have)
- [ ] Env vars configured per project (see checklist below)
- [ ] Vercel AI SDK (`ai` package) added to all three — this is the in-process "agent node" for each app's own text/tool-calling loop (see architecture note below), and also gives cheap response streaming for Clariti's chat panel
- [ ] Vercel Cron is a plausible later upgrade for triggering due check-ins/follow-ups across all three (currently manual-trigger for Sage per its cut list — same tradeoff applies to Nura and to Clariti's scheduled follow-up calls)

## Two agent layers, not one — per product

There are two different kinds of "agent" across this stack, and it matters which one owns which surface:

1. **Voice/WhatsApp agent → hosted entirely on ElevenLabs.** ElevenLabs' own agent config owns turn-taking, deciding when to call a tool, routing the conversation. We never write that loop — we write the tool endpoints it calls (plain HTTP routes, webhook-style).
2. **Web/text agent → hosted in our own Next.js backend via the Vercel AI SDK's tool-calling.** `generateText`/`streamText` with a `tools` object *is* the agent loop here (comparable to an n8n "AI Agent" node) — we define Zod-typed tools, the SDK's built-in multi-step loop handles when to call them.

| Product | ElevenLabs agent (voice/WhatsApp) | Vercel AI SDK agent (text) |
|---|---|---|
| Clariti | "Discuss with AI" (in-app WebRTC call) + scheduled follow-up (outbound call) | Main chat + document explanation loop — the primary surface |
| Sage | The *only* surface — WhatsApp text/voice, fully agent-owned. **Shares its ElevenLabs agent + WhatsApp number with Nura.** | Not needed (no separate text-only agent surface) |
| Nura | WhatsApp/voice check-ins — **same shared agent + number as Sage**, differentiated by which product's tool endpoints the agent is wired to for the eventual build | Web dashboard "message Nura" composer, if kept as a channel alongside WhatsApp |

**Shared-tool rule:** implement each tool's business logic once (e.g. `schedule_followup`), then wrap it twice — an HTTP route for ElevenLabs to call, and an AI SDK `tool()` definition for the in-process web loop to call. Never duplicate the logic itself.

## Decisions locked in

1. **Sage and Nura share one WhatsApp Business number + one ElevenLabs agent.** Confirmed. This
   de-risks the Meta template-approval bottleneck without pre-committing to which of the two gets
   built — provision it once, point it at whichever backend is chosen later.
2. **Only one product gets built out during the hackathon itself**, decided at or near the start of
   the event. All three still get fully provisioned beforehand regardless, since that's cheap and
   removes setup friction from whichever gets picked. Nothing below changes based on which one wins.
3. Nura's own docs hadn't committed to a voice/messaging provider yet
   (`lib/integrations/README.md` said "WhatsApp or messaging provider" / "voice check-in
   provider") — now resolved by decision #1: same ElevenLabs-first pattern as Sage, shared agent.

## Two phases: infra readiness (now) vs. build (during the hackathon)

This doc covers **phase 1 only** — accounts, projects, keys, agent configs. Nothing here writes
product code or wires an integration. Phase 2, once a product is picked at the event, is:

1. **API & integration** — wire the actual tool endpoints (`/api/agent/*`, `/api/webhooks/*`),
   connect Claude calls, connect the chosen ElevenLabs agent's tools to real logic, swap seeded
   data for live Supabase reads/writes.
2. **Testing & QA** — exercise the demo path end-to-end (the exact 90-second flow that gets judged),
   check safety-boundary behavior on edge-case inputs, verify the webhook signature/HMAC checks.
3. **Deployment** — push the chosen app's Vercel project live, confirm env vars are set there (not
   just locally), do a full run-through against the deployed URL before judging.

## Environment variables to have ready (per app)

```
ANTHROPIC_API_KEY
OPENAI_API_KEY
ELEVENLABS_API_KEY
ELEVENLABS_AGENT_ID          (Clariti: its own agent. Sage & Nura: the same shared agent ID)
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

Sage additionally needs an ElevenLabs webhook signing secret for `/api/webhooks/elevenlabs/post-call`
(HMAC verification) — Nura needs the identical secret (same shared agent), Clariti will need its
own once its post-call webhook exists.

## Pre-hackathon action order

1. **Start the shared Sage/Nura WhatsApp Business/Meta template submission now** — this has the
   longest, least controllable lead time of anything on this list, and doesn't depend on the
   final product pick.
2. Create the three Supabase projects, apply migrations, enable pgvector.
3. Create Anthropic + OpenAI API keys.
4. Set up ElevenLabs agents — verify the shared Sage/Nura agent's current status, create Clariti's
   separate agent.
5. Link all three Vercel projects, set env vars, confirm each still deploys clean.
