create table if not exists nura_calendar_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid references nura_plans(id) on delete set null,
  title text not null,
  event_type text not null default 'appointment',
  starts_at timestamptz not null,
  channel text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists nura_calendar_events_owner_idx on nura_calendar_events (owner_id, starts_at);
