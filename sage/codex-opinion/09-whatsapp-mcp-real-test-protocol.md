# WhatsApp + MCP Real Feasibility Test Protocol

Date: 2026-07-22

## Why this matters

Sage's moat is not another dashboard or another health chatbot. The moat is that Sage can live inside WhatsApp and proactively follow through with the user by message, voice note, and call.

The dashboard preview has already shown that the Sage agent can create a basic follow-through plan. The next test must prove the real channel:

- inbound WhatsApp message to Sage
- inbound WhatsApp audio/voice note to Sage
- inbound WhatsApp call to Sage
- outbound WhatsApp check-in message from Sage
- outbound WhatsApp check-in call from Sage
- Sage calling backend tools to store plans/check-ins/summaries

## Official capability check

ElevenLabs WhatsApp supports:

- connecting a WhatsApp Business account to an ElevenLabs agent
- inbound message conversations
- outbound message conversations
- inbound WhatsApp calls
- outbound WhatsApp calls
- inbound audio messages, transcribed before being passed to the agent
- audio replies to audio messages by default
- inbound image, document, location, and contact messages
- webhook tools for calling external REST APIs
- MCP tools via SSE or streamable HTTP MCP servers

Important constraints from the docs:

- a WhatsApp account must be imported and assigned to an agent, otherwise inbound messages are ignored and inbound calls are rejected
- outbound WhatsApp messages require a WhatsApp Manager message template
- outbound WhatsApp calls require user permission and a call-permission request template
- outbound calls may require a Meta payment method
- ElevenLabs MCP support is not available for Zero Retention Mode or HIPAA compliance mode

## Current workspace state

Known:

- ElevenLabs workspace is accessible in Chrome.
- Test agent exists: `Sage Feasibility Test`.
- Agent id: `agent_6501ky5p5s57f0t9pa54r22fh8fs`.
- WhatsApp page is accessible.
- WhatsApp page shows no imported accounts yet.
- `Import account` button is available.

Not yet available locally:

- no `ELEVENLABS_API_KEY`
- no `.env` file
- no WhatsApp phone number id
- no WhatsApp user id
- no outbound message template name
- no outbound call permission template name

## Required user confirmations

Before clicking `Import account`:

- confirm that ElevenLabs may start the Meta/WhatsApp authorization flow
- confirm that ElevenLabs may receive/manage the selected WhatsApp Business account for this test

Before sending a message or placing a call:

- provide the test recipient phone number with country code
- confirm that Sage/ElevenLabs may send a WhatsApp message to that number
- confirm that Sage/ElevenLabs may place a WhatsApp call or call-permission request to that number

## Test sequence

### Test 1: Import WhatsApp account

Goal:

Confirm whether the current ElevenLabs workspace can connect to Meta/WhatsApp Business.

Steps:

1. Open `https://elevenlabs.io/app/agents/whatsapp`.
2. Click `Import account`.
3. Complete Meta authorization.
4. Select or create the WhatsApp Business account/number.
5. Return to ElevenLabs account settings page.
6. Assign `Sage Feasibility Test` to the imported WhatsApp number.
7. Confirm messaging and calling settings are enabled.

Pass criteria:

- WhatsApp account appears in ElevenLabs.
- Account has a visible phone number id.
- `Sage Feasibility Test` is assigned.
- Inbound messages are not ignored.

### Test 2: Inbound text message

Goal:

Confirm user can message Sage directly on WhatsApp.

Steps:

1. Send a WhatsApp message to the connected business number:
   - `I am overwhelmed, barely sleeping, and my GP told me to walk daily. Can you help me follow through?`
2. Confirm Sage replies.
3. Check whether the reply follows Sage safety and plan behavior.

Pass criteria:

- Sage receives the text.
- Sage replies in WhatsApp.
- Sage creates or references `Stabilise My Week`.
- Sage does not diagnose or prescribe.

### Test 3: Inbound voice note

Goal:

Confirm WhatsApp voice notes work as the product surface for tired/overwhelmed users.

Steps:

1. Send a WhatsApp voice note with the same overwhelmed/GP walking scenario.
2. Confirm ElevenLabs transcribes it and passes it to Sage.
3. Confirm Sage responds, ideally with audio if account settings allow it.

Pass criteria:

- Sage understands the voice note.
- Sage replies correctly.
- Audio reply behavior is acceptable or can be switched to text in settings.

### Test 4: Inbound WhatsApp call

Goal:

Confirm user can call the WhatsApp business account and speak to Sage.

Steps:

1. Place a WhatsApp call to the connected business number.
2. Say the same plan/check-in scenario.
3. Confirm Sage speaks back and can continue the conversation.

Pass criteria:

- call connects
- Sage answers
- Sage handles spoken context
- Sage can end the call cleanly

### Test 5: Outbound message

Goal:

Confirm Sage can proactively start a check-in.

Prerequisites:

- WhatsApp Manager message template created and approved/usable
- `whatsapp_phone_number_id`
- `whatsapp_user_id`
- template name and language code
- ElevenLabs API key or dashboard outbound dialog access

API endpoint:

`POST https://api.elevenlabs.io/v1/convai/whatsapp/outbound-message`

Required fields:

- `whatsapp_phone_number_id`
- `whatsapp_user_id`
- `template_name`
- `template_language_code`
- `template_params`
- `agent_id`

Pass criteria:

- user receives a templated WhatsApp check-in message
- conversation opens when user replies
- agent continues with Sage context

### Test 6: Outbound call

Goal:

Confirm Sage can proactively call for scheduled follow-up.

Prerequisites:

- WhatsApp Manager call-permission request template
- user permission for WhatsApp calls
- possibly Meta payment method
- `whatsapp_phone_number_id`
- `whatsapp_user_id`
- ElevenLabs API key or dashboard outbound dialog access

API endpoint:

`POST https://api.elevenlabs.io/v1/convai/whatsapp/outbound-call`

Required fields:

- `whatsapp_phone_number_id`
- `whatsapp_user_id`
- `whatsapp_call_permission_request_template_name`
- `whatsapp_call_permission_request_template_language_code`
- `agent_id`

Pass criteria:

- user receives call permission request if required
- call starts after user approves
- Sage speaks and performs the check-in

### Test 7: Tool calling

Goal:

Confirm Sage can call backend tools during WhatsApp conversations.

Recommended first tool path:

- use webhook tools first because Sage needs server-side state writes
- add MCP later if the backend exposes broader tool/resource capabilities

Minimum webhook tools:

- `create_or_update_plan`
- `log_checkin`
- `record_barrier`
- `generate_progress_summary`

Minimum MCP server tools:

- `get_user_context`
- `create_plan`
- `log_checkin`
- `get_active_plans`
- `generate_gp_summary`

Pass criteria:

- Sage calls a tool during conversation
- backend receives the request
- backend returns a structured response
- Sage uses the response in WhatsApp
- state is visible in the web dashboard or logs

## Recommended build decision

For the hackathon:

1. Prove real WhatsApp import and inbound text first.
2. Prove voice note and inbound call second.
3. Prove outbound message third.
4. Prove outbound call only if template/payment/permission setup does not block us.
5. Build webhook tools before MCP unless MCP is specifically needed for the demo.

Why webhook tools first:

- faster to implement
- easier to debug
- ideal for Supabase/server actions
- less security/setup complexity than public MCP during a weekend build

Why still keep MCP in scope:

- ElevenLabs supports MCP servers
- MCP can become the clean long-term tool layer if Sage grows into many external integrations
- approval policies give us a safer path for sensitive actions

## Product conclusion

If real WhatsApp import + inbound text + voice note + one backend tool work, Sage has a credible demo moat.

If outbound calls are blocked by Meta templates/payment/permission setup, the fallback demo should still show:

- inbound WhatsApp user journey
- voice note understanding
- proactive check-in simulated from the dashboard
- exact API contracts for outbound WhatsApp call once templates are ready
