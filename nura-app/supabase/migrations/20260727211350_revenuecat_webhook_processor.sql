create extension if not exists pgcrypto with schema extensions;

create table if not exists nura_server_secret_hashes (
  name text primary key,
  secret_sha256 text not null,
  updated_at timestamptz not null default now()
);

alter table nura_server_secret_hashes enable row level security;

insert into nura_server_secret_hashes (name, secret_sha256)
values ('revenuecat_webhook_auth_header', '2bbfb638ae7c4d7f2f8839d6b8b68f1c425a6a9afc5f949e302466acd279fc91')
on conflict (name) do update
set secret_sha256 = excluded.secret_sha256,
    updated_at = now();

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
  rc_period_end timestamptz;
  rc_still_paid boolean;
  is_plus_event boolean;
  profile_id uuid;
  update_tier text;
  update_status text;
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
  rc_still_paid := rc_period_end is not null and rc_period_end > now();

  if rc_event_type in ('INITIAL_PURCHASE', 'RENEWAL', 'UNCANCELLATION', 'SUBSCRIPTION_EXTENDED', 'TEMPORARY_ENTITLEMENT_GRANT') then
    update_tier := 'plus';
    update_status := 'active';
  elsif rc_event_type = 'CANCELLATION' then
    update_tier := case when rc_still_paid then 'plus' else 'free' end;
    update_status := 'cancelled';
  elsif rc_event_type = 'BILLING_ISSUE' then
    update_tier := case when rc_still_paid then 'plus' else 'free' end;
    update_status := case when rc_still_paid then 'grace_period' else 'expired' end;
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
        revenuecat_app_user_id = rc_app_user_id,
        revenuecat_original_app_user_id = rc_original_app_user_id,
        subscription_updated_at = now()
    where revenuecat_app_user_id = rc_app_user_id
    returning id into profile_id;
  end if;

  if profile_id is null then
    return jsonb_build_object('ok', true, 'eventId', rc_event_id, 'processed', false, 'reason', 'profile_not_found');
  end if;

  return jsonb_build_object('ok', true, 'eventId', rc_event_id, 'profileId', profile_id);
end;
$$;

revoke all on function public.nura_process_revenuecat_webhook(text, jsonb, text[]) from public;
grant execute on function public.nura_process_revenuecat_webhook(text, jsonb, text[]) to anon;
