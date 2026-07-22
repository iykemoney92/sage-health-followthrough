# Scaffold Reconciliation: Sage Is A Plan-Runner, Not A Q&A Bot

Date: 2026-07-22

## Verdict

Claude's `sage-app/` scaffold is a good base for the web/dashboard layer. It already models the right visible objects: plans, sessions, check-ins, calendar, memories, uploads, and a plan detail view. It also builds and lints cleanly.

But the product direction needs to be stated more sharply:

**Sage is not a health Q&A assistant. Sage is a WhatsApp-first planning and follow-through agent.**

The web app should not become the main chat product. WhatsApp/voice is the main surface. The app is the state layer: it shows plans, check-in sessions, uploaded evidence, progress, and summaries created or updated by the agent.

## What Claude Got Right

- `sage-app/` is the right place to keep the working Next.js app. Moving it now would be churn.
- The page structure is useful for demo:
  - `/today`
  - `/plans`
  - `/plans/[id]`
  - `/calendar`
  - `/me`
- The core schema is close:
  - `profiles`
  - `plans`
  - `sessions`
  - `session_runs`
  - `memories`
  - `uploads`
- The seeded `Stabilise My Week` plan matches the live WhatsApp test story.
- Deterministic progress calculation is correct. Do not let an AI invent progress percentage.
- Keeping Supabase, Zod, and Anthropic/Claude as the planning backend is reasonable.
- The `technical-plan.md` v2 correctly pivots to ElevenLabs owning conversation and WhatsApp.

## What Needs Reframing

The scaffold still feels like:

`dashboard -> simulated WhatsApp panel -> static sessions`

The real product should be:

`WhatsApp/voice conversation -> agent tool calls -> persisted plan/session state -> dashboard reflects state`

The current `WhatsAppPanel` is fine as a fallback demo component, but it should not guide the core architecture. The real Sage experience is not a chat window inside the web app. It is a living plan that users reach through WhatsApp.

## The Product Model We Should Lock

Sage handles messy inputs:

- "I am stressed and barely sleeping."
- "My GP told me to walk daily."
- "Here is a therapist note."
- "Here is a medication label."
- "I missed yesterday. I feel bad."
- Voice notes, screenshots, PDFs, visit summaries, photos.

Sage turns them into structured plan state:

- active plan
- sessions/check-ins
- reminders
- barriers
- safety flags
- evidence/uploads
- progress summary
- next action

Sage then runs the plan:

- asks one small check-in question
- logs the response
- adapts the next session
- reschedules if needed
- summarizes progress
- escalates if unsafe

## The Agent Tool Layer

The next backend should expose tools that the ElevenLabs agent can call. Whether these are ElevenLabs webhook tools first or a full MCP server later, the product contract should look like this.

### MVP Tools

1. `get_user_context`
   - Finds or creates the user by WhatsApp user id.
   - Returns active plans, today's sessions, preferences, and safety notes.

2. `create_followthrough_plan`
   - Turns a messy WhatsApp text/voice transcript/upload summary into a structured plan.
   - Creates sessions and first check-in schedule.
   - Must return a short WhatsApp-safe confirmation message.

3. `update_plan_from_checkin`
   - Logs what happened.
   - Records blockers.
   - Marks session completed/skipped/rescheduled.
   - Updates next action.

4. `schedule_checkin`
   - Stores preferred channel/time.
   - Creates a due check-in.
   - Later can trigger ElevenLabs outbound message/call.

5. `generate_progress_summary`
   - Produces a user, GP, therapist, or occupational-health ready summary.
   - Must separate user-reported facts from Sage's interpretation.

### Soon After MVP

6. `ingest_user_upload`
   - Accepts file metadata/extracted text.
   - Classifies source type: GP note, therapy note, occupational health, medication label, user upload, other.
   - Suggests plan updates rather than silently changing sensitive health plans.

7. `record_memory_candidate`
   - Stores something Sage wants to remember.
   - Requires user approval before becoming durable memory.

8. `safety_triage`
   - Flags crisis language, medication-risk language, urgent symptoms, safeguarding concerns.
   - Does not diagnose.
   - Returns the safe response mode.

## Schema Gaps To Add Before Real Tooling

Claude's schema is close, but before MCP/tool wiring I would add these concepts.

### `plan_events`

Why: a plan-runner needs an audit trail. We need to know why a plan changed.

Examples:

- plan_created
- session_completed
- barrier_recorded
- plan_adjusted
- checkin_scheduled
- upload_ingested
- summary_generated
- safety_flagged

### `checkin_schedules`

Why: `sessions.scheduled_at` is not enough. Users need preferences like "WhatsApp voice at 8pm weekdays" or "message me if I miss two days".

### `agent_conversations`

Why: ElevenLabs conversations/calls need to map cleanly to Sage users, plans, and sessions.

Fields should include:

- `elevenlabs_conversation_id`
- `whatsapp_user_id`
- `plan_id`
- `session_id`
- `channel`
- `started_at`
- `ended_at`
- `summary`
- `raw_metadata`

### `barriers`

Why: Sage's moat is follow-through. Barriers are first-class, not just text hidden inside `session_runs`.

Examples:

- low_energy
- pain
- forgot
- anxiety
- no_time
- unclear_plan
- relationship_conflict
- spiritual_distress
- side_effect_concern
- other

## Prompt/Agent Behavior Reconciliation

The current live WhatsApp response proves the integration works but the agent voice is too generic.

The ElevenLabs system prompt should force this behavior:

1. Do not behave like a Q&A assistant.
2. When a user brings a problem, move toward a plan.
3. Ask one question at a time when the user sounds overwhelmed.
4. Prefer tiny actions over motivational advice.
5. Always identify:
   - goal
   - smallest next action
   - barrier
   - check-in timing
   - what happens if the user misses it
6. Use tools to create or update plan state.
7. Ask before storing long-term memory.
8. Never diagnose, prescribe, or change medication.
9. Escalate urgent or unsafe symptoms.
10. Keep WhatsApp responses short.

## Reconciled Architecture

```text
User
  |
  | WhatsApp text / voice note / WhatsApp call / upload
  v
ElevenLabs Agent
  |
  | tool calls
  v
Sage Tool Server
  |
  | create/update/query plan state
  v
Supabase
  |
  v
sage-app dashboard
```

The tool server can start as normal Next.js API routes because that is fastest for the hackathon. We can wrap those same operations as MCP tools if ElevenLabs' MCP path is ready and stable enough.

## Build Recommendation

Do not rebuild the scaffold. Keep it.

Next coding phase should be:

1. Add API route contracts for agent tools using demo data first.
2. Add Zod schemas for plan creation/check-in update outputs.
3. Add the missing schema tables: `plan_events`, `checkin_schedules`, `agent_conversations`, and possibly `barriers`.
4. Update the ElevenLabs prompt to be tool-first and plan-first.
5. Connect one tool to ElevenLabs first: `create_followthrough_plan`.
6. Test: WhatsApp message -> tool call -> plan appears in dashboard.

## Final Position

Claude's scaffold is useful and should remain. The correction is not structural, it is philosophical and operational:

**Sage should not answer users. Sage should turn what users say into a plan, run that plan, and keep following through.**

