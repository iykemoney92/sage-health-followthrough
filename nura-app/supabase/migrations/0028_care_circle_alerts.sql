-- Care circle, cut 4: "tell my circle if I miss a check-in".
--
-- Opt-in, per plan, off by default. When it is on and a scheduled check-in is still not done a
-- day later, the people in the circle get a gentle nudge and a record of it appears on the
-- plan for them - and for the owner, who always sees what their circle was told.

alter table nura_plans
  add column if not exists circle_alert_missed boolean not null default false;

comment on column nura_plans.circle_alert_missed is
  'Owner opt-in: notify care-circle members when a check-in on this plan is missed.';

-- Stamped once an alert has gone out for a check-in so it is never reported twice.
alter table nura_check_ins
  add column if not exists circle_alerted_at timestamptz;

create table if not exists nura_plan_circle_alerts (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references nura_plans(id) on delete cascade,
  owner_id uuid not null,
  check_in_id uuid references nura_check_ins(id) on delete set null,
  kind text not null default 'missed_check_in' check (kind in ('missed_check_in')),
  body text not null,
  scheduled_for timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists nura_plan_circle_alerts_plan_idx on nura_plan_circle_alerts(plan_id, created_at desc);

alter table nura_plan_circle_alerts enable row level security;

create or replace function public.nura_plan_circle_alerts_set_owner()
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

drop trigger if exists nura_plan_circle_alerts_set_owner on nura_plan_circle_alerts;
create trigger nura_plan_circle_alerts_set_owner
  before insert or update on nura_plan_circle_alerts
  for each row execute function public.nura_plan_circle_alerts_set_owner();

drop policy if exists owner_access on nura_plan_circle_alerts;
create policy owner_access on nura_plan_circle_alerts
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists circle_member_read on nura_plan_circle_alerts;
create policy circle_member_read on nura_plan_circle_alerts
  for select using (public.nura_is_circle_member(plan_id));
