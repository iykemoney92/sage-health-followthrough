# ElevenLabs + WhatsApp Live Setup Status

Date: 2026-07-22

## Current Setup

- Product/account: Sage Test
- WhatsApp number: +1 555-485-9474
- WhatsApp phone number ID: 1183566771515463
- Meta business ID: 4237692199813781
- Meta WhatsApp asset ID: 28645938631674243
- ElevenLabs WhatsApp account: https://elevenlabs.io/app/agents/whatsapp/1183566771515463
- Assigned ElevenLabs agent: Sage Feasibility Test
- Agent ID: agent_6501ky5p5s57f0t9pa54r22fh8fs

## Confirmed Working Configuration

- WhatsApp Business account is imported into ElevenLabs.
- ElevenLabs shows the WhatsApp account as `Sage Test`.
- The account is assigned to the `Sage Feasibility Test` agent.
- Messaging is enabled.
- Audio message responses are enabled.
- Typing indicator is enabled.
- ElevenLabs outbound menu exposes both `Message` and `Call`.
- ElevenLabs outbound message dialog can see the submitted WhatsApp templates.

## Meta/WhatsApp Templates

Submitted templates:

1. `sage_checkin_message`
   - Category: Marketing
   - Language: English
   - Body: `Hi, this is Sage checking in. Reply when you're ready and I'll help you follow through on today's plan.`
   - Status on Meta: In review

2. `sage_checkin_call_permission`
   - Category: Marketing
   - Language: English
   - Body: `Hi, this is Sage. Can we call you on WhatsApp for your scheduled check-in?`
   - Status on Meta: In review

Meta originally warned that the check-in message did not match Utility and recommended Marketing. We accepted Marketing to avoid submitting a template Meta said would be rejected.

## Business Profile Fix

The WhatsApp business profile website was updated away from the uncontrolled `sage.ai` domain. It now points to:

`https://github.com/iykemoney92/sage-health-followthrough`

Meta confirmed the profile changes were saved and may take a few minutes to appear on WhatsApp.

## Immediate Test Plan

Inbound tests do not need template approval:

1. User sends a WhatsApp text to `+1 555-485-9474`.
2. User sends a WhatsApp voice note to `+1 555-485-9474`.
3. User attempts a WhatsApp voice call to `+1 555-485-9474`.
4. Check ElevenLabs conversation history for transcripts, replies, and channel metadata.

Recommended inbound test message:

`I am overwhelmed, barely sleeping, and my GP told me to walk daily. Can you help me follow through?`

Outbound tests depend on template availability/approval:

1. Enter the test recipient as the WhatsApp user id in ElevenLabs.
2. Select `Sage Feasibility Test`.
3. Select `sage_checkin_message` for outbound text.
4. Select `sage_checkin_call_permission` for call permission/outbound call flow.
5. Send/call only after confirming the exact test number.

## Current Blockers

- Need a real test recipient WhatsApp user id or phone number in international format.
- Proactive outbound text/call may fail until Meta finishes reviewing templates.
- The `+1 555-485-9474` number may be a Meta/WhatsApp test-style number; if it is not reachable from the user's WhatsApp app, we need to attach a real WhatsApp Business number or configure Meta test recipients.

## Next Technical Step

For the hackathon demo, keep the first backend simple:

- Use ElevenLabs agent for conversation.
- Use WhatsApp as the primary user interface.
- Add webhook tools first for:
  - `create_or_update_plan`
  - `log_checkin`
  - `record_barrier`
  - `generate_progress_summary`
- Add MCP later if the agent needs a richer tool layer exposed over public HTTPS.

