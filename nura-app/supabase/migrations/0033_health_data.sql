-- Health data, first cut: daily summaries read from Apple Health / Health Connect.
--
-- These tables belong to the person, not to a Care plan, and deliberately have no
-- circle_member_read policy. nura_observations is readable by a plan's Care circle
-- (0025), so health data must never be written there. lib/health/rls-guard.test.ts
-- fails if this migration ever grows a circle policy.

create table if not exists nura_health_connections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('apple_health', 'health_connect')),
  -- Nura's own consent screen, minted server-side. The OS permission sheet comes after it.
  consented_at timestamptz not null,
  consent_version text not null,
  -- What Nura asked for. HealthKit never says which read permissions were granted.
  metrics text[] not null,
  last_synced_at timestamptz,
  last_sync_status text check (last_sync_status in ('ok', 'no_data', 'error')),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (owner_id, platform)
);

-- Daily summaries only, never raw samples. `day` is the user's local date.
create table if not exists nura_health_daily (
  owner_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  metric text not null check (metric in ('steps', 'sleep_minutes', 'resting_hr', 'weight_kg', 'blood_pressure')),
  value numeric not null,
  -- Diastolic for blood_pressure; null otherwise.
  value_secondary numeric,
  sample_count int not null default 1,
  platform text not null check (platform in ('apple_health', 'health_connect')),
  synced_at timestamptz not null default now(),
  primary key (owner_id, day, metric)
);

create index if not exists nura_health_daily_owner_day on nura_health_daily (owner_id, day desc);

-- Why Nura reached out on the strength of health data. Dedupes triggers and answers
-- "why did Nura call me?".
create table if not exists nura_health_signals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid references nura_plans(id) on delete set null,
  signal text not null check (signal in ('sleep_drop', 'activity_drop')),
  window_start date not null,
  detail jsonb not null default '{}'::jsonb,
  check_in_id uuid references nura_check_ins(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (owner_id, signal, window_start)
);

create index if not exists nura_health_signals_owner_created on nura_health_signals (owner_id, created_at desc);

alter table nura_health_connections enable row level security;
alter table nura_health_daily enable row level security;
alter table nura_health_signals enable row level security;

drop policy if exists "owner_access" on nura_health_connections;
create policy "owner_access" on nura_health_connections
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "owner_access" on nura_health_daily;
create policy "owner_access" on nura_health_daily
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Signals are written by the dispatcher (service role); the owner may read and delete theirs.
drop policy if exists "owner_read" on nura_health_signals;
create policy "owner_read" on nura_health_signals
  for select using (owner_id = auth.uid());

drop policy if exists "owner_delete" on nura_health_signals;
create policy "owner_delete" on nura_health_signals
  for delete using (owner_id = auth.uid());

comment on table nura_health_daily is
  'Daily health summaries from Apple Health / Health Connect. Owner-only: never add a Care circle policy.';
