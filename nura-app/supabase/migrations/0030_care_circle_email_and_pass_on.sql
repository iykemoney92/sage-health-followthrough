-- Care circle, cut 5: email delivery and "anything to pass on?".
--
-- 1. Email. Push only reaches a watcher who installed the app and allowed notifications, so the
--    weekly update and missed-check-in alerts now go by email too. Each watcher can switch email
--    off for a plan, from the plan page or from the link in any email, without leaving the circle.
--
-- 2. Pass-on notes. The circle never sees the owner's conversation with Nura. A pass-on note is
--    the one exception, and only by the owner's choice: words the owner wrote themselves, or that
--    Nura read back to them on a call and they said yes to sending. Notes are shown verbatim -
--    never paraphrased by a model - and the owner can withdraw one at any time.

alter table nura_plan_members
  add column if not exists email_updates boolean not null default true;

comment on column nura_plan_members.email_updates is
  'Watcher preference: receive this plan''s circle updates and alerts by email.';

-- A watcher may change only this one column on only their own membership. A member UPDATE
-- policy would also let them edit role/revoked_at, so it goes through a narrow function instead.
create or replace function public.nura_set_circle_email_updates(target_plan uuid, enabled boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  changed int;
begin
  update nura_plan_members
     set email_updates = enabled
   where plan_id = target_plan and member_id = auth.uid() and revoked_at is null;
  get diagnostics changed = row_count;
  return changed > 0;
end;
$$;
revoke all on function public.nura_set_circle_email_updates(uuid, boolean) from public;
grant execute on function public.nura_set_circle_email_updates(uuid, boolean) to authenticated;

create table if not exists nura_plan_circle_notes (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references nura_plans(id) on delete cascade,
  -- Mirrors nura_plans.owner_id via trigger, like the other circle tables.
  owner_id uuid not null,
  body text not null check (char_length(btrim(body)) between 1 and 500),
  -- 'owner_app': typed by the owner. 'voice_call': read back on a call and confirmed by the owner.
  source text not null check (source in ('owner_app', 'voice_call')),
  check_in_id uuid references nura_check_ins(id) on delete set null,
  withdrawn_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists nura_plan_circle_notes_plan_idx on nura_plan_circle_notes(plan_id, created_at desc);

alter table nura_plan_circle_notes enable row level security;

create or replace function public.nura_plan_circle_notes_set_owner()
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

drop trigger if exists nura_plan_circle_notes_set_owner on nura_plan_circle_notes;
create trigger nura_plan_circle_notes_set_owner
  before insert or update on nura_plan_circle_notes
  for each row execute function public.nura_plan_circle_notes_set_owner();

drop policy if exists owner_access on nura_plan_circle_notes;
create policy owner_access on nura_plan_circle_notes
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- A withdrawn note disappears for the circle at once; the owner still sees it in their own list.
drop policy if exists circle_member_read on nura_plan_circle_notes;
create policy circle_member_read on nura_plan_circle_notes
  for select using (withdrawn_at is null and public.nura_is_circle_member(plan_id));
