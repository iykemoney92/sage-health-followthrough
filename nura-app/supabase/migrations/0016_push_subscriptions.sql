create table if not exists nura_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists nura_push_subscriptions_owner_idx on nura_push_subscriptions(owner_id);

alter table nura_push_subscriptions enable row level security;

create policy "owner_access" on nura_push_subscriptions
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
