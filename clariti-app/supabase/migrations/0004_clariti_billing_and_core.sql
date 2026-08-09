-- Idempotent migration: ensures core Clariti tables exist, adds Clariti Plus billing
-- (RevenueCat-backed) columns/tables, protects subscription columns from client writes,
-- and confirms storage bucket policies for clariti-documents / clariti-videos.
-- Safe to re-run: every statement uses IF NOT EXISTS / OR REPLACE / DROP POLICY IF EXISTS.

-- ---------------------------------------------------------------------------
-- 1. Core tables (copied from 0001_init.sql, guarded with IF NOT EXISTS so this
--    migration is safe to apply even on a brand-new database).
-- ---------------------------------------------------------------------------

create table if not exists clariti_documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  file_name text not null,
  kind text not null default 'unknown',
  status text not null default 'uploaded',
  storage_path text,
  extracted_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists clariti_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  title text not null,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists clariti_session_documents (
  session_id uuid not null references clariti_sessions(id) on delete cascade,
  document_id uuid not null references clariti_documents(id) on delete cascade,
  primary key (session_id, document_id)
);

create table if not exists clariti_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references clariti_sessions(id) on delete cascade,
  role text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists clariti_artifacts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references clariti_sessions(id) on delete cascade,
  kind text not null,
  title text not null,
  summary text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists clariti_follow_ups (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  owner_id uuid,
  channel text not null default 'phone',
  phone_number text,
  action text not null,
  document_title text not null,
  document_kind text not null,
  call_prompt text not null,
  safety_note text not null,
  scheduled_for timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists clariti_video_generations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  session_id uuid references clariti_sessions(id) on delete set null,
  status text not null default 'queued',
  progress integer not null default 0,
  provider text not null default 'vercel-ai-gateway',
  model text not null,
  duration_seconds integer not null default 15,
  pipeline text not null default 'ai-video-single-render',
  analysis jsonb not null default '{}'::jsonb,
  scenes jsonb not null default '[]'::jsonb,
  video_url text,
  error_message text,
  provider_response jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table clariti_follow_ups
  add column if not exists analysis_payload jsonb,
  add column if not exists triggered_at timestamptz,
  add column if not exists call_status text,
  add column if not exists call_error text,
  add column if not exists call_conversation_id text;

alter table clariti_documents enable row level security;
alter table clariti_sessions enable row level security;
alter table clariti_session_documents enable row level security;
alter table clariti_messages enable row level security;
alter table clariti_artifacts enable row level security;
alter table clariti_follow_ups enable row level security;
alter table clariti_video_generations enable row level security;

grant select, insert, update, delete on table
  clariti_documents,
  clariti_sessions,
  clariti_session_documents,
  clariti_messages,
  clariti_artifacts,
  clariti_follow_ups,
  clariti_video_generations
to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'clariti_documents' and policyname = 'Users can read own Clariti documents') then
    create policy "Users can read own Clariti documents" on clariti_documents for select to authenticated using ((select auth.uid()) = owner_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'clariti_documents' and policyname = 'Users can insert own Clariti documents') then
    create policy "Users can insert own Clariti documents" on clariti_documents for insert to authenticated with check ((select auth.uid()) = owner_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'clariti_documents' and policyname = 'Users can update own Clariti documents') then
    create policy "Users can update own Clariti documents" on clariti_documents for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'clariti_documents' and policyname = 'Users can delete own Clariti documents') then
    create policy "Users can delete own Clariti documents" on clariti_documents for delete to authenticated using ((select auth.uid()) = owner_id);
  end if;

  if not exists (select 1 from pg_policies where tablename = 'clariti_sessions' and policyname = 'Users can read own Clariti sessions') then
    create policy "Users can read own Clariti sessions" on clariti_sessions for select to authenticated using ((select auth.uid()) = owner_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'clariti_sessions' and policyname = 'Users can insert own Clariti sessions') then
    create policy "Users can insert own Clariti sessions" on clariti_sessions for insert to authenticated with check ((select auth.uid()) = owner_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'clariti_sessions' and policyname = 'Users can update own Clariti sessions') then
    create policy "Users can update own Clariti sessions" on clariti_sessions for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'clariti_sessions' and policyname = 'Users can delete own Clariti sessions') then
    create policy "Users can delete own Clariti sessions" on clariti_sessions for delete to authenticated using ((select auth.uid()) = owner_id);
  end if;

  if not exists (select 1 from pg_policies where tablename = 'clariti_session_documents' and policyname = 'Users can read own session document links') then
    create policy "Users can read own session document links" on clariti_session_documents for select to authenticated using (exists (select 1 from clariti_sessions where clariti_sessions.id = clariti_session_documents.session_id and clariti_sessions.owner_id = (select auth.uid())));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'clariti_session_documents' and policyname = 'Users can insert own session document links') then
    create policy "Users can insert own session document links" on clariti_session_documents for insert to authenticated with check (exists (select 1 from clariti_sessions where clariti_sessions.id = clariti_session_documents.session_id and clariti_sessions.owner_id = (select auth.uid())) and exists (select 1 from clariti_documents where clariti_documents.id = clariti_session_documents.document_id and clariti_documents.owner_id = (select auth.uid())));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'clariti_session_documents' and policyname = 'Users can delete own session document links') then
    create policy "Users can delete own session document links" on clariti_session_documents for delete to authenticated using (exists (select 1 from clariti_sessions where clariti_sessions.id = clariti_session_documents.session_id and clariti_sessions.owner_id = (select auth.uid())));
  end if;

  if not exists (select 1 from pg_policies where tablename = 'clariti_messages' and policyname = 'Users can read messages in own sessions') then
    create policy "Users can read messages in own sessions" on clariti_messages for select to authenticated using (exists (select 1 from clariti_sessions where clariti_sessions.id = clariti_messages.session_id and clariti_sessions.owner_id = (select auth.uid())));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'clariti_messages' and policyname = 'Users can insert messages in own sessions') then
    create policy "Users can insert messages in own sessions" on clariti_messages for insert to authenticated with check (exists (select 1 from clariti_sessions where clariti_sessions.id = clariti_messages.session_id and clariti_sessions.owner_id = (select auth.uid())));
  end if;

  if not exists (select 1 from pg_policies where tablename = 'clariti_artifacts' and policyname = 'Users can read artifacts in own sessions') then
    create policy "Users can read artifacts in own sessions" on clariti_artifacts for select to authenticated using (exists (select 1 from clariti_sessions where clariti_sessions.id = clariti_artifacts.session_id and clariti_sessions.owner_id = (select auth.uid())));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'clariti_artifacts' and policyname = 'Users can insert artifacts in own sessions') then
    create policy "Users can insert artifacts in own sessions" on clariti_artifacts for insert to authenticated with check (exists (select 1 from clariti_sessions where clariti_sessions.id = clariti_artifacts.session_id and clariti_sessions.owner_id = (select auth.uid())));
  end if;

  if not exists (select 1 from pg_policies where tablename = 'clariti_follow_ups' and policyname = 'Users can read own Clariti follow ups') then
    create policy "Users can read own Clariti follow ups" on clariti_follow_ups for select to authenticated using ((select auth.uid()) = owner_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'clariti_follow_ups' and policyname = 'Users can insert own Clariti follow ups') then
    create policy "Users can insert own Clariti follow ups" on clariti_follow_ups for insert to authenticated with check ((select auth.uid()) = owner_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'clariti_follow_ups' and policyname = 'Users can update own Clariti follow ups') then
    create policy "Users can update own Clariti follow ups" on clariti_follow_ups for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
  end if;

  if not exists (select 1 from pg_policies where tablename = 'clariti_video_generations' and policyname = 'Users can read own Clariti video generations') then
    create policy "Users can read own Clariti video generations" on clariti_video_generations for select to authenticated using ((select auth.uid()) = owner_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'clariti_video_generations' and policyname = 'Users can insert own Clariti video generations') then
    create policy "Users can insert own Clariti video generations" on clariti_video_generations for insert to authenticated with check ((select auth.uid()) = owner_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'clariti_video_generations' and policyname = 'Users can update own Clariti video generations') then
    create policy "Users can update own Clariti video generations" on clariti_video_generations for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. clariti_profiles — subscription state, one row per authenticated user.
-- ---------------------------------------------------------------------------

create table if not exists clariti_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  subscription_tier text not null default 'free'
    check (subscription_tier in ('free', 'plus')),
  subscription_status text not null default 'free'
    check (subscription_status in ('free', 'trialing', 'active', 'grace_period', 'cancelled', 'expired')),
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  subscription_current_period_ends_at timestamptz,
  subscription_updated_at timestamptz,
  revenuecat_app_user_id text unique,
  revenuecat_original_app_user_id text,
  stripe_customer_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Free-tier usage limits are derived live from clariti_documents / clariti_video_generations
-- row counts (see lib/billing/subscription.ts) rather than a client-writable counter column,
-- so there is nothing to add/track here beyond the subscription state itself.

alter table clariti_profiles enable row level security;

grant select, insert, update on table clariti_profiles to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'clariti_profiles' and policyname = 'Users can read own Clariti profile') then
    create policy "Users can read own Clariti profile" on clariti_profiles for select to authenticated using ((select auth.uid()) = id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'clariti_profiles' and policyname = 'Users can insert own Clariti profile') then
    create policy "Users can insert own Clariti profile" on clariti_profiles for insert to authenticated with check ((select auth.uid()) = id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'clariti_profiles' and policyname = 'Users can update own Clariti profile') then
    create policy "Users can update own Clariti profile" on clariti_profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
  end if;
end $$;

create index if not exists clariti_profiles_subscription_tier_idx on clariti_profiles (subscription_tier);
create index if not exists clariti_profiles_revenuecat_app_user_id_idx on clariti_profiles (revenuecat_app_user_id);

-- ---------------------------------------------------------------------------
-- 3. RevenueCat webhook event log (idempotency ledger).
-- ---------------------------------------------------------------------------

create table if not exists clariti_revenuecat_webhook_events (
  event_id text primary key,
  event_type text not null,
  app_user_id text,
  processed_at timestamptz not null default now(),
  payload jsonb not null
);

alter table clariti_revenuecat_webhook_events enable row level security;

-- ---------------------------------------------------------------------------
-- 4. Trigger: lock subscription columns from non-service_role writes.
--    Client sessions (RLS as `authenticated`) can only touch display_name;
--    billing state may only be written by the service role (webhook handler,
--    sync-plus, checkout-success routes).
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
  end if;

  return new;
end;
$$;

drop trigger if exists clariti_profiles_protect_subscription on public.clariti_profiles;

create trigger clariti_profiles_protect_subscription
  before insert or update on public.clariti_profiles
  for each row
  execute function public.clariti_protect_subscription_columns();

-- ---------------------------------------------------------------------------
-- 5. Storage: ensure clariti-videos is public, and confirm bucket + object
--    policies for clariti-documents (private) and clariti-videos (public).
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('clariti-documents', 'clariti-documents', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('clariti-videos', 'clariti-videos', true)
on conflict (id) do update set public = excluded.public;

update storage.buckets set public = true where id = 'clariti-videos';

drop policy if exists "Users can upload own Clariti document files" on storage.objects;
create policy "Users can upload own Clariti document files"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'clariti-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Users can read own Clariti document files" on storage.objects;
create policy "Users can read own Clariti document files"
on storage.objects for select
to authenticated
using (
  bucket_id = 'clariti-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Users can update own Clariti document files" on storage.objects;
create policy "Users can update own Clariti document files"
on storage.objects for update
to authenticated
using (
  bucket_id = 'clariti-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'clariti-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Users can read generated Clariti videos" on storage.objects;
create policy "Users can read generated Clariti videos"
on storage.objects for select
to authenticated
using (bucket_id = 'clariti-videos');

drop policy if exists "Users can upload own Clariti generated videos" on storage.objects;
create policy "Users can upload own Clariti generated videos"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'clariti-videos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Users can update own Clariti generated videos" on storage.objects;
create policy "Users can update own Clariti generated videos"
on storage.objects for update
to authenticated
using (
  bucket_id = 'clariti-videos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'clariti-videos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

-- ---------------------------------------------------------------------------
-- 6. Index to speed up "compare with earlier docs" lookups: fetching a user's
--    recent artifacts grouped/filtered by kind, joined through sessions.
-- ---------------------------------------------------------------------------

create index if not exists clariti_artifacts_session_created_idx
  on clariti_artifacts (session_id, created_at desc);

create index if not exists clariti_artifacts_kind_idx
  on clariti_artifacts (kind);

create index if not exists clariti_sessions_owner_updated_idx
  on clariti_sessions (owner_id, updated_at desc);
