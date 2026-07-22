# 01 Technical Summary

## Codex Recommendation

Build Sage as a single flexible **plan engine** with a polished consumer UI and a demo-safe communication layer.

The technical goal is not to build a complete healthcare platform. The technical goal is to prove that messy user context can become:

- a structured plan
- scheduled sessions/check-ins
- WhatsApp-style support
- progress updates
- a useful summary

## Recommended MVP Stack

- App: Next.js + TypeScript
- UI: Tailwind CSS + shadcn/ui-style primitives or lightweight local components
- Icons: lucide-react
- Backend: Next.js route handlers/server actions
- Database: Supabase Postgres
- Auth: Supabase Auth, or demo-only local user if time is tight
- Storage: Supabase Storage for uploads
- AI: Anthropic Claude for plan generation and summarization
- Voice: ElevenLabs if feasible
- WhatsApp: Twilio/Meta if feasible, otherwise a WhatsApp-style simulator
- Hosting: Vercel

## Main Technical Principle

Keep all health areas behind the same abstraction:

```text
Context -> Plan -> Sessions -> Check-ins -> Runs -> Summary
```

This lets Sage support wellbeing, GP follow-up, chronic illness routines, therapy homework, occupational health, and lifestyle changes without creating separate products.

## MVP User Journey

1. User enters a messy message:
   “I’m overwhelmed, barely sleeping, and my GP told me to start walking daily.”
2. Sage generates a plan called `Stabilise My Week`.
3. The app shows the plan on `Today`, `My Plans`, `Plan Detail`, and `Calendar`.
4. A scheduled check-in appears.
5. User completes a WhatsApp-style check-in.
6. The current session is marked complete.
7. Sage generates a session summary and next step.

## What To Prioritize

Priority order:

1. Beautiful seeded UI
2. Plan data model
3. AI plan generation
4. Check-in simulator
5. Session summary/progress update
6. Upload/import flow
7. Real WhatsApp/voice only if time allows

## What To Avoid

- Real clinical decision-making
- Complicated OAuth integrations
- Depending on WhatsApp approval for the demo
- Overbuilding auth before the plan loop works
- Building a generic chatbot
- Building too many plan templates
- Creating unused navigation

## Codex Position

For the hackathon, Sage should feel like a real product even if the integrations are simulated. A credible working loop beats half-finished infrastructure.
