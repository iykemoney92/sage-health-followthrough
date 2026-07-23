# Project Structure

```text
clariti-app/
  app/
    (workspace)/workspace/     Three-panel app shell route
    api/                       Future document, session, and artifact APIs
    globals.css                Shared CSS tokens and Tailwind import
    layout.tsx                 Root app layout
    page.tsx                   Scaffold landing/status screen
  components/
    ui/                        Reusable interface primitives
    workspace/                 Clariti workspace composition
  docs/
    ARCHITECTURE.md            Product and technical architecture
    PROJECT_STRUCTURE.md       Directory map
    UI_IMPLEMENTATION_NOTES.md Product-design implementation notes
  lib/
    ai/                        Anthropic and structured extraction helpers
    domain/                    Product rules and state transitions
    integrations/              External provider clients
    repositories/              Persistence adapters
    schemas/                   Zod contracts
    utils.ts                   Shared utility helpers
  supabase/
    migrations/                Database schema
  types/
    clariti.ts                 Shared product types
../clariti/
  ui:ux/                       Product design image references
```

## Current Status

This is a scaffold, not the finished Clariti UI. The shell exists so implementation can proceed screen-by-screen from the product designs without reworking the project foundation.
