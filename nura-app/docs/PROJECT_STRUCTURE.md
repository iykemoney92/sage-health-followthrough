# Project Structure

```text
nura-app/
  app/
    page.tsx                  Today composer
    workspace/page.tsx        Living Plan workspace
    plans/page.tsx            Plan list scaffold
    calendar/page.tsx         Follow-up schedule scaffold
    me/page.tsx               Memory and preference scaffold
    api/
      plans/README.md         Future Plan route handlers
      check-ins/README.md     Future proactive follow-up handlers
  components/
    nura-shell.tsx            Shared navigation shell
  lib/
    ai/                       Prompt and extraction orchestration
    domain/                   Plan engine rules
    integrations/             Supabase, Anthropic, WhatsApp, voice, parsing
    repositories/             Persistence adapters
    schemas/nura.ts           Zod API and AI contracts
  supabase/
    migrations/0001_init.sql  Initial persistence model
  types/
    nura.ts                   Shared product types
```

The scaffold is intentionally narrow. It supports the first demo journey before expanding into the broader personal health companion vision.
