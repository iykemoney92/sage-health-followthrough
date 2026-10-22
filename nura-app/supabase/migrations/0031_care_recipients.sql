-- Check in on someone you care for.
--
-- A Care plan can be about another person - an ageing parent, a partner - in which case Nura's
-- check-in calls ring them, not the account owner. They never have a Nura account, so this table
-- is everything we hold about them: who they are to the owner, the number to call, their time
-- zone, and a record of their agreement. No call is placed unless consent_status is 'granted'.
--
-- Agreement comes one of two ways: the person taps Yes on a link the owner sends them
-- (consent_method 'link'), or the owner confirms they agree on their behalf ('on_behalf').
-- Only a hash of the link token is stored, as with care-circle invites.

create table if not exists nura_care_recipients (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references nura_plans(id) on delete cascade,
  -- Mirrors nura_plans.owner_id via trigger, same reasoning as nura_plan_invites.
  owner_id uuid not null,
  first_name text not null check (char_length(first_name) between 1 and 60),
  relationship text not null default 'other'
    check (relationship in ('parent', 'partner', 'grandparent', 'child', 'friend', 'other')),
  phone text not null check (phone ~ '^[0-9]{8,15}$'),
  time_zone text not null,
  consent_status text not null default 'pending'
    check (consent_status in ('pending', 'granted', 'declined', 'revoked')),
  consent_method text check (consent_method in ('link', 'on_behalf')),
  consent_at timestamptz,
  -- What was shown when they agreed (copy version) and how, for the record.
  consent_evidence jsonb,
  consent_token_hash text unique,
  consent_expires_at timestamptz,
  revoked_at timestamptz,
  revoke_reason text check (revoke_reason in ('stop_on_call', 'link', 'owner_stopped')),
  -- What the first call should ask about, drafted with the plan and used once consent lands.
  first_checkin_prompt text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_id)
);

create index if not exists nura_care_recipients_owner_idx on nura_care_recipients(owner_id);
create index if not exists nura_care_recipients_phone_idx on nura_care_recipients(phone);

alter table nura_plans
  add column if not exists care_recipient_id uuid references nura_care_recipients(id) on delete set null;

comment on column nura_plans.care_recipient_id is
  'Set when this Care plan is about someone else: check-in calls ring them (with their consent), not the owner.';

alter table nura_care_recipients enable row level security;

create or replace function public.nura_care_recipients_set_owner()
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
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists nura_care_recipients_set_owner on nura_care_recipients;
create trigger nura_care_recipients_set_owner
  before insert or update on nura_care_recipients
  for each row execute function public.nura_care_recipients_set_owner();

-- Owner only. Care-circle watchers see the plan, never the person's number or consent record;
-- the consent page and the call path read this table with the service role.
drop policy if exists owner_access on nura_care_recipients;
create policy owner_access on nura_care_recipients
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
