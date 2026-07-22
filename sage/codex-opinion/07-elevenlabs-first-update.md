# 07 ElevenLabs-First Update

## Why This Updates The Reconciled Plan

After checking current ElevenLabs documentation, the previous recommendation to treat WhatsApp and voice as mostly simulated should be revised.

ElevenLabs Agents now document direct WhatsApp Business account integration for:

- message conversations
- calls
- inbound audio transcription
- audio replies
- outbound WhatsApp messages
- outbound WhatsApp calls
- webhook tools
- post-call webhooks

Detailed research note for Claude:

`sage/claude-opinion/06-elevenlabs-agent-whatsapp-research.md`

## Updated Recommendation

Use an:

```text
ElevenLabs-first, simulator-backed
```

strategy.

This means:

- Try to make ElevenLabs the real conversation runtime.
- Keep the Sage app as dashboard, database, plan engine, and tool layer.
- Keep the in-app WhatsApp simulator as a fallback if WhatsApp Business setup blocks us.

## New First Step

Before scaffolding too much custom chat/voice code, run a 2-3 hour feasibility spike:

1. Create/configure Sage ElevenLabs Agent.
2. Import/connect WhatsApp Business account.
3. Test inbound WhatsApp text.
4. Test inbound WhatsApp audio note.
5. Test inbound WhatsApp call.
6. Test one webhook tool from the agent to our backend.
7. Test outbound WhatsApp message API.
8. Test outbound WhatsApp call API.
9. Test post-call transcription webhook.

If 1-6 work, build ElevenLabs-first.

If outbound call/message fails, still demo inbound WhatsApp and manual check-ins.

If WhatsApp import fails, fall back to simulator.

## Architecture Shift

Old:

```text
Sage app orchestrates chat, check-ins, TTS, and summaries.
```

New:

```text
ElevenLabs Agent orchestrates conversation.
Sage app provides state, tools, dashboard, scheduling, and persistence.
```

## What We Still Build

- Next.js app
- Supabase schema
- Today / My Plans / Plan Detail / Calendar / Me
- Agent webhook tools
- Post-call webhook receiver
- Scheduling/manual trigger endpoint
- Safety validation
- Fallback simulator

## What ElevenLabs Can Replace

- custom WhatsApp webhook integration
- custom voice streaming
- custom speech-to-text
- custom text-to-speech playback
- custom live voice turn-taking
- Twilio call orchestration

## Updated Final Opinion

The best technical path is now:

> Build Sage as a plan/state/dashboard product, and let ElevenLabs run the WhatsApp text/voice agent if setup succeeds.

Still keep the simulator because hackathon demos need a reliable fallback.
