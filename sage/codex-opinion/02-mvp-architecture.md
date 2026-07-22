# 02 MVP Architecture

## Architecture Overview

```text
User
  |
  | Web app / WhatsApp-style chat
  v
Next.js App Router
  |
  | Server actions / API routes
  v
Supabase Postgres + Storage
  |
  | AI calls
  v
Anthropic Claude
  |
  | Optional voice
  v
ElevenLabs
```

## App Surfaces

### Web App

The web app is the source of truth.

Routes:

- `/` - app entry or demo landing
- `/today` - daily overview
- `/plans` - plan list
- `/plans/[id]` - plan detail
- `/calendar` - scheduled check-ins
- `/me` - preferences and safety
- `/chat` - optional WhatsApp-style simulator

For the hackathon, `/today` can be the first authenticated screen.

### WhatsApp-Style Simulator

Use a local chat UI that looks and behaves like WhatsApp:

- inbound Sage messages
- user replies
- quick reply buttons
- document upload placeholder
- voice check-in tile

This protects the demo from WhatsApp provisioning risk while keeping the product story intact.

### AI Layer

Wrap AI calls in a small service layer:

- `generatePlan(input)`
- `generateCheckIn(sessionContext)`
- `summarizeSession(runTranscript)`
- `extractUploadedContext(fileText)`

Never call the AI directly from UI components.

## Backend Boundaries

Use server-side logic for:

- plan generation
- session updates
- upload text extraction
- summary creation
- safety checks

Use client-side logic for:

- UI state
- optimistic quick replies
- modal/drawer interactions
- calendar display

## Scheduling Strategy

For MVP:

- Store `scheduled_at` on sessions.
- Display schedule in UI.
- Add a “Trigger check-in now” demo button.

For later:

- Vercel Cron or Supabase scheduled functions can scan due sessions.
- Due sessions can trigger WhatsApp, email, push, or voice.

## Upload Strategy

For MVP:

- Allow text paste or demo PDF/image upload.
- Store file metadata.
- Extract text if simple.
- Let AI summarize imported context.

For later:

- Supabase Storage
- OCR
- email forwarding
- Apple Health
- NHS/GP record integrations

## Recommended Folder Structure

```text
sage-app/
  app/
    today/
    plans/
    plans/[id]/
    calendar/
    me/
    api/
      ai/
      checkins/
      uploads/
  components/
    layout/
    plans/
    calendar/
    chat/
    ui/
  lib/
    ai/
    data/
    demo/
    safety/
    supabase/
  types/
  supabase/
    migrations/
    seed.sql
```

## Codex Recommendation

Start with a local seeded app first. Then connect Supabase. Then connect AI. The user experience should be visible from day one.
