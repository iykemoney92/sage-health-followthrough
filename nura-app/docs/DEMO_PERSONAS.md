# Nura Completed Demo Runbook

Use one main persona and one backup. Do not demo everyone.

Main local URL: `http://localhost:3000`

Shared demo password: `NuraDemo123!`

Nura WhatsApp test number: `+1 555 485 9474`

Demo attachment files:
- `docs/demo-files/gp-headache-plan.txt`
- `docs/demo-files/medication-note.txt`
- `docs/demo-files/mum-care-notes.txt`

## How a Care plan is born

Care plans are **agent-authored per user**, not hard-coded templates.

1. User shares context (onboarding intake, in-app chat, or WhatsApp) — text, voice note, or attachment.
2. Nura reasons (`decide` in chat / `draftPlanFromIntake` in onboarding) and writes structured JSON: title, category, why, focus, next step.
3. On create, Nura also drafts a short roadmap (milestones/steps) and schedules a first check-in with agent-chosen timing, channel, and prompt.
4. Check-ins show on that user’s calendar; later chat can advance or adjust the roadmap.

Different personas get different plans. Sarah’s sleep/headache follow-through is not the same Care plan as someone starting a new tablet or watching blood pressure after clinic.

## Where We Are Now

The demo is ready around the core Nura story:
- Landing page explains Nura as conversation-first health memory and follow-through.
- Signup creates a user profile with avatar.
- Login sends incomplete users to onboarding.
- Onboarding creates the first health Care plan.
- In-app messaging supports text, voice-note demo, and file/media attachments.
- Attachments become Care plan context.
- Nura schedules check-ins into Supabase.
- Calendar shows scheduled check-ins and manual events.
- Check-in completion saves progress and schedules the next check-in.
- Summary generates a non-diagnostic view of reported context.
- WhatsApp handoff opens the configured Nura test number.
- Voice-agent context endpoint returns Care plan-specific dynamic variables and guardrails.

One caveat:
- `pnpm demo:reset` needs `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`. Without it, create accounts manually through `/signup`.

## Primary Demo Persona

Sarah, 34.

Busy working parent. Recently saw her GP because she is exhausted, stressed, sleeping badly, and getting headaches. GP told her to start with simple lifestyle follow-through: daily 10-minute walks, track sleep/headaches, and come back if headaches worsen.

Credentials:
- Email: `sarah.nura.demo@example.com`
- Password: `NuraDemo123!`
- Name: `Sarah Thompson`

Problem line:
```text
Sarah leaves healthcare interactions with advice, but the follow-through happens alone, days later, in real life.
```

Value line:
```text
Nura remembers Sarah's health context and proactively follows up, so important care advice does not disappear after the appointment.
```

## Primary Demo Care plan

Landing:
```text
Nura is a conversation-first health memory and follow-through companion.
```

Signup / Onboarding:
- Create Sarah's account or sign in with the demo account.
- If Sarah is fresh/reset, she should go to `/onboarding`.
- If she already completed onboarding, sign out and use a new demo email like `sarah.nura.demo+1@example.com`.

Onboarding message:
```text
I'm overwhelmed, barely sleeping, getting headaches, and my GP told me to try a 10-minute walk daily and keep an eye on symptoms.
```

Expected result:
- Nura creates a Care plan like `Stabilise Sleep & Movement`, `Headache Follow-Through`, or similar.
- Today shows the active Care plan and next check-in.

In-app messaging:
- Go to `Message Nura`.
- Send:
```text
I slept badly again last night and forgot to walk today. Can you help me stay on track without making this feel overwhelming?
```

Expected result:
- Nura replies conversationally.
- Nura connects the update to Sarah's Care plan.
- Care plan context updates.

Attachment / context:
- Attach `docs/demo-files/gp-headache-plan.txt`.
- Say:
```text
This could also come through WhatsApp as a message, voice note, image, or file. The important point is that it becomes Care plan context.
```

Expected result:
- Nura stores the file as Care plan context.
- Nura should ask for confirmation before turning GP advice into a reminder.

Calendar:
- Open `/calendar`.
- Show scheduled check-in/reminder.
- Say:
```text
Nura doesn't just chat. It turns the conversation into follow-through.
```

Check-in:
- Open the scheduled Care plan check-in.
- Choose `About the same`.
- Add:
```text
Still tired, but I can try a short walk after dinner.
```

Expected result:
- Check-in completes.
- The update becomes progress context.
- A next follow-up is scheduled.

Summary:
- Open `/summary`.
- Show patterns/questions.
- Say:
```text
This gives Sarah a simple, non-diagnostic summary of what she reported.
```

WhatsApp / voice:
- Open `Message Nura`.
- Click WhatsApp handoff.
- Say:
```text
For the hackathon, this is where the same agent continues through WhatsApp. For voice check-ins, Nura sends ElevenLabs the Care plan context dynamically, so the call is specific to Sarah's actual health journey.
```

Closing line:
```text
Nura is not another health chatbot. It is memory plus follow-through for the moments between appointments.
```

## 3-Minute Script

0:00:
```text
Healthcare has a memory problem. People leave appointments with advice, but the follow-through happens later, alone, when life gets messy.
```

0:20:
```text
This is Sarah. She's overwhelmed, sleeping badly, getting headaches, and her GP told her to try a 10-minute daily walk.
```

0:45:
```text
She tells Nura naturally. Nura creates a Care plan and remembers the context.
```

1:15:
```text
She shares extra context as a message, voice note, image, or file. Nura attaches it to the same Care plan.
```

1:45:
```text
Nura schedules a check-in, visible on Calendar.
```

2:10:
```text
Sarah completes a check-in. Her update becomes progress context.
```

2:35:
```text
Nura creates a concise summary and prepares a personalized WhatsApp or voice follow-up.
```

2:55:
```text
Nura remembers your healthcare journey and proactively helps you stay on track.
```

## Backup Persona

David, 58.

Started new blood pressure medication. Needs to remember dose timing, side effects, and GP follow-up.

Credentials:
- Email: `david.nura.demo@example.com`
- Password: `NuraDemo123!`
- Name: `David Carter`

Demo message:
```text
I started amlodipine 5mg this week. My GP said to monitor dizziness and book a blood pressure check in two weeks.
```

Why use David:
- More obviously medical.
- Good for showing guardrails.
- Good for showing that Nura tracks medication follow-through but does not advise dose changes.

## Tooling Explanation For Judges

Keep this simple:
```text
Nura's agent uses a small set of server-side tools: create or update a Care plan, save context, schedule a check-in, create a calendar event, and fetch Care plan context for voice.
```

What is implemented:
- In-app agent path: `/api/messages`
- Calendar read/write: `/api/calendar-events`
- Check-in completion: `/api/check-ins/complete`
- Check-in reschedule: `/api/check-ins/reschedule`
- Voice context for ElevenLabs: `/api/agent/voice-checkin-context`
- Agent scheduling tool endpoint: `/api/agent/schedule-checkin`
- Agent browser push tool: `/api/agent/send-push` (header `x-agent-secret`)
- Check-in dispatcher (voice / WhatsApp / push): `/api/agent/trigger-check-ins`

Say this if asked about MCP:
```text
For the hackathon, the tools are HTTP endpoints around shared server functions rather than a separate MCP service. That keeps WhatsApp, ElevenLabs, and the web app using the same action layer. MCP can wrap the same tools later.
```

## UAT Checklist

Before demo:
- Landing page opens.
- Signup works for a new Sarah email.
- Profile image appears in top bar and `/me`.
- Onboarding sends user to Today.
- Message Nura opens.
- Text message works.
- Voice-note demo button works.
- File attachment works.
- Care plan is created or updated.
- Calendar shows scheduled check-in.
- Check-in completion works.
- Summary opens.
- WhatsApp handoff opens `https://wa.me/<NEXT_PUBLIC_NURA_WHATSAPP_NUMBER>` (must be the real Meta WhatsApp Business / test display number — not a 555 placeholder).

Guardrails:
- Nura does not diagnose.
- Nura does not prescribe.
- Nura does not change medication.
- Nura asks for confirmation before turning clinician instructions into reminders.
- Nura routes urgent/worsening symptoms to urgent or emergency care.
