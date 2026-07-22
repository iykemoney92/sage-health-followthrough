# Sage Main Project Summary

## Project Name

Sage

## Product Direction

Sage is a proactive AI follow-through companion for health and wellbeing plans. It helps users turn overwhelming life, mental wellbeing, therapy, GP, medication, lifestyle, chronic illness, and occupational-health context into structured plans they can actually follow.

Sage should feel supportive, calm, practical, and trustworthy. It should not feel like a hospital portal, generic chatbot, AI therapist, or AI doctor.

## Core Idea

People receive advice, goals, therapy homework, care instructions, medication routines, and lifestyle recommendations, but they are often left alone to follow through. Sage turns that context into a plan, schedules check-ins, supports the user through WhatsApp text or voice, and saves progress summaries.

## One-Liner

Sage turns health and wellbeing goals into proactive plans you can actually follow.

## MVP Goal

Build one simple but scalable plan engine that can support multiple health and wellbeing areas without building separate products for each one.

The MVP should prove this loop:

1. User shares what they are dealing with.
2. Sage creates a structured plan.
3. Plan appears in the app.
4. Check-ins are scheduled on a calendar.
5. Sage checks in through WhatsApp-style text or voice.
6. User responses update progress.
7. Sage generates a useful summary.

## Hackathon Demo Scenario

User message:

> “I’m overwhelmed, barely sleeping, and my GP told me to start walking daily.”

Sage creates:

## Stabilise My Week

Plan type: Wellbeing + Health Follow-Up

Example plan sessions:

- Day 1: Start gently
- Day 2: Medication + mood
- Day 3: Sleep reset
- Day 4: 10-minute walk
- Day 5: Relationship reflection
- Day 6: GP note review
- Day 7: Weekly summary

Example check-in:

> “Today is Day 2. Let’s keep it light. Did you take your medication? How heavy does today feel from 1-10? Would a short walk be realistic?”

Quick replies:

- Taken
- Not yet
- Heavy day
- I can walk 10 min

## Product Scope

### Build For MVP

- Onboarding or intake
- AI plan generation
- Today dashboard
- My Plans
- Plan detail journey
- Calendar/check-ins
- WhatsApp-style chat/check-in UI
- Voice check-in placeholder or integration
- Session summary/progress update
- Basic user preferences

### Keep Out Of MVP

- Diagnosis
- Therapy claims
- Full medical record integration
- Payments
- Admin portal
- Large plan marketplace
- Complex wearable integrations
- Dozens of templates
- Clinician-facing workflows

## Core Navigation

- Today
- My Plans
- Calendar
- Me

WhatsApp/message and voice check-in should be primary actions across the app, not a separate heavy inbox.

## Main Screens

### Today

Shows what needs attention now:

- Next check-in
- Active plans
- Weekly check-in strip
- What Sage is tracking
- Message Sage
- Voice check-in

### My Plans

Shows active and completed plans:

- Managing Emotional Overload
- Blood Pressure Follow-Through
- Sleep Reset
- Therapy Homework
- Return-to-Work Plan
- Chronic Illness Routine

### Plan Detail

Shows a single plan:

- Plan title
- Plan type
- Source context
- Journey timeline
- Current session
- Upcoming sessions
- Weekly focus
- Message Sage
- Reschedule
- Export summary

### Calendar

Shows scheduled check-ins and reminders across plans.

### Me

Shows preferences, WhatsApp connection, voice settings, privacy, memory controls, uploads, and safety/support resources.

## Data Model Draft

### users

- id
- name
- phone
- timezone
- preferences

### plans

- id
- user_id
- title
- type
- goal
- source_context
- status
- progress
- created_at

### sessions

- id
- plan_id
- order
- title
- objective
- status
- scheduled_at
- channel

### session_runs

- id
- session_id
- transcript
- summary
- user_responses
- completed_at

### memories

- id
- user_id
- content
- source
- approved
- created_at

### uploads

- id
- user_id
- plan_id
- file_url
- extracted_text
- summary
- source_type

## Technical Stack

Recommended hackathon stack:

- Next.js + TypeScript
- Vercel
- Supabase Auth + Postgres + Storage
- Anthropic Claude for plan generation and summarization
- ElevenLabs for voice if feasible
- WhatsApp integration if feasible, otherwise WhatsApp-style simulator for demo

## AI Functions

### Context Intake

Turns messy user input into structured context, goals, constraints, and possible plan type.

### Plan Generation

Creates a plan title, goal, sessions, reminders, check-in cadence, and safety boundaries.

### Check-In Generation

Creates the short WhatsApp/voice script for the current scheduled session.

### Session Summarization

Summarizes user responses, extracts progress, updates the current session, and suggests the next action.

## Safety Boundaries

Sage should:

- Avoid diagnosis
- Avoid treatment instructions
- Never tell users to stop medication
- Encourage professional support where appropriate
- Route crisis or urgent language to urgent support
- Ask users to confirm imported professional instructions
- Keep memory transparent and user-controlled

Sage should say:

- “I can help you follow through on the plan you already have.”
- “This is not a diagnosis.”
- “If symptoms feel urgent or unsafe, contact urgent or emergency support.”

Sage should not say:

- “You have depression.”
- “Stop taking this medication.”
- “You do not need to see a doctor.”
- “This will treat your condition.”

## Design Direction

The UI should be:

- Calm
- Elegant
- Emotionally supportive
- Structured
- Consumer-friendly
- Less clinical than a hospital portal
- More organized than a chatbot

Visual direction:

- Warm off-white base
- Muted sage green primary
- Soft blue secondary
- Charcoal text
- Amber only for pending states
- 8px card radius
- Simple cards
- Journey timelines
- Calendar strips
- Progress indicators
- WhatsApp-style quick replies

Avoid:

- Medical cross branding
- Hospital imagery
- Pill bottles as hero visuals
- Cartoon mascots
- Childish gamification
- Heavy gradients
- Alarming red except true urgent states

## Success Criteria

The MVP succeeds if a judge can understand within 90 seconds:

- The user is overwhelmed and needs help following through.
- Sage turns messy context into a structured plan.
- The plan has scheduled check-ins.
- WhatsApp/voice makes support proactive.
- User responses update progress.
- The same system can expand into wellbeing, chronic illness routines, GP aftercare, occupational health, and lifestyle goals.

## Current Working Folder

Use this folder as the source of truth for product summary and build planning:

`sage/project-summary`

Related design/product docs live in:

`sage/product-docs`
