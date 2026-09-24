-- Care circle, cut 1: a plan owner can let other signed-in people *watch* a Care plan.
--
-- Until now every row in Nura belonged to exactly one person (owner_id = auth.uid() on every
-- table). A circle adds a second axis of access, so it is enforced here in Postgres rather
-- than in route code: revoking someone must mean the database says no, everywhere, at once.
--
-- What a watcher can read: the plan, its journey (milestones/steps), check-ins and recent
-- observations. What they can never read: the conversation (nura_messages), shared documents
-- (nura_source_contexts), or the owner's profile row. Nothing is writable by a watcher.

create table if not exists nura_plan_members (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references nura_plans(id) on delete cascade,
  -- Mirrors nura_plans.owner_id (kept in sync by trigger) so policies never have to join.
  owner_id uuid not null,
  member_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'watcher' check (role in ('watcher')),
  invited_by uuid,
  accepted_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (plan_id, member_id)
);

create index if not exists nura_plan_members_member_idx on nura_plan_members(member_id) where revoked_at is null;
create index if not exists nura_plan_members_plan_idx on nura_plan_members(plan_id);

alter table nura_plan_members enable row level security;

-- owner_id is derived from the plan, never trusted from the caller: a request that names a
-- plan it does not own ends up with someone else's owner_id and fails the WITH CHECK below.
create or replace function public.nura_plan_members_set_owner()
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
  if new.member_id = new.owner_id then
    raise exception 'the owner is already part of their own Care plan';
  end if;
  return new;
end;
$$;

drop trigger if exists nura_plan_members_set_owner on nura_plan_members;
create trigger nura_plan_members_set_owner
  before insert or update on nura_plan_members
  for each row execute function public.nura_plan_members_set_owner();

-- The one predicate every circle policy uses. SECURITY DEFINER so the policies on other tables
-- can consult memberships without recursing into nura_plan_members' own RLS.
create or replace function public.nura_is_circle_member(target_plan uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from nura_plan_members m
    where m.plan_id = target_plan and m.member_id = auth.uid() and m.revoked_at is null
  );
$$;
revoke all on function public.nura_is_circle_member(uuid) from public;
grant execute on function public.nura_is_circle_member(uuid) to authenticated;

-- Watchers need the owner's first name for the "Shared with you by" banner and nothing else
-- from the profile row, so hand out exactly that instead of a profile SELECT policy.
create or replace function public.nura_circle_owner_name(target_plan uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(nullif(trim(p.display_name), ''), 'Someone')
  from nura_plans pl
  left join nura_profiles p on p.id = pl.owner_id
  where pl.id = target_plan
    and (pl.owner_id = auth.uid() or public.nura_is_circle_member(target_plan));
$$;
revoke all on function public.nura_circle_owner_name(uuid) from public;
grant execute on function public.nura_circle_owner_name(uuid) to authenticated;

-- Owner-only listing of who is in a plan's circle, with names the owner can recognise.
create or replace function public.nura_circle_members(target_plan uuid)
returns table (member_id uuid, display_name text, email text, accepted_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select m.member_id,
         coalesce(nullif(trim(p.display_name), ''), split_part(u.email, '@', 1)) as display_name,
         u.email::text,
         m.accepted_at
  from nura_plan_members m
  join nura_plans pl on pl.id = m.plan_id
  left join nura_profiles p on p.id = m.member_id
  left join auth.users u on u.id = m.member_id
  where m.plan_id = target_plan and m.revoked_at is null and pl.owner_id = auth.uid()
  order by m.accepted_at;
$$;
revoke all on function public.nura_circle_members(uuid) from public;
grant execute on function public.nura_circle_members(uuid) to authenticated;

-- Membership rows: the owner manages them; a member may only see their own.
drop policy if exists owner_manages_circle on nura_plan_members;
create policy owner_manages_circle on nura_plan_members
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists member_reads_own_membership on nura_plan_members;
create policy member_reads_own_membership on nura_plan_members
  for select using (member_id = auth.uid());

-- Read-only visibility for watchers. These are additive to the existing owner_access
-- policies; writes still require ownership everywhere.
drop policy if exists circle_member_read on nura_plans;
create policy circle_member_read on nura_plans
  for select using (public.nura_is_circle_member(id));

drop policy if exists circle_member_read on nura_plan_milestones;
create policy circle_member_read on nura_plan_milestones
  for select using (public.nura_is_circle_member(plan_id));

drop policy if exists circle_member_read on nura_plan_steps;
create policy circle_member_read on nura_plan_steps
  for select using (public.nura_is_circle_member(plan_id));

drop policy if exists circle_member_read on nura_check_ins;
create policy circle_member_read on nura_check_ins
  for select using (public.nura_is_circle_member(plan_id));

drop policy if exists circle_member_read on nura_observations;
create policy circle_member_read on nura_observations
  for select using (public.nura_is_circle_member(plan_id));
