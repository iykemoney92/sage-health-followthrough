-- Reconciled schema — see sage/technical-plan.md for the reasoning behind every choice here.

create type plan_type as enum ('wellbeing', 'health_follow_up', 'mixed');
create type plan_status as enum ('draft', 'active', 'paused', 'completed', 'archived');
create type session_status as enum ('upcoming', 'today', 'completed', 'skipped', 'rescheduled');
create type checkin_channel as enum ('whatsapp_text', 'whatsapp_voice', 'web_chat', 'reminder');
create type upload_source as enum ('gp_note', 'therapy_note', 'occupational_health', 'user_upload', 'other');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  timezone text default 'Europe/London',
  preferred_channel checkin_channel default 'web_chat',
  voice_enabled boolean default false,
  preferences jsonb default '{}',
  created_at timestamptz default now()
);

create table plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  type plan_type not null,
  goal text,
  source_summary text,
  status plan_status not null default 'draft',
  progress numeric not null default 0 check (progress >= 0 and progress <= 1),
  start_date date,
  end_date date,
  check_in_channel checkin_channel not null default 'web_chat',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references plans(id) on delete cascade,
  order_index int not null,
  title text not null,
  objective text,
  status session_status not null default 'upcoming',
  scheduled_at timestamptz,
  channel checkin_channel not null default 'web_chat',
  prompt_script text,
  expected_inputs jsonb not null default '[]',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (plan_id, order_index)
);

create table session_runs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  started_at timestamptz default now(),
  completed_at timestamptz,
  transcript jsonb not null default '[]',
  structured_responses jsonb not null default '{}',
  summary text,
  next_action text,
  created_at timestamptz default now()
);

create table memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  content text not null,
  source text,
  approved boolean not null default false,
  created_at timestamptz default now()
);

create table uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  plan_id uuid references plans(id) on delete set null,
  file_name text,
  file_type text,
  file_url text not null,
  extracted_text text,
  summary text,
  source_type upload_source default 'other',
  created_at timestamptz default now()
);

create index on plans (user_id, status);
create index on sessions (plan_id, order_index);
create index on session_runs (session_id);
create index on memories (user_id, approved);

alter table profiles enable row level security;
alter table plans enable row level security;
alter table sessions enable row level security;
alter table session_runs enable row level security;
alter table memories enable row level security;
alter table uploads enable row level security;

create policy "users manage their own profile"
  on profiles for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "users manage their own plans"
  on plans for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users manage sessions on their own plans"
  on sessions for all
  using (auth.uid() = (select user_id from plans where plans.id = sessions.plan_id))
  with check (auth.uid() = (select user_id from plans where plans.id = sessions.plan_id));

create policy "users manage runs on their own sessions"
  on session_runs for all
  using (
    auth.uid() = (
      select plans.user_id from plans
      join sessions on sessions.plan_id = plans.id
      where sessions.id = session_runs.session_id
    )
  )
  with check (
    auth.uid() = (
      select plans.user_id from plans
      join sessions on sessions.plan_id = plans.id
      where sessions.id = session_runs.session_id
    )
  );

create policy "users manage their own memories"
  on memories for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users manage their own uploads"
  on uploads for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
