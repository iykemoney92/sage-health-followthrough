# Sage — Reconciled Technical Plan (v2: ElevenLabs-first)

This is the authoritative build doc. It supersedes `claude-opinion/` and `codex-opinion/` where they disagree; both folders stay as the reasoning trail, including the two rounds of research (`claude-opinion/06-07`, `codex-opinion/06-10`) that produced the pivot in this version.

**What changed since v1:** while this plan was being written and `sage-app/` was being scaffolded, a parallel session live-tested ElevenLabs Agents against a real WhatsApp Business account — created a working agent, imported a real WhatsApp number, submitted message templates to Meta, and confirmed the agent can hold the "Stabilise My Week" demo conversation in preview. That's no longer a hypothetical integration option; it changes who owns the conversation.

## Status as of this revision

- `sage-app/` exists, builds clean, lints clean. Today / My Plans / Plan Detail / Calendar / Me all render against seeded data (`lib/demo-data.ts`), verified in-browser. The Plan Detail quick-reply interaction works.
- `supabase/migrations/0001_init.sql` has the full schema (below) but isn't wired to a live Supabase project yet.
- No Claude or ElevenLabs API calls are wired into the app yet — everything visible today runs on hardcoded seed data.
- Separately, a real ElevenLabs agent (`Sage Feasibility Test`) and a real WhatsApp Business number exist and are mid-setup — see `codex-opinion/10-elevenlabs-whatsapp-live-setup-status.md` for current blockers (needs a real test recipient number; two templates pending Meta review).

## The architecture shift

**Old model (v1):** our Next.js app generates check-in scripts via our own Claude calls and renders them in an in-app WhatsApp-style simulator. WhatsApp/voice were things we'd simulate, with real integration as a stretch goal.

**New model (v2):** the ElevenLabs Agent *is* the conversation. It owns WhatsApp text, voice notes, and calls directly — transcription, turn-taking, and voice replies are ElevenLabs' problem, not ours. Our app becomes the state/dashboard/tool layer the agent calls into.

```text
User on WhatsApp
  |
  v
ElevenLabs Agent (WhatsApp text / voice note / call)
  |  webhook tool calls
  v
sage-app API routes  (/api/agent/*)
  |
  v
Supabase (plans, sessions, session_runs)
  |
  v
sage-app dashboard (Today / My Plans / Plan Detail / Calendar / Me)
```

```text
Scheduled check-in due
  |
  v
sage-app manual trigger (or later, a cron)
  |
  v
ElevenLabs outbound WhatsApp message/call API
  |
  v
User on WhatsApp
```

```text
WhatsApp call/conversation ends
  |
  v
ElevenLabs post-call webhook (transcript + summary)
  |
  v
sage-app webhook receiver  ->  session_runs + plan progress
```

**Why this is a smaller change to `sage-app/` than it sounds:** the plan-generation logic (turning a messy message into a structured plan with sessions) still has to happen somewhere, and the ElevenLabs agent's own tool contract expects our backend to do it — `create-plan` takes a raw `user_message` and hands back a `plan_id`. So the Claude-calling code from v1 doesn't disappear; it just gets triggered by an incoming webhook from ElevenLabs instead of by our own chat UI. The data model, the dashboard, the deterministic progress calculation, and the seeded-fallback discipline all carry over unchanged.

**Code location, settled by circumstance, not argument:** v1 debated `sage/app/` vs `sage-app/` at length (I picked `sage-app/`, Codex's own reconciliation picked `sage/app/` — we each talked ourselves into the other's original position). Moot now: `sage-app/` exists, is built, and is verified working. Relocating a working app for a naming preference is pure churn we don't have time for. **`sage-app/` stays.**

## What ElevenLabs now owns vs. what sage-app owns

**ElevenLabs Agent handles:**
- WhatsApp inbound text, audio-note transcription, inbound/outbound calls
- Voice model, turn-taking, silence handling, call ending
- Outbound WhatsApp message/call APIs (once templates are approved)
- Conversation transcript generation
- Calling our webhook tools mid-conversation

**sage-app handles:**
- Plan dashboard (Today / My Plans / Plan Detail / Calendar / Me) — already built
- Supabase schema and persistence
- Plan generation logic (still Claude, still Zod-validated, still safety-guarded) — now triggered by a webhook call instead of our own UI
- The webhook tool endpoints the agent calls
- The post-call webhook receiver
- Safety validation as a second layer, independent of whatever the ElevenLabs agent's own system prompt does
- The WhatsApp-style in-app simulator, kept as fallback if WhatsApp/Meta setup blocks the live demo

## Backend tool contracts for the ElevenLabs agent

These are the four endpoints `sage-app` needs to expose. Not built yet — next concrete coding task once the live spike's contract stabilizes (the other session is still iterating on exact field names against the real agent).

### `GET /api/agent/user-context`
Input: `{ whatsapp_user_id }`
Output: `{ user_id, name, active_plans: [{ id, title, type, progress, current_session }] }`

### `POST /api/agent/create-plan`
Input: `{ whatsapp_user_id, user_message, detected_context }`
Output: `{ plan_id, title, sessions_created }`
Internally: this is where Claude's `generatePlan()` runs, Zod-validated, with the seeded-plan fallback from v1 if validation fails.

### `POST /api/agent/log-check-in`
Input: `{ session_id, conversation_id, responses, free_text_summary }`
Output: `{ saved, session_status, next_session_title }`
Internally: progress is still computed deterministically from completed/total sessions — never from anything the agent or Claude reports as a delta. That call from v1 stands regardless of who's driving the conversation.

### `POST /api/webhooks/elevenlabs/post-call`
Verifies the ElevenLabs HMAC signature, finds the session by `conversation_id`, persists transcript + summary into `session_runs`, updates session status and plan progress.

All four sit behind the same safety guardrail layer and system-prompt boundaries from v1 — if anything, they matter more now, since the conversation is being driven by an agent we don't fully control the runtime of. Our backend is the last line of defense against a diagnosis claim or a medication-change instruction slipping through.

## What's unchanged from v1 (still correct, already built or ready to build)

### Data model
No changes. Already implemented in `sage-app/supabase/migrations/0001_init.sql` and `sage-app/types/sage.ts`.

```sql
create type plan_type as enum ('wellbeing', 'health_follow_up', 'mixed');
create type plan_status as enum ('draft', 'active', 'paused', 'completed', 'archived');
create type session_status as enum ('upcoming', 'today', 'completed', 'skipped', 'rescheduled');
create type checkin_channel as enum ('whatsapp_text', 'whatsapp_voice', 'web_chat', 'reminder');
create type upload_source as enum ('gp_note', 'therapy_note', 'occupational_health', 'user_upload', 'other');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  timezone text default 'Europe/London',
  preferred_channel checkin_channel default 'web_chat',
  voice_enabled boolean default false,
  preferences jsonb default '{}',
  created_at timestamptz default now()
);

create table plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  type plan_type not null,
  goal text,
  source_summary text,
  status plan_status not null default 'draft',
  progress numeric not null default 0 check (progress >= 0 and progress <= 1), -- always computed app-side
  start_date date,
  end_date date,
  check_in_channel checkin_channel not null default 'web_chat',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references plans(id) on delete cascade,
  order_index int not null,
  title text not null,
  objective text,
  status session_status not null default 'upcoming',
  scheduled_at timestamptz,
  channel checkin_channel not null default 'web_chat',
  prompt_script text,
  expected_inputs jsonb not null default '[]',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (plan_id, order_index)
);

create table session_runs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  started_at timestamptz default now(),
  completed_at timestamptz,
  transcript jsonb not null default '[]',
  structured_responses jsonb not null default '{}',
  summary text,
  next_action text,
  created_at timestamptz default now()
);

create table memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  content text not null,
  source text,
  approved boolean not null default false,
  created_at timestamptz default now()
);

create table uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  plan_id uuid references plans(id) on delete set null,
  file_name text,
  file_type text,
  file_url text not null,
  extracted_text text,
  summary text,
  source_type upload_source default 'other',
  created_at timestamptz default now()
);
```

RLS policies as written in the migration — enabled, not enforced as a login gate for the demo.

### Positioning risk (still holds, arguably more now)
Chronic illness is one plan example among several, never the headline — Juno, a hackathon sponsor, already pitches as a chronic-illness AI assistant. Avoid "AI therapist" framing generally. This now also needs to be encoded directly in the ElevenLabs agent's system prompt, not just our own app copy — see the safety prompt requirements in `claude-opinion/06-elevenlabs-agent-whatsapp-research.md`.

### Kept overrides from v1
- Plan type enum stays `wellbeing | health_follow_up | mixed` — matches the brief's stated two-category MVP scope. (Codex's own reconciliation wanted to re-add `occupational_health`/`routine`; not adopting that — no functional need, just enum churn.)
- Session status enum stays the richer `upcoming | today | completed | skipped | rescheduled` — already implemented and it's what makes the Today dashboard's "Next check-in" section work.
- Plan progress stays deterministic (`completed_sessions / total_sessions` computed in code), never trusted from any AI or agent output.

## Build order (updated)

| Status | Phase | Content |
|---|---|---|
| ✅ Done | 0. Setup | `sage-app/` scaffolded, deps installed, builds/lints clean |
| ✅ Done | 1. Static seeded UI | App shell, nav, Today/My Plans/Plan Detail/Calendar/Me rendering seeded "Stabilise My Week" plan, quick-reply interaction working |
| ⏳ In parallel, owned by the other session | 0.5. ElevenLabs/WhatsApp spike | Agent created, WhatsApp Business imported, templates submitted to Meta. Blocked on a real test recipient number and template approval. Not something `sage-app` work is blocked on — proceed independently |
| Next | 2. Agent tool endpoints | `/api/agent/user-context`, `/api/agent/create-plan`, `/api/agent/log-check-in`, `/api/webhooks/elevenlabs/post-call` — build against demo data first, matching the contracts above |
| Next | 3. Claude integration | Anthropic SDK + Zod schemas wired into `create-plan` and `log-check-in`, seeded-fallback on validation failure, safety guardrail layer |
| Next | 4. Supabase | Migrations applied to a live project, seed demo user, swap demo-data reads for persisted reads |
| Later | 5. Wire the real agent | Once the spike's contract is stable, point the live ElevenLabs agent's webhook tools at the deployed endpoints |
| Later | 6. Polish + rehearsal | Safety-copy pass, positioning check, rehearse the 90-second flow, freeze the build |

## Cut list if behind schedule

1. Real WhatsApp/ElevenLabs voice/calls — fall back to the in-app simulator (already built) for the live demo
2. Calendar view
3. Uploads/GP-note parsing
4. Supabase persistence — demo can run on seed data alone if it must

Never cut: the plan-generation → check-in → progress-update loop, and the safety guardrail layer, regardless of which channel is driving the conversation.
