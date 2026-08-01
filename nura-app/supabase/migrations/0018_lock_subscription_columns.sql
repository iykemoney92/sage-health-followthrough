-- Run this in Supabase SQL Editor if CLI push is unavailable.
-- Protects subscription columns from client self-writes and sets safer channel defaults.

create or replace function public.nura_protect_subscription_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    new.subscription_tier := old.subscription_tier;
    new.subscription_status := old.subscription_status;
    new.trial_started_at := old.trial_started_at;
    new.trial_ends_at := old.trial_ends_at;
    new.subscription_current_period_ends_at := old.subscription_current_period_ends_at;
    new.subscription_updated_at := old.subscription_updated_at;
    new.revenuecat_app_user_id := old.revenuecat_app_user_id;
    new.revenuecat_original_app_user_id := old.revenuecat_original_app_user_id;
    if to_jsonb(new) ? 'stripe_customer_id' then
      new.stripe_customer_id := old.stripe_customer_id;
    end if;
  elsif tg_op = 'INSERT' then
    new.subscription_tier := coalesce(new.subscription_tier, 'free');
    if auth.role() <> 'service_role' then
      new.subscription_tier := 'free';
      new.subscription_status := coalesce(new.subscription_status, 'free');
      new.trial_started_at := null;
      new.trial_ends_at := null;
      new.subscription_current_period_ends_at := null;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists nura_profiles_protect_subscription on public.nura_profiles;

create trigger nura_profiles_protect_subscription
  before insert or update on public.nura_profiles
  for each row
  execute function public.nura_protect_subscription_columns();

alter table public.nura_profiles
  alter column preferred_channel set default 'in_app';

alter table public.nura_profiles
  alter column preferred_checkin_channels set default array['in_app']::text[];

alter table public.nura_profiles
  add column if not exists stripe_customer_id text;
