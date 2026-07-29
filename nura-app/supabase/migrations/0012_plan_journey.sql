create table if not exists nura_plan_milestones (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  plan_id uuid not null references nura_plans(id) on delete cascade,
  title text not null,
  description text,
  order_index int not null default 0,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists nura_plan_steps (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  plan_id uuid not null references nura_plans(id) on delete cascade,
  milestone_id uuid not null references nura_plan_milestones(id) on delete cascade,
  title text not null,
  context_prompt text not null,
  order_index int not null default 0,
  status text not null default 'pending',
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists nura_plan_milestones_plan_idx on nura_plan_milestones(plan_id);
create index if not exists nura_plan_steps_milestone_idx on nura_plan_steps(milestone_id);
create index if not exists nura_plan_steps_plan_idx on nura_plan_steps(plan_id);
