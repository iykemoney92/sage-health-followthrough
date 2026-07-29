alter table nura_profiles
  add column if not exists subscription_tier text not null default 'free'
    check (subscription_tier in ('free', 'plus')),
  add column if not exists subscription_status text not null default 'free'
    check (subscription_status in ('free', 'trialing', 'active', 'grace_period', 'cancelled', 'expired')),
  add column if not exists trial_started_at timestamptz,
  add column if not exists trial_ends_at timestamptz,
  add column if not exists subscription_current_period_ends_at timestamptz,
  add column if not exists subscription_updated_at timestamptz,
  add column if not exists revenuecat_app_user_id text unique,
  add column if not exists revenuecat_original_app_user_id text;

create table if not exists nura_revenuecat_webhook_events (
  event_id text primary key,
  event_type text not null,
  app_user_id text,
  processed_at timestamptz not null default now(),
  payload jsonb not null
);

alter table nura_revenuecat_webhook_events enable row level security;

create index if not exists nura_profiles_subscription_tier_idx
  on nura_profiles (subscription_tier);

create index if not exists nura_profiles_revenuecat_app_user_id_idx
  on nura_profiles (revenuecat_app_user_id);
