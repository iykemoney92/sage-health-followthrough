# ElevenLabs Agent + WhatsApp Research Note For Claude

## Why This Exists

Claude's earlier technical recommendation said to simulate WhatsApp and use ElevenLabs as TTS only. That was a safe hackathon stance, but current ElevenLabs docs show a stronger path:

ElevenLabs Agents can connect to a WhatsApp Business account and handle both **message conversations** and **calls**.

This means we should consider making ElevenLabs the primary conversation/voice/WhatsApp layer, while our Sage app remains the plan dashboard, database, and state system.

## Sources Checked

- ElevenLabs WhatsApp docs: https://elevenlabs.io/docs/eleven-agents/whatsapp
- ElevenLabs WhatsApp tools: https://elevenlabs.io/docs/eleven-agents/whatsapp/tools
- ElevenLabs webhook tools: https://elevenlabs.io/docs/eleven-agents/customization/tools/webhook-tools
- ElevenLabs post-call webhooks: https://elevenlabs.io/docs/eleven-agents/workflows/post-call-webhooks
- ElevenLabs outbound WhatsApp call API: https://elevenlabs.io/docs/api-reference/whats-app/outbound-call
- ElevenLabs outbound WhatsApp message API: https://elevenlabs.io/docs/api-reference/whats-app/outbound-message
- ElevenLabs dynamic variables: https://elevenlabs.io/docs/eleven-agents/customization/personalization/dynamic-variables
- ElevenLabs agent authentication: https://elevenlabs.io/docs/eleven-agents/customization/authentication
- ElevenLabs conversation flow: https://elevenlabs.io/docs/eleven-agents/customization/conversation-flow

## Key Findings

### 1. ElevenLabs Agents Can Connect Directly To WhatsApp

The docs say a WhatsApp Business account can be connected to an ElevenLabs Agent. The agent can handle:

- WhatsApp message conversations
- WhatsApp calls

Setup flow:

1. Import WhatsApp Business account in ElevenLabs.
2. Authorize ElevenLabs to manage the account.
3. Assign an agent to the WhatsApp account.
4. Configure WhatsApp Manager.

Important detail: if no agent is assigned, inbound messages are ignored and inbound calls are rejected.

### 2. WhatsApp Text, Audio, Images, Documents Are Supported

The WhatsApp docs list message types including:

- text
- audio
- image
- document
- location
- contact

For audio messages, inbound audio is transcribed before being passed to the agent. By default, the agent can respond to audio messages with audio messages, though settings can force text responses.

This is highly relevant for Sage because the user can interact naturally through voice notes or messages without us building speech-to-text and text-to-speech from scratch.

### 3. WhatsApp Calls Are Supported

Inbound:

- A user can call the WhatsApp Business account.
- The assigned ElevenLabs agent responds.
- Text messages sent during the call can be incorporated into the conversation.

Outbound:

- Outbound calls require user permission.
- ElevenLabs can send a WhatsApp call permission request template if needed.
- The outbound call can be scheduled from the dashboard or via API.

This is very close to the Sage check-in experience: scheduled WhatsApp voice check-ins.

### 4. Outbound WhatsApp Message API Exists

Endpoint:

```text
POST https://api.elevenlabs.io/v1/convai/whatsapp/outbound-message
```

Required inputs include:

- `whatsapp_phone_number_id`
- `whatsapp_user_id`
- `template_name`
- `template_language_code`
- `template_params`
- `agent_id`

It returns a `conversation_id`.

This can power scheduled check-in messages such as:

> “It’s time for your Sage check-in. Reply here when you’re ready.”

### 5. Outbound WhatsApp Call API Exists

Endpoint:

```text
POST https://api.elevenlabs.io/v1/convai/whatsapp/outbound-call
```

Required inputs include:

- `whatsapp_phone_number_id`
- `whatsapp_user_id`
- `whatsapp_call_permission_request_template_name`
- `whatsapp_call_permission_request_template_language_code`
- `agent_id`

Optional:

- `conversation_initiation_client_data`

This can start a Sage voice check-in through WhatsApp, but it depends on WhatsApp call permission flow and template setup.

### 6. Dynamic Variables Can Personalize Conversations

ElevenLabs dynamic variables let us inject runtime values into:

- system prompts
- first messages
- tool parameters
- headers

Useful variables for Sage:

- `user_name`
- `plan_title`
- `session_title`
- `session_objective`
- `plan_context_summary`
- `today_focus`
- `safety_boundary`

System variables also include:

- `system__conversation_id`
- `system__time`
- `system__timezone`
- `system__caller_id` for voice calls
- `system__called_number` for voice calls

### 7. Webhook Tools Let The Agent Call Our Backend

ElevenLabs webhook tools allow the agent to call external APIs during the conversation.

For Sage, this means the ElevenLabs agent can call our Next.js/Supabase backend for actions like:

- get active plan
- create plan
- update session response
- mark session complete
- save memory
- fetch next check-in
- create weekly summary

This is the key architecture shift: instead of our app orchestrating every chat turn, the ElevenLabs agent can run the conversation and use our app as the state/tool layer.

### 8. Post-Call Webhooks Can Persist The Conversation

ElevenLabs post-call webhooks can send:

- transcription webhook with full conversation data, analysis, metadata
- audio webhook with base64 MP3 audio
- call initiation failure webhook

Webhook listeners should verify ElevenLabs HMAC signatures.

For Sage:

- post-call transcription can become a `session_run`
- transcript summary can update the plan
- failed calls can mark check-in status as failed or retryable

## Updated Architecture Recommendation

### Previous Architecture

```text
Sage app generates check-in -> UI simulator / TTS -> user responds -> Sage app summarizes
```

### Better ElevenLabs-First Architecture

```text
Sage app
  - plans
  - calendar
  - dashboard
  - Supabase state
  - API tools

ElevenLabs Agent
  - WhatsApp messaging
  - WhatsApp voice calls
  - audio transcription
  - agent conversation
  - voice response
  - tool calls into Sage backend

WhatsApp
  - user-facing channel
```

## Proposed System Design

```text
User on WhatsApp
  |
  v
ElevenLabs WhatsApp Agent
  |
  | Webhook tools
  v
Next.js API routes
  |
  v
Supabase
  |
  v
Sage web dashboard
```

Outbound check-ins:

```text
Scheduled session due
  |
  v
Next.js cron/manual trigger
  |
  v
ElevenLabs WhatsApp outbound message/call API
  |
  v
User on WhatsApp
```

Post-call persistence:

```text
WhatsApp call ends
  |
  v
ElevenLabs post-call transcription webhook
  |
  v
Next.js webhook endpoint
  |
  v
Supabase session_runs + plan progress update
```

## Minimal Sage Backend Tools For ElevenLabs

Create these endpoints as webhook tools:

### `GET /api/agent/user-context`

Input:

```json
{
  "whatsapp_user_id": "string"
}
```

Output:

```json
{
  "user_id": "uuid",
  "name": "Ike",
  "active_plans": [
    {
      "id": "uuid",
      "title": "Stabilise My Week",
      "type": "mixed",
      "progress": 0.4,
      "current_session": {
        "id": "uuid",
        "title": "Medication + mood",
        "objective": "Check medication/routine completion and mood load."
      }
    }
  ]
}
```

### `POST /api/agent/create-plan`

Called when user tells Sage what they are dealing with and no plan exists yet.

Input:

```json
{
  "whatsapp_user_id": "string",
  "user_message": "string",
  "detected_context": {
    "wellbeing": true,
    "health_follow_up": true
  }
}
```

Output:

```json
{
  "plan_id": "uuid",
  "title": "Stabilise My Week",
  "sessions_created": 7
}
```

### `POST /api/agent/log-check-in`

Called during or after a WhatsApp message/call check-in.

Input:

```json
{
  "session_id": "uuid",
  "conversation_id": "string",
  "responses": {
    "medication": "taken",
    "mood_load": 8,
    "movement": "not realistic today"
  },
  "free_text_summary": "User reports heavy day and poor sleep."
}
```

Output:

```json
{
  "saved": true,
  "session_status": "completed",
  "next_session_title": "Sleep reset"
}
```

### `POST /api/webhooks/elevenlabs/post-call`

Receives post-call transcription data.

Responsibilities:

- verify HMAC signature
- find conversation/session by `conversation_id`
- save transcript
- save summary
- update session status
- update plan progress

## What Should Live In ElevenLabs vs Our App

### ElevenLabs Should Handle

- WhatsApp inbound text conversation
- WhatsApp inbound audio message transcription
- WhatsApp audio replies
- WhatsApp inbound calls
- WhatsApp outbound calls
- WhatsApp outbound message templates
- voice model
- turn-taking
- silence handling
- call ending
- conversation transcript generation
- agent-to-tool orchestration

### Sage App Should Handle

- product UI
- plan dashboard
- calendar
- Supabase database
- user-plan-session state
- plan generation rules
- safety validation
- summaries for dashboard
- upload management
- scheduling logic
- webhook endpoints
- fallback simulator

## What We Still Need To Code

Even if ElevenLabs handles the agent, we still need:

- Next.js app
- Supabase schema
- plan/session dashboard
- API endpoints for agent tools
- webhook receiver for post-call data
- scheduling/manual trigger endpoint
- privacy/safety UI
- fallback simulator

But we do **not** need to code:

- custom voice streaming
- custom speech-to-text
- custom text-to-speech playback
- WhatsApp webhook parsing from Meta
- Twilio voice call orchestration
- live voice turn-taking

That is a major simplification.

## Hackathon Feasibility

### Feasible If We Already Have Or Can Quickly Create

- ElevenLabs account with Agents access
- WhatsApp Business account
- ability to import WhatsApp Business into ElevenLabs
- WhatsApp Manager access
- message template approval or usable test template
- call settings enabled
- payment method for outbound calls if needed
- ElevenLabs API key

### Risky / Could Block Live Demo

- Meta/WhatsApp permissions
- WhatsApp outbound call permission template setup
- WhatsApp payment method
- template approval delay
- user permission for outbound calls
- Zero-Retention Mode limitations
- cost of audio/STT/TTS

## Recommended Build Strategy

### Updated Position

Do not assume simulator-only. Run an **ElevenLabs WhatsApp feasibility spike first**.

### Spike Checklist

Before scaffolding too much custom chat code, test:

1. Can we create/configure a Sage ElevenLabs Agent?
2. Can we import/connect a WhatsApp Business account?
3. Can inbound WhatsApp text reach the agent?
4. Can inbound WhatsApp voice note be transcribed and answered?
5. Can inbound WhatsApp call reach the agent?
6. Can our Next.js local/tunnel endpoint be called as a webhook tool?
7. Can we trigger outbound WhatsApp message through ElevenLabs API?
8. Can we trigger outbound WhatsApp call through ElevenLabs API?
9. Can post-call transcription webhook reach our endpoint?

If steps 1-6 work, we should build ElevenLabs-first.

If steps 7-8 fail, we can still demo inbound WhatsApp and manual check-ins.

If steps 2-5 fail, fall back to the in-app WhatsApp simulator.

## Revised MVP Technical Plan

### Phase 0: ElevenLabs/WhatsApp Spike

Time-box: 2-3 hours max.

Goal: prove whether the agent can actually run through WhatsApp.

Exit condition:

- inbound WhatsApp text or voice reaches Sage agent
- agent can call one test backend webhook tool

### Phase 1: Sage App State Layer

Build:

- Supabase schema
- seeded user
- plans
- sessions
- session_runs
- API endpoints for agent tools

### Phase 2: ElevenLabs Agent Configuration

Agent prompt:

- Sage identity
- product boundaries
- safety boundaries
- follow-through behavior
- tool usage instructions

Tools:

- get user context
- create/update plan
- log check-in

### Phase 3: Dashboard

Build:

- Today
- My Plans
- Plan Detail
- Calendar
- Me

Dashboard reads Supabase state updated by ElevenLabs conversations.

### Phase 4: Demo Loop

Demo:

1. User messages Sage on WhatsApp.
2. ElevenLabs agent responds.
3. Agent creates plan through webhook tool.
4. Dashboard shows plan.
5. User completes WhatsApp check-in.
6. Dashboard updates progress.
7. Optional: WhatsApp voice call.

## Safety Prompt Requirements

The ElevenLabs agent system prompt must include:

- Sage is not a doctor or therapist.
- Sage does not diagnose.
- Sage does not tell users to start/stop/change medication.
- Sage helps users follow through on plans and goals.
- Sage routes urgent/crisis content to appropriate urgent support.
- Sage asks for confirmation before turning uploaded GP/therapy instructions into a plan.
- Sage speaks gently and practically.
- Sage should ask one or two questions at a time.
- Sage should prefer small next steps over broad advice.

## Updated Opinion For Claude

Claude's simulator-first recommendation was safe, but new evidence suggests a better path:

> Try to build the real Sage agent on ElevenLabs first, because ElevenLabs may already provide WhatsApp messaging, WhatsApp calls, audio transcription, voice replies, outbound message APIs, outbound call APIs, tool calling, and post-call webhooks.

However:

> Keep the simulator as a fallback because WhatsApp Business setup and outbound call permission can still block the demo.

Best final stance:

> ElevenLabs-first, simulator-backed.

That means:

- architect around ElevenLabs as the conversation runtime
- keep Sage app as the state/dashboard/tool layer
- time-box integration risk early
- never let WhatsApp setup block the core Sage demo
