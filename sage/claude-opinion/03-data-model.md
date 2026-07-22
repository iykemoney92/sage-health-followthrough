# Data Model

This refines the draft schema in `sage/project-summary/MAIN_PROJECT_SUMMARY.md` into an actual Postgres schema for Supabase. Same six entities, now with types, enums, and foreign keys.

```sql
-- enums

create type plan_type as enum ('wellbeing', 'health_follow_up', 'mixed');
create type plan_status as enum ('draft', 'active', 'paused', 'completed', 'archived');
create type session_status as enum ('pending', 'active', 'completed', 'skipped');
create type checkin_channel as enum ('whatsapp_text', 'whatsapp_voice', 'app', 'reminder');
create type upload_source as enum ('gp_note', 'therapy_note', 'occupational_health', 'user_upload', 'other');

-- profiles (extends Supabase auth.users — don't duplicate what auth already stores)

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  phone text,
  timezone text default 'Europe/London',
  preferences jsonb default '{}',
  created_at timestamptz default now()
);

-- plans

create table plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  type plan_type not null,
  goal text,
  source_context text,
  status plan_status not null default 'draft',
  progress numeric not null default 0 check (progress >= 0 and progress <= 1),
  start_date date,
  end_date date,
  check_in_channel checkin_channel not null default 'app',
  created_at timestamptz default now()
);

-- sessions (the individual steps/check-ins within a plan)

create table sessions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references plans(id) on delete cascade,
  "order" int not null,
  title text not null,
  objective text,
  status session_status not null default 'pending',
  scheduled_at timestamptz,
  channel checkin_channel not null default 'app',
  prompt_script text,              -- Claude-generated check-in script for this session
  expected_inputs jsonb not null default '[]',  -- e.g. ["Taken", "Not yet", "Heavy day"]
  created_at timestamptz default now(),
  unique (plan_id, "order")
);

-- session_runs (an actual check-in conversation instance)

create table session_runs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  transcript jsonb not null default '[]',   -- [{ role: 'sage'|'user', content, at }]
  summary text,
  user_responses jsonb not null default '{}',
  completed_at timestamptz,
  created_at timestamptz default now()
);

-- memories (approved context Sage retains across sessions)

create table memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  content text not null,
  source text,                      -- e.g. 'session_run:<id>', 'upload:<id>', 'onboarding'
  approved boolean not null default false,
  created_at timestamptz default now()
);

-- uploads (GP notes, therapy notes, etc.)

create table uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  plan_id uuid references plans(id) on delete set null,
  file_url text not null,
  extracted_text text,
  summary text,
  source_type upload_source not null default 'other',
  created_at timestamptz default now()
);
```

## Indexes worth adding early

```sql
create index on plans (user_id, status);
create index on sessions (plan_id, "order");
create index on session_runs (session_id);
create index on memories (user_id, approved);
```

## Row Level Security

Supabase turns on RLS by default once policies exist. Standard pattern for every user-owned table:

```sql
alter table plans enable row level security;

create policy "users manage their own plans"
  on plans for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

Repeat the shape for `sessions` (via a join to `plans.user_id`), `session_runs` (via `sessions` → `plans`), `memories`, and `uploads`.

**Hackathon tradeoff:** if the demo runs on a single seeded user with no real login flow, RLS is a correctness nicety, not a demo requirement — you can skip it and query with the service role key from route handlers. I'd still enable it if there's a spare 20 minutes, because "we thought about data privacy" is a real point of difference for a *health* product in front of judges. It's a cheap credibility signal — see [05-open-questions.md](05-open-questions.md).

## What I deliberately didn't add

No `reminders` table separate from `sessions.scheduled_at` — the brief lists "reminders" as part of the plan/session model, but a second table for what is functionally the same scheduled-check-in concept adds a join without adding capability at MVP scope. If reminders need to diverge from sessions later (e.g. a reminder with no associated check-in conversation), split it out then.
