-- Care circle, cut 2: invite links.
--
-- An invite is a one-person, seven-day, single-use link. Only a hash of the token is stored,
-- so a read of this table never yields a usable link. The owner manages their own invites
-- through RLS; acceptance is done server-side with the service role, because the person
-- accepting is - by definition - not yet allowed to see anything about the plan.

create table if not exists nura_plan_invites (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references nura_plans(id) on delete cascade,
  -- Mirrors nura_plans.owner_id via trigger, same reasoning as nura_plan_members.
  owner_id uuid not null,
  token_hash text not null unique,
  created_by uuid not null,
  expires_at timestamptz not null,
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists nura_plan_invites_plan_idx on nura_plan_invites(plan_id);

alter table nura_plan_invites enable row level security;

create or replace function public.nura_plan_invites_set_owner()
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

drop trigger if exists nura_plan_invites_set_owner on nura_plan_invites;
create trigger nura_plan_invites_set_owner
  before insert or update on nura_plan_invites
  for each row execute function public.nura_plan_invites_set_owner();

drop policy if exists owner_manages_invites on nura_plan_invites;
create policy owner_manages_invites on nura_plan_invites
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
