# Nura Demo Persona Document

Use this document as the live demo guide. Keep the demo focused on one person, one problem, and one end-to-end workflow.

Main demo URL: `http://localhost:3000`

Shared demo password: `NuraDemo123!`

Nura WhatsApp handoff number: `+1 555 485 9474`

Best demo files:
- Sarah GP note: `docs/demo-files/gp-headache-plan.txt`
- Sarah blood pressure follow-up: `docs/demo-files/blood-pressure-check-note.txt`
- Sarah voice-note transcript: `docs/demo-files/sarah-whatsapp-voice-transcript.txt`
- David medication note: `docs/demo-files/medication-note.txt`

## Demo Positioning

Problem:
```text
Healthcare has a memory problem. People leave appointments with advice, but the follow-through happens later, alone, when life gets messy.
```

Value:
```text
Nura remembers your health context and helps you follow through between appointments.
```

Product line:
```text
Nura is a conversation-first health memory and follow-through companion.
```

Closing:
```text
Nura is not another health chatbot. It is memory plus follow-through for the moments between appointments.
```

## Primary Persona

Name: Sarah Thompson

Age: 34

Profile: Busy working parent. She has been exhausted, sleeping badly, stressed at work, and getting recurring headaches. Her GP advised simple follow-through: try a 10-minute walk daily, track sleep and headaches, avoid skipping breakfast, and seek review if headaches worsen.

Demo account:
- Email: `sarah.nura.demo@example.com`
- Password: `NuraDemo123!`
- Fresh-account option: `sarah.nura.demo+1@example.com`, then increase the number if needed.

Profile photo:
- Use any clear user photo from the machine if available.
- If not, initials are fine for the hackathon.

## Sarah Demo Journey

### 1. Landing

Action:
- Open `http://localhost:3000`
- Click `Get started`

Say:
```text
This is Nura. It is built for the moments between appointments, where people are trying to remember what happened, what matters, and what to do next.
```

Expected:
- Landing explains Nura around health memory, follow-through, privacy, and conversation.

### 2. Signup

Action:
- Create Sarah's account from scratch.
- Name: `Sarah Thompson`
- Email: use a fresh Sarah email if the main one already exists.
- Password: `NuraDemo123!`
- Agree to terms.

Expected:
- New account goes into onboarding, not straight to dashboard.

### 3. Onboarding

Action:
- Move through onboarding simply.
- Do not over-explain every screen.

When asked what Nura should remember first, choose:
- Stress or emotional wellbeing
- GP or clinic follow-up
- Symptoms I want to track
- Sleep and routine

When asked to tell Nura what is going on, type:
```text
I'm overwhelmed, barely sleeping, getting headaches, and my GP told me to try a 10-minute walk daily, avoid skipping breakfast, and keep an eye on symptoms.
```

Expected:
- Nura creates Sarah's first Thread.
- Sarah lands on Today.
- Today highlights the next best action: message Nura in-app or continue via WhatsApp.

Say:
```text
Sarah does not need to fill out a medical form. A normal message is enough for Nura to start organising the context.
```

### 4. Today

Action:
- Show the highlighted start action.
- Show the created Thread and check-in area.

Say:
```text
The important thing is that Nura has turned a messy real-life message into something it can remember and follow up on.
```

Expected:
- A Thread appears, usually around headaches, sleep, stress, or routine.
- A check-in/reminder is visible or prepared.

### 5. In-App Messaging

Action:
- Click `Message in app`.
- Send:
```text
I slept badly again last night and forgot to walk today. Can you help me stay on track without making this feel overwhelming?
```

Expected:
- Nura replies warmly.
- Nura connects the update to the existing Thread.
- Nura may suggest a gentle next step or check-in.

Say:
```text
This is the core interaction. Nura is not waiting for a perfect medical upload. It learns from the conversation.
```

### 6. Attachment Or Voice Note

Action:
- Attach `docs/demo-files/gp-headache-plan.txt`
- Or click the microphone demo button.
- If you want a second attachment, use `docs/demo-files/blood-pressure-check-note.txt`.

File context to mention:
```text
GP advice: try a 10-minute walk daily, monitor headaches and sleep, avoid skipping breakfast, and seek review if headaches worsen.
```

Expected:
- Nura treats the attachment or voice note as Thread context.
- Nura uses it to update the conversation and follow-through plan.

Say:
```text
This same context could arrive as a WhatsApp text, image, voice note, PDF, or document. Nura keeps it connected to the right Thread.
```

### 7. Calendar

Action:
- Open Calendar.
- Show check-ins or reminders.

Say:
```text
Nura does not just chat. It turns the conversation into follow-through.
```

Expected:
- Scheduled check-ins/reminders are visible.
- Calendar items are tied to Sarah's Thread context.

### 8. Check-In

Action:
- Start a check-in from Today or Calendar.
- Choose: `About the same`
- Add:
```text
Still tired, but I can try a short walk after dinner.
```

Expected:
- Check-in completes.
- The update becomes progress context.
- Nura schedules or prepares the next follow-up.

### 9. Summary

Action:
- Open Summary.

Say:
```text
This gives Sarah a simple, non-diagnostic summary of what she has reported, so she can remember the pattern before the next appointment.
```

Expected:
- Summary is clear, cautious, and not diagnostic.
- It should show reported context, follow-through, and useful questions.

### 10. WhatsApp Handoff

Action:
- Click `Open WhatsApp`.

Expected:
- WhatsApp opens with a Nura message and link code.
- The message links the WhatsApp sender back to the logged-in Nura account.

Say:
```text
For the demo, the same agent can continue through WhatsApp. The link code associates the WhatsApp sender with Sarah's Nura account, so future messages can update the right Thread.
```

Important:
- If WhatsApp display name shows a Meta test name, explain that the phone number display name is controlled in Meta's WhatsApp settings. The product handoff still opens the configured Nura number and includes the link code.

## 3-Minute Talk Track

0:00:
```text
Healthcare has a memory problem. People leave appointments with advice, but the follow-through happens later, alone, when life gets messy.
```

0:20:
```text
This is Sarah. She is overwhelmed, sleeping badly, getting headaches, and her GP told her to try a 10-minute daily walk and track symptoms.
```

0:45:
```text
She tells Nura naturally. Nura creates a Thread and remembers the context.
```

1:15:
```text
She shares extra context as a message, voice note, image, or file. Nura attaches it to the same Thread.
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

Name: David Carter

Age: 58

Profile: Recently started blood pressure medication. Needs to remember dose timing, side effects to watch, and a GP follow-up.

Demo account:
- Email: `david.nura.demo@example.com`
- Password: `NuraDemo123!`

Message:
```text
I started amlodipine 5mg this week. My GP said to monitor dizziness and book a blood pressure check in two weeks.
```

Use David if:
- You want a more obviously medical example.
- You want to show medication follow-through.
- You want to show guardrails around not changing medication or giving diagnosis.

## Judge Questions

If asked how the agent schedules:
```text
The agent uses server-side tools to create or update Threads, save context, schedule check-ins, and create calendar events. The conversation is the interface, but the actions are structured.
```

If asked about WhatsApp linking:
```text
The first WhatsApp handoff includes a Nura link code. When the user sends it, the webhook links that WhatsApp sender to the logged-in Nura account, so future WhatsApp messages can update the right health Thread.
```

If asked about voice:
```text
Voice check-ins receive Thread-specific context dynamically, so the call is about Sarah's actual journey rather than a generic script.
```

If asked about safety:
```text
Nura does not diagnose, prescribe, or replace clinical care. It organises user-provided context, supports follow-through, and escalates urgent or worsening symptoms toward urgent care.
```

## Final Demo Checklist

- Landing loads.
- Signup works with a fresh Sarah email.
- Onboarding creates a Thread.
- Today highlights the next action.
- In-app messaging works.
- Attachment or voice-note demo works.
- Thread context updates.
- Calendar shows follow-through.
- Check-in completion works.
- Summary opens.
- WhatsApp handoff opens the configured number with a link code.
- Profile picture or initials appear correctly.
