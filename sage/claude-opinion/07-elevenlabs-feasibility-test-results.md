# ElevenLabs Feasibility Test Handoff

Date: 2026-07-22

## Bottom line

The ElevenLabs-first strategy is feasible for Sage.

A blank agent named `Sage Feasibility Test` was created in the ElevenLabs dashboard and successfully preview-tested as a chat-only agent.

Visible dashboard identifiers:

- Agent id: `agent_6501ky5p5s57f0t9pa54r22fh8fs`
- Branch id: `agtbrch_0101ky5p5t42fwq9czcke8yrt0t0`

## What worked

The preview handled the core Sage demo loop:

- user shares messy health/life context
- agent creates a named plan
- plan includes today, this week, check-ins, and clinician-summary sections
- tone is warm and low-pressure
- agent avoided diagnosis/prescribing in the basic test

Test scenario:

> Demo user: I am overwhelmed, barely sleeping, and my GP told me to start walking daily but I keep failing to follow through. Can you help me make a plan?

The agent created `Stabilise My Week`.

## What needs fixing

Medication adherence needs stricter prompt/tool policy.

In a missed-dose follow-up, the agent was empathetic but too casual about not updating the GP. It should instead:

- never advise doubling doses
- tell the user to follow medication instructions or speak to a pharmacist/clinician if unsure
- log missed doses as part of progress summaries
- escalate if side effects, repeated missed doses, worsening symptoms, or danger signs appear
- ask one practical adherence question at a time

## WhatsApp status

The ElevenLabs WhatsApp page is available:

`https://elevenlabs.io/app/agents/whatsapp`

Observed state:

- no WhatsApp accounts imported yet
- `Import account` is available
- import was not clicked because it likely starts Meta/WhatsApp authorization

## Build implication

Proceed with:

- ElevenLabs agent as the conversational runtime
- web app as Sage state/dashboard
- Supabase as persistence
- webhook tools for structured actions
- WhatsApp-style simulator as fallback until Meta import is complete

Do not depend on real WhatsApp as the only demo path.
