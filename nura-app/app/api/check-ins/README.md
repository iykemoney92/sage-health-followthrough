# Check-ins API

Future route handlers should schedule and record proactive follow-through.

Initial responsibilities:

- Store planned WhatsApp messages, WhatsApp voice-style check-ins, and in-app reminders.
- Record user responses as observations.
- Update Plan status and next-step summaries.

WhatsApp is a primary Nura follow-through channel for lightweight reminders, user replies, and voice-style check-ins. Check-ins should only be sent after user opt-in and should respect quiet hours, safety routing, and memory controls.

Idle wellness: when a Plus user has an active Care plan but no open scheduled check-in and no contact for ~3 days, `/api/agent/trigger-check-ins` invents a gentle wellness check-in (calendar emptiness does not block this). Quiet hours, when enabled, skip idle outreach.
