-- Care circle, cut 3: the update Nura writes *for* the circle.
--
-- A watcher should not have to reconstruct how things are going from a roadmap and a list of
-- check-in timestamps. Nura writes a short circle-facing update from the same circle-safe facts
-- the watcher may already read (plan, journey, check-in status, observations) - never from the
-- conversation or documents - and stores it here. The owner sees exactly the same text, so
-- there is never a version of "what my family is told" that the owner can't read themselves.

create table if not exists nura_plan_circle_updates (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references nura_plans(id) on delete cascade,
  -- Mirrors nura_plans.owner_id via trigger, like the other circle tables.
  owner_id uuid not null,
  body text not null,
  -- Which window of check-ins/observations the update covers.
  period_start timestamptz not null,
  period_end timestamptz not null,
  -- Who asked for it: 'owner', 'member' (a watcher tapped refresh) or 'schedule' (the weekly job).
  requested_by text not null default 'schedule' check (requested_by in ('owner', 'member', 'schedule')),
  created_at timestamptz not null default now()
);

create index if not exists nura_plan_circle_updates_plan_idx on nura_plan_circle_updates(plan_id, created_at desc);

alter table nura_plan_circle_updates enable row level security;

create or replace function public.nura_plan_circle_updates_set_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select owner_id into new.owner_id from nura_plans where id = new.plan_id;
  if new.owner_id is null then
    raise exception 'unknown plan';
  end if;
  return new;
end;
$$;

drop trigger if exists nura_plan_circle_updates_set_owner on nura_plan_circle_updates;
create trigger nura_plan_circle_updates_set_owner
  before insert or update on nura_plan_circle_updates
  for each row execute function public.nura_plan_circle_updates_set_owner();

drop policy if exists owner_access on nura_plan_circle_updates;
create policy owner_access on nura_plan_circle_updates
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists circle_member_read on nura_plan_circle_updates;
create policy circle_member_read on nura_plan_circle_updates
  for select using (public.nura_is_circle_member(plan_id));
