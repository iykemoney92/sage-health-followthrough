create table if not exists nura_plans (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  title text not null,
  category text not null default 'general_health',
  status text not null default 'draft',
  why_this_exists text not null,
  current_focus text not null,
  next_step text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists nura_source_contexts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  plan_id uuid references nura_plans(id) on delete cascade,
  kind text not null,
  title text not null,
  summary text not null,
  storage_path text,
  is_clinician_provided boolean not null default false,
  requires_user_confirmation boolean not null default false,
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists nura_messages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  plan_id uuid references nura_plans(id) on delete set null,
  role text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists nura_check_ins (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  plan_id uuid not null references nura_plans(id) on delete cascade,
  channel text not null default 'in_app',
  prompt text not null,
  scheduled_for timestamptz not null,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists nura_observations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  plan_id uuid not null references nura_plans(id) on delete cascade,
  source_context_id uuid references nura_source_contexts(id) on delete set null,
  label text not null,
  value text not null,
  recorded_at timestamptz not null default now()
);

create table if not exists nura_appointment_summaries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  plan_id uuid not null references nura_plans(id) on delete cascade,
  title text not null,
  user_reported_summary text not null,
  clinician_context_summary text,
  suggested_questions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
