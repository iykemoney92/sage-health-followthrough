# Sage Product & Design Brief

## Product Thesis

Sage is a proactive AI follow-through companion for health and wellbeing plans. It helps people turn overwhelming personal context, professional advice, therapy notes, GP guidance, medication routines, lifestyle goals, and occupational-health recommendations into structured plans they can actually follow.

Sage is not an AI therapist, doctor, or diagnostic tool. It is the practical layer between receiving support and living through it day by day.

## One-Liner

Sage turns health and wellbeing goals into proactive plans you can actually follow.

## Stronger Hackathon Pitch

People are given advice, goals, notes, prescriptions, and care instructions, but nobody helps them follow through. Sage turns that context into a structured plan, schedules check-ins, and supports users through WhatsApp messages and voice.

## Core Product Loop

1. User shares what is going on through WhatsApp, voice, upload, or onboarding.
2. Sage asks a few focused questions.
3. Sage creates a structured Plan with sessions, reminders, and check-ins.
4. User approves or edits the Plan.
5. Plan appears in the web app and calendar.
6. Sage proactively checks in through WhatsApp text or voice.
7. Session summaries and progress are saved.
8. Sage adapts the next check-in and can export a summary for doctor, therapist, occupational health, or the user.

## MVP Scope

The MVP should prove one flexible plan engine, not many disconnected products.

### Build These

- Simple landing/onboarding
- WhatsApp or simulated WhatsApp intake
- Plan creation from user context
- Two plan categories:
  - Wellbeing Plan
  - Health Follow-Up Plan
- Today dashboard
- My Plans
- Plan detail journey
- Calendar/check-ins
- Me/preferences
- WhatsApp text or voice check-in demo
- Session completion summary

### Do Not Build

- Diagnosis
- Therapy claims
- Full medical-record integration
- Payments
- Admin portal
- Analytics dashboard
- Large plan marketplace
- Dozens of plan templates
- Complex wearable integrations

## Target User

The initial user is someone trying to manage more health and life context than they can comfortably hold alone.

Examples:

- A person dealing with mental overload and emotional exhaustion
- Someone with chronic illness routines
- A person receiving therapy homework
- Someone told by a GP to make lifestyle changes
- A person managing medication, sleep, movement, or recovery goals
- Someone returning to work after stress, illness, or burnout

## Emotional Job

Help me keep going when my health, mind, and life responsibilities feel too much to hold alone.

## Functional Job

Turn my health and wellbeing context into a clear plan, remind me at the right time, check how I am doing, and help me summarize progress.

## Product Positioning

### Primary Positioning

AI follow-through companion for health and wellbeing.

### Avoid

- AI therapist
- AI doctor
- Mental health chatbot
- Chronic illness assistant
- Medical diagnosis app
- Generic medication tracker

### Why This Is Different

Most apps either track data, chat reactively, or give generic advice. Sage turns context into structured plans and then proactively follows up through channels users already use.

## Information Architecture

Keep navigation simple:

- Today
- My Plans
- Calendar
- Me

WhatsApp should be a primary action across the app, not a separate complex inbox.

## Core Screens

### 1. Today

Purpose: Show what needs attention now.

Key elements:

- Next check-in
- Active plans
- This week calendar strip
- What Sage is tracking
- Message Sage
- Voice check-in

### 2. My Plans

Purpose: Organize active and completed plans.

Plan examples:

- Managing Emotional Overload
- Blood Pressure Follow-Through
- Sleep Reset
- Therapy Homework
- Return-to-Work Plan
- Chronic Illness Routine

Each Plan card should show:

- Plan category
- Progress
- Next session/check-in
- Completed tasks
- Pending tasks
- Channel

### 3. Plan Detail

Purpose: Make the plan feel real and manageable.

Key elements:

- Plan title
- Plan type
- Source context
- Journey timeline
- Current session
- Upcoming sessions
- Check-in schedule
- Weekly focus
- Message Sage
- Reschedule
- Export summary

### 4. Calendar

Purpose: Show all scheduled check-ins and reminders across Plans.

Key elements:

- Weekly and monthly views
- Plan-colored events
- Check-in detail drawer
- Reschedule/cancel
- Channel label: WhatsApp text, WhatsApp voice, reminder

### 5. Me

Purpose: Trust, preferences, and safety.

Key elements:

- WhatsApp connection
- Voice preferences
- Reminder timing
- Memory/context controls
- Uploads
- Privacy
- Crisis/support resources
- Export/delete data

## Plan Model

Every Plan should share the same structure:

- id
- user_id
- title
- type
- goal
- source_context
- status
- start_date
- end_date
- check_in_channel
- sessions
- reminders
- progress
- summaries

## Session Model

Each session/check-in should include:

- title
- objective
- scheduled_at
- channel
- prompt_script
- expected_inputs
- completion_status
- summary
- next_action

## Example MVP Plan

### Stabilise My Week

Plan type: Wellbeing + Health Follow-Up

Source context:

- WhatsApp intake
- GP advice
- User goals
- Optional therapy note

Journey:

1. Start gently
2. Medication + mood
3. Sleep reset
4. 10-minute walk
5. Relationship reflection
6. GP note review
7. Weekly summary

Example WhatsApp check-in:

Sage: Today is Day 2. Let’s keep it light.

Sage: Did you take your medication?

Sage: How heavy does today feel from 1-10?

Sage: Would a short walk be realistic?

Quick replies:

- Taken
- Not yet
- Heavy day
- I can walk 10 min

## Data Inputs

MVP input paths:

- WhatsApp message
- WhatsApp voice note
- Manual text entry
- PDF/image upload
- Demo GP note or therapy note

Future input paths:

- Apple Health
- Wearables
- Calendar
- NHS/GP record integrations
- Email forwarding
- Patient portal exports

## Safety Boundaries

Sage should:

- Avoid diagnosis
- Avoid treatment instructions
- Encourage professional support where appropriate
- Route crisis language to urgent resources
- Ask users to confirm imported instructions before turning them into plans
- Separate user goals from clinician-provided instructions
- Make memory transparent and user-controlled

Sage should say:

- “I can help you follow through on the plan you already have.”
- “This is not a diagnosis.”
- “If symptoms feel urgent or unsafe, contact emergency or urgent care support.”

Sage should not say:

- “You have depression.”
- “Stop taking this medication.”
- “You do not need to see a doctor.”
- “This will treat your condition.”

## Design Principles

### Calm, Not Clinical

The UI should feel trustworthy and gentle, not like a hospital portal.

### Structured, Not Overwhelming

Every screen should make the next step obvious.

### Human, Not Childish

Use progress and encouragement, but avoid game-like health scoring, avatars, leaderboards, or shame-based streaks.

### Flexible, Not Vague

The same Plan system should support mental wellbeing, health follow-up, occupational health, and routine building.

### WhatsApp-First

The web app is the source of truth. WhatsApp is where daily support happens.

## Visual Direction

Palette:

- Warm off-white background
- Muted sage green primary
- Soft blue secondary
- Charcoal text
- Amber only for pending items
- Avoid alarming red except for true safety states

Typography:

- Elegant, readable headings
- Calm, practical body text
- No overly playful or clinical type

Components:

- 8px card radius
- Simple plan cards
- Journey timeline
- Calendar strips
- Progress bars/rings
- Quick reply buttons
- WhatsApp-style conversation previews

Avoid:

- Medical cross branding
- Hospital imagery
- Pill bottles as hero visuals
- Cartoon mascots
- Heavy gradients
- Overly clinical dashboards

## Hackathon Demo Flow

1. User sends WhatsApp message: “I’m overwhelmed, barely sleeping, and my GP told me to start walking daily.”
2. Sage asks focused questions.
3. Sage creates “Stabilise My Week.”
4. Web app shows Today dashboard and Plan detail.
5. Calendar shows check-ins.
6. WhatsApp/voice check-in triggers.
7. User answers quick replies.
8. Plan progress updates.
9. Sage generates weekly summary.

## Demo Narrative

Sage is for the moment after advice, when life gets hard again. It takes what you are carrying and turns it into a plan that checks in, adapts, and helps you keep going one step at a time.

## Success Criteria

The MVP succeeds if a judge understands within 90 seconds:

- What the user is struggling with
- How Sage creates a plan
- Why WhatsApp/voice matters
- How progress is tracked
- How this can expand beyond one use case
- Why this is not just a chatbot

## Future Expansion

Potential Plan categories:

- Mental wellbeing
- Chronic illness routines
- Medication follow-through
- GP/clinic aftercare
- Sleep and energy
- Occupational health
- Return to work
- Caregiver support
- Relationship stress
- Spiritual/reflection routines
- Fitness/movement rehabilitation

The long-term product is a personal AI follow-through layer for health and wellbeing.
