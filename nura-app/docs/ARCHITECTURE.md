# Nura Architecture

Nura is a conversational health organisation companion. It turns health conversations, care instructions, documents, symptoms, routines, and wellbeing context into living Plans that can follow up over time.

## Product Surface

Primary navigation:

1. Today: what needs attention now, next check-in, reminders, and a composer.
2. My Plans: active and completed living Plans.
3. Calendar: check-ins, reminders, voice sessions, and appointments.
4. Me: memory controls, channel preferences, healthcare contacts, privacy, and support.

## MVP Demo Loop

The narrow hackathon loop should prove continuity without becoming too broad:

1. User messages Nura in-app or over WhatsApp about overwhelm, poor sleep, or a health follow-up.
2. User uploads a demo GP or care note.
3. Nura extracts relevant context and separates clinician-provided instructions from user goals.
4. Nura proposes one living Plan, such as `Stabilise My Week`.
5. User confirms imported instructions, reminders, and check-in preferences.
6. Nura schedules a proactive WhatsApp message, WhatsApp voice-style check-in, or in-app reminder.
7. User response updates the Plan as an observation.
8. Nura generates a concise appointment-preparation summary.

## App Layers

- `app` contains Next.js routes and future API route handlers.
- `components` contains reusable UI and shell composition.
- `lib/domain` should contain Plan orchestration rules without framework dependencies.
- `lib/schemas` contains Zod contracts shared by APIs, AI outputs, and persistence.
- `lib/ai` should contain prompt orchestration and structured extraction.
- `lib/integrations` should contain Supabase, Anthropic, WhatsApp, voice, and document clients.
- `lib/repositories` should hide table details behind typed methods.
- `types` contains shared TypeScript product contracts.
- `supabase/migrations` contains the database schema.

## Safety Boundaries

Nura is not a doctor, therapist, or autonomous treatment system.

- Do not diagnose conditions.
- Do not prescribe, stop, change, or recommend medication doses.
- Do not tell users they do not need professional care.
- Separate clinician-provided instructions, user goals, and AI suggestions.
- Ask users to confirm imported instructions before they become reminders or Plan actions.
- Route urgent symptoms and crisis language to appropriate support.
- Label health data as user-reported unless it comes from an explicit document source.

## WhatsApp Continuity

Nura should use WhatsApp as a first-class communication channel for proactive follow-through. The app remains the place to review Threads, calendar events, memory, uploads, and summaries, but WhatsApp is the lightweight daily channel for check-ins, reminders, voice-style follow-ups, and user replies.

Implementation expectations:

- WhatsApp can initiate or continue a Thread when the user sends new context.
- Scheduled check-ins should default to WhatsApp when the user has opted in.
- WhatsApp responses should be stored as user-reported observations.
- Nura must preserve the same safety boundaries on WhatsApp as inside the app.
- Users can switch between WhatsApp and in-app follow-up preferences from `Me`.
