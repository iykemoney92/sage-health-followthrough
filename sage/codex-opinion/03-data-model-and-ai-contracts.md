# 03 Data Model And AI Contracts

## Core Tables

### profiles

Stores user profile/preferences.

Fields:

- id
- full_name
- phone
- timezone
- preferred_channel
- voice_enabled
- created_at

### plans

Stores each follow-through plan.

Fields:

- id
- user_id
- title
- type
- goal
- status
- progress
- source_summary
- created_at
- updated_at

Plan types:

- wellbeing
- health_follow_up
- occupational_health
- routine
- mixed

### sessions

Stores planned check-ins/sessions.

Fields:

- id
- plan_id
- order_index
- title
- objective
- status
- scheduled_at
- channel
- created_at
- updated_at

Session statuses:

- upcoming
- today
- completed
- skipped
- rescheduled

Channels:

- whatsapp_text
- whatsapp_voice
- web_chat
- reminder

### session_runs

Stores actual user interactions.

Fields:

- id
- session_id
- started_at
- completed_at
- transcript
- structured_responses
- summary
- next_action

### memories

Stores user-approved memory/context.

Fields:

- id
- user_id
- content
- source
- approved
- created_at

### uploads

Stores uploaded notes/files.

Fields:

- id
- user_id
- plan_id
- file_name
- file_type
- file_url
- extracted_text
- summary
- source_type
- created_at

## AI Contract: Generate Plan

Input:

```json
{
  "user_message": "I’m overwhelmed, barely sleeping, and my GP told me to start walking daily.",
  "known_context": [],
  "timezone": "Europe/London",
  "preferred_channel": "whatsapp_voice"
}
```

Output:

```json
{
  "title": "Stabilise My Week",
  "type": "mixed",
  "goal": "Make the next week feel manageable while supporting sleep, mood, medication/routine, and movement.",
  "source_summary": "User reports overwhelm, poor sleep, and GP advice to walk daily.",
  "sessions": [
    {
      "order_index": 1,
      "title": "Start gently",
      "objective": "Understand what feels heaviest and choose one small action.",
      "scheduled_offset_days": 0,
      "channel": "whatsapp_text"
    }
  ],
  "safety_notes": [
    "Not a diagnosis",
    "Encourage urgent support if user expresses immediate danger"
  ]
}
```

## AI Contract: Generate Check-In

Input:

```json
{
  "plan_title": "Stabilise My Week",
  "session_title": "Medication + mood",
  "session_objective": "Check medication/routine completion and mood load.",
  "prior_summaries": [],
  "user_preferences": {
    "tone": "gentle",
    "channel": "whatsapp_voice"
  }
}
```

Output:

```json
{
  "opening": "Today is Day 2. Let’s keep it light.",
  "questions": [
    "Did you take your medication?",
    "How heavy does today feel from 1-10?",
    "Would a short walk be realistic?"
  ],
  "quick_replies": [
    "Taken",
    "Not yet",
    "Heavy day",
    "I can walk 10 min"
  ]
}
```

## AI Contract: Summarize Session

Input:

```json
{
  "session_title": "Medication + mood",
  "responses": [
    "Taken",
    "Heavy day"
  ],
  "free_text": "I slept badly and feel drained."
}
```

Output:

```json
{
  "summary": "User took medication but reported a heavy day and poor sleep.",
  "progress_update": {
    "session_status": "completed",
    "plan_progress_delta": 10
  },
  "next_action": "Keep tomorrow’s check-in focused on sleep reset and one low-effort recovery action.",
  "safety_flag": "none"
}
```

## Safety Layer

Before saving or acting on AI output:

- validate JSON shape
- reject diagnosis/treatment claims
- detect crisis language
- keep medication language as adherence/check-in only
- ask for user confirmation before converting imported clinical instructions into a plan

## Codex Recommendation

Use Zod schemas for every AI response. If the AI response fails validation, fall back to a safe seeded plan rather than breaking the demo.
