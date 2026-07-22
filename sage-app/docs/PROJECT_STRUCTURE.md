# Project Structure

Sage starts as a backend/tool scaffold. Pages come later.

```text
sage-app/
  app/
    api/
      agent/
        get-user-context/
        create-followthrough-plan/
        update-plan-from-checkin/
        schedule-checkin/
        generate-progress-summary/
      webhooks/
        elevenlabs/
          post-call/
  lib/
    agent-tools/
    domain/
      plans/
      checkins/
      users/
      uploads/
      summaries/
      safety/
    integrations/
      elevenlabs/
      whatsapp/
      anthropic/
      supabase/
    repositories/
    schemas/
  supabase/
    migrations/
  types/
```

## Principle

Do not build the dashboard first.

Build the tool contract first so the WhatsApp agent can create, update, and run plans. The dashboard should later visualize real plan state produced by those tools.

