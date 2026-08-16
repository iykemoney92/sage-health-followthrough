create table if not exists nura_native_push_tokens (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  token text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists nura_native_push_tokens_owner_idx on nura_native_push_tokens(owner_id);

alter table nura_native_push_tokens enable row level security;

create policy "owner_access" on nura_native_push_tokens
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
