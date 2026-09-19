-- Sign in with Apple revocation (guideline 5.1.1(v)) needs the provider refresh
-- token to still exist when the account is deleted, and Supabase hands that token
-- back exactly once — at the code exchange — without keeping a copy of it.
-- lib/auth/apple-revoke.ts writes it here and app/api/account/delete/route.ts
-- spends it; until this column exists both halves are silent no-ops and every
-- Apple sign-in logs a failed upsert.
--
-- Idempotent: safe to re-run.

alter table clariti_profiles
  add column if not exists apple_refresh_token text;

-- ---------------------------------------------------------------------------
-- 1. The column is a live Apple OAuth credential, so `authenticated` must not be
--    able to read it at all: app/api/account/export/route.ts hands the profile
--    row to the person as a downloadable file, and RLS correctly says that row
--    is theirs.
--
--    A column-level REVOKE on its own would do nothing here. A role's access to
--    a column is the sum of the table grant and any column grants, and 0004
--    granted SELECT on the whole table — so the table grant comes off and every
--    other column is granted back by name. That also makes `select *` fail
--    loudly with "permission denied for column" rather than quietly shipping the
--    token, which is why the export route now lists its columns.
--
--    INSERT/UPDATE stay table-wide: the trigger below pins the column the same
--    way it pins the billing columns. `anon` is granted separately by Supabase's
--    default privileges but has no SELECT policy on this table, so RLS already
--    stops it before grants matter.
-- ---------------------------------------------------------------------------

revoke select on table clariti_profiles from authenticated;

grant select (
  id,
  display_name,
  subscription_tier,
  subscription_status,
  trial_started_at,
  trial_ends_at,
  subscription_current_period_ends_at,
  subscription_updated_at,
  revenuecat_app_user_id,
  revenuecat_original_app_user_id,
  stripe_customer_id,
  created_at,
  updated_at
) on table clariti_profiles to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Trigger: apple_refresh_token joins the columns a user may not set for
--    themselves. Only the service role (the callback and native-shell store in
--    lib/auth/apple-revoke.ts) writes it; a client that sent one would otherwise
--    be handing Clariti a token of its choosing to send to Apple on deletion.
--    The existing clariti_profiles_protect_subscription trigger calls this
--    function by name, so replacing the body is enough.
-- ---------------------------------------------------------------------------

create or replace function public.clariti_protect_subscription_columns()
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
    new.stripe_customer_id := old.stripe_customer_id;
    new.apple_refresh_token := old.apple_refresh_token;
  elsif tg_op = 'INSERT' then
    new.subscription_tier := 'free';
    new.subscription_status := coalesce(new.subscription_status, 'free');
    if new.subscription_status not in ('free') then
      new.subscription_status := 'free';
    end if;
    new.trial_started_at := null;
    new.trial_ends_at := null;
    new.subscription_current_period_ends_at := null;
    new.revenuecat_app_user_id := null;
    new.revenuecat_original_app_user_id := null;
    new.stripe_customer_id := null;
    new.apple_refresh_token := null;
  end if;

  return new;
end;
$$;
