# 05 Risks And Demo Strategy

## Main Risks

### 1. Scope Creep

Sage can support many areas, but the MVP should demo one combined plan.

Mitigation:

- Build `Stabilise My Week`.
- Show other plan types as cards or future examples.
- Avoid implementing many plan templates.

### 2. WhatsApp Integration Risk

Real WhatsApp integration can involve Meta approval, templates, numbers, and sandbox constraints.

Mitigation:

- Build WhatsApp-style simulator first.
- Add Twilio/Meta only if time allows.
- Keep voice and chat abstraction behind one interface.

### 3. AI Reliability

AI output can be inconsistent or unsafe.

Mitigation:

- Use strict JSON schemas.
- Use Zod validation.
- Use safe fallback plans.
- Keep prompts constrained.
- Avoid diagnosis/treatment outputs.

### 4. Product Positioning Risk

If described as an AI therapist, the product enters a crowded and risky category.

Mitigation:

- Use “follow-through companion”.
- Say it supports existing goals/plans.
- Keep safety copy visible.
- Do not make clinical claims.

### 5. Juno Comparison Risk

The sponsor already has a chronic illness AI assistant.

Mitigation:

- Position Sage around follow-through plans across wellbeing and health.
- Do not pitch as a chronic illness assistant.
- Show chronic illness as one plan category, not the whole product.

## Demo Strategy

### 90-Second Flow

1. Show messy user intake:
   “I’m overwhelmed, barely sleeping, and my GP told me to start walking daily.”
2. Sage creates `Stabilise My Week`.
3. Show Today dashboard.
4. Open Plan Detail journey.
5. Show calendar check-ins.
6. Trigger WhatsApp-style check-in.
7. Answer quick replies.
8. Show progress update and summary.

### Judge Takeaway

The judge should leave thinking:

> This is not another chatbot. It turns overwhelming health and wellbeing context into an actionable plan and helps the user follow through.

## Technical Demo Fallbacks

### If Anthropic API Fails

Use seeded plan JSON.

### If Supabase Fails

Use local in-memory/demo data.

### If WhatsApp Fails

Use WhatsApp-style simulator.

### If ElevenLabs Fails

Use voice tile UI and text check-in.

## What To Show As Future

- Real WhatsApp integration
- ElevenLabs voice check-ins
- GP/therapy note uploads
- Apple Health/wearable context
- Supabase-backed memory
- Exportable summary for doctor or therapist

## What Not To Show

- Diagnosis
- Medication changes
- Crisis intervention beyond routing
- Fake clinical endorsements
- Unbuilt settings or integrations

## Codex Final Opinion

The winning implementation is a calm, polished, reliable demo with one excellent loop. The product should feel broad in vision but narrow in execution.

Build the smallest Sage that makes someone say:

> “I need this when life and health become too much to keep track of.”
