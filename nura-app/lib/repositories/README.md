# Repositories

Persistence adapters live here.

Expected repository modules:

- `plans-repository.ts`
- `source-contexts-repository.ts`
- `check-ins-repository.ts`
- `observations-repository.ts`
- `appointment-summaries-repository.ts`

Repositories should return typed domain objects and hide Supabase table details from the app layer.
