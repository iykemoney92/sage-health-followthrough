-- Complimentary Plus: a deliberate, server-side grant that the verified-access gate honours.
--
-- getVerifiedSubscriptionAccess treats any Plus that neither RevenueCat nor Stripe can confirm
-- as tampering and revokes it - correct for a self-written profile, wrong for the founder or
-- an App Review account that was granted Plus on purpose. These columns can only be written
-- with the service role (the protect trigger below resets them for everyone else), so a
-- future value here is proof the grant was intentional.

alter table public.nura_profiles
  add column if not exists complimentary_plus_until timestamptz,
  add column if not exists complimentary_plus_reason text;

comment on column public.nura_profiles.complimentary_plus_until is
  'Service-role-only: Plus is granted until this moment regardless of store/Stripe state.';

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
    new.complimentary_plus_until := old.complimentary_plus_until;
    new.complimentary_plus_reason := old.complimentary_plus_reason;
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
      new.complimentary_plus_until := null;
      new.complimentary_plus_reason := null;
    end if;
  end if;

  return new;
end;
$$;
