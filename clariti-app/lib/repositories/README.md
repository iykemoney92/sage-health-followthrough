# Repositories

Persistence adapters live here.

Expected repository modules:

- `documents-repository.ts`
- `sessions-repository.ts`
- `artifacts-repository.ts`
- `actions-repository.ts`

Repositories should return typed domain objects and hide Supabase table details from the app layer.
