-- Keep the SQL fallback processor aligned with the TypeScript webhook mapper:
-- trials → trialing + trial dates, cancellations keep access until period end,
-- billing issues use grace_period_expiration_at_ms when present.

create or replace function public.nura_process_revenuecat_webhook(
  p_auth_header text,
  p_payload jsonb,
  p_plus_product_ids text[] default array[]::text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  expected_hash text;
  incoming_hash text;
  rc_event jsonb;
  rc_event_id text;
  rc_event_type text;
  rc_app_user_id text;
  rc_original_app_user_id text;
  rc_product_id text;
  rc_period_type text;
  rc_period_end timestamptz;
  rc_purchased_at timestamptz;
  rc_grace_end timestamptz;
  rc_still_paid boolean;
  rc_cancel_reason text;
  rc_price numeric;
  is_plus_event boolean;
  profile_id uuid;
  update_tier text;
  update_status text;
  update_trial_started timestamptz;
  update_trial_ends timestamptz;
begin
  select secret_sha256
  into expected_hash
  from nura_server_secret_hashes
  where name = 'revenuecat_webhook_auth_header';

  incoming_hash := encode(digest(coalesce(p_auth_header, ''), 'sha256'), 'hex');
  if expected_hash is null or incoming_hash <> expected_hash then
    raise exception 'unauthorized' using errcode = '28000';
  end if;

  rc_event := p_payload -> 'event';
  rc_event_type := rc_event ->> 'type';
  rc_app_user_id := rc_event ->> 'app_user_id';
  rc_original_app_user_id := rc_event ->> 'original_app_user_id';
  rc_product_id := rc_event ->> 'product_id';
  rc_period_type := upper(coalesce(rc_event ->> 'period_type', ''));
  rc_cancel_reason := rc_event ->> 'cancel_reason';
  rc_price := nullif(rc_event ->> 'price', '')::numeric;

  if rc_event_type is null or rc_app_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_event');
  end if;

  rc_event_id := coalesce(rc_event ->> 'id', encode(digest(p_payload::text, 'sha256'), 'hex'));

  insert into nura_revenuecat_webhook_events (event_id, event_type, app_user_id, payload)
  values (rc_event_id, rc_event_type, rc_app_user_id, p_payload)
  on conflict (event_id) do nothing;

  if not found then
    return jsonb_build_object('ok', true, 'duplicate', true, 'eventId', rc_event_id);
  end if;

  is_plus_event := coalesce(rc_product_id = any(p_plus_product_ids), false)
    or exists (
      select 1
      from jsonb_array_elements_text(coalesce(rc_event -> 'entitlement_ids', '[]'::jsonb)) entitlement(id)
      where entitlement.id = 'plus'
    );

  if not is_plus_event then
    return jsonb_build_object('ok', true, 'ignored', true, 'eventId', rc_event_id);
  end if;

  rc_period_end := case
    when jsonb_typeof(rc_event -> 'expiration_at_ms') = 'number'
      then to_timestamp(((rc_event ->> 'expiration_at_ms')::numeric / 1000.0))
    else null
  end;
  rc_purchased_at := case
    when jsonb_typeof(rc_event -> 'purchased_at_ms') = 'number'
      then to_timestamp(((rc_event ->> 'purchased_at_ms')::numeric / 1000.0))
    else null
  end;
  rc_grace_end := case
    when jsonb_typeof(rc_event -> 'grace_period_expiration_at_ms') = 'number'
      then to_timestamp(((rc_event ->> 'grace_period_expiration_at_ms')::numeric / 1000.0))
    else null
  end;
  rc_still_paid := rc_period_end is not null and rc_period_end > now();

  update_trial_started := null;
  update_trial_ends := null;

  if rc_event_type in ('INITIAL_PURCHASE', 'TEMPORARY_ENTITLEMENT_GRANT', 'SUBSCRIPTION_EXTENDED') then
    update_tier := 'plus';
    if rc_period_type in ('TRIAL', 'INTRO') then
      update_status := 'trialing';
      update_trial_started := coalesce(rc_purchased_at, now());
      update_trial_ends := rc_period_end;
    else
      update_status := 'active';
    end if;
  elsif rc_event_type in ('RENEWAL', 'UNCANCELLATION') then
    update_tier := 'plus';
    if rc_period_type = 'TRIAL' and coalesce((rc_event ->> 'is_trial_conversion')::boolean, false) is not true then
      update_status := 'trialing';
      update_trial_started := rc_purchased_at;
      update_trial_ends := rc_period_end;
    else
      update_status := 'active';
    end if;
  elsif rc_event_type = 'PRODUCT_CHANGE' then
    update_tier := 'plus';
    update_status := case when rc_period_type = 'TRIAL' then 'trialing' else 'active' end;
    if rc_period_type = 'TRIAL' then
      update_trial_started := rc_purchased_at;
      update_trial_ends := rc_period_end;
    end if;
  elsif rc_event_type = 'CANCELLATION' then
    if rc_cancel_reason in ('CUSTOMER_SUPPORT', 'DEVELOPER_INITIATED')
       or coalesce(rc_price, 0) < 0
       or not rc_still_paid then
      update_tier := 'free';
      update_status := 'expired';
    else
      update_tier := case when rc_still_paid then 'plus' else 'free' end;
      update_status := 'cancelled';
    end if;
  elsif rc_event_type = 'BILLING_ISSUE' then
    rc_period_end := coalesce(rc_grace_end, rc_period_end);
    if rc_period_end is not null and rc_period_end > now() then
      update_tier := 'plus';
      update_status := 'grace_period';
    else
      update_tier := 'free';
      update_status := 'expired';
    end if;
  elsif rc_event_type in ('EXPIRATION', 'SUBSCRIPTION_PAUSED') then
    update_tier := 'free';
    update_status := 'expired';
  else
    return jsonb_build_object('ok', true, 'ignored', true, 'eventId', rc_event_id);
  end if;

  if rc_app_user_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    update nura_profiles
    set subscription_tier = update_tier,
        subscription_status = update_status,
        subscription_current_period_ends_at = rc_period_end,
        trial_started_at = coalesce(update_trial_started, trial_started_at),
        trial_ends_at = coalesce(update_trial_ends, trial_ends_at),
        revenuecat_app_user_id = rc_app_user_id,
        revenuecat_original_app_user_id = rc_original_app_user_id,
        subscription_updated_at = now()
    where id = rc_app_user_id::uuid
    returning id into profile_id;
  else
    update nura_profiles
    set subscription_tier = update_tier,
        subscription_status = update_status,
        subscription_current_period_ends_at = rc_period_end,
        trial_started_at = coalesce(update_trial_started, trial_started_at),
        trial_ends_at = coalesce(update_trial_ends, trial_ends_at),
        revenuecat_app_user_id = rc_app_user_id,
        revenuecat_original_app_user_id = rc_original_app_user_id,
        subscription_updated_at = now()
    where revenuecat_app_user_id = rc_app_user_id
    returning id into profile_id;
  end if;

  if profile_id is null then
    return jsonb_build_object('ok', true, 'eventId', rc_event_id, 'processed', false, 'reason', 'profile_not_found');
  end if;

  return jsonb_build_object('ok', true, 'eventId', rc_event_id, 'profileId', profile_id, 'status', update_status);
end;
$$;

revoke all on function public.nura_process_revenuecat_webhook(text, jsonb, text[]) from public;
grant execute on function public.nura_process_revenuecat_webhook(text, jsonb, text[]) to anon;
