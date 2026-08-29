-- Closes the two data-exposure holes in Clariti's storage, gives account deletion
-- something to cascade to, and adds the rate-limit counter the AI routes need.
--
-- Idempotent: safe to re-run. Every statement uses IF NOT EXISTS / OR REPLACE /
-- DROP POLICY IF EXISTS.

-- ---------------------------------------------------------------------------
-- 1. clariti-videos stops being a public bucket.
--
--    It held AI explainer videos and illustrations generated FROM a user's
--    medical bill or radiology report, and `public = true` made every one of
--    them readable by anyone who had (or guessed) the URL, with no session at
--    all. 0003_clariti_videos_public.sql made it public so Shotstack could
--    fetch the scene clips it stitches; signed URLs serve that need without
--    serving it to the whole internet.
-- ---------------------------------------------------------------------------

update storage.buckets set public = false where id = 'clariti-videos';

-- The old SELECT policy was `using (bucket_id = 'clariti-videos')` — scoped to
-- authenticated, but to ANY authenticated user, so every Clariti account could
-- read every other account's generated artifacts. Objects are already written
-- under a `<owner id>/` prefix (see app/api/illustrations/route.ts and
-- app/api/videos/report-explainer/[id]/route.ts), so the same folder check the
-- documents bucket uses applies here unchanged.
drop policy if exists "Users can read generated Clariti videos" on storage.objects;
create policy "Users can read own Clariti generated videos"
on storage.objects for select
to authenticated
using (
  bucket_id = 'clariti-videos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

-- Deleting an account has to be able to remove the files too, and neither
-- bucket had a DELETE policy.
drop policy if exists "Users can delete own Clariti generated videos" on storage.objects;
create policy "Users can delete own Clariti generated videos"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'clariti-videos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Users can delete own Clariti document files" on storage.objects;
create policy "Users can delete own Clariti document files"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'clariti-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

-- ---------------------------------------------------------------------------
-- 2. Rewrite already-stored public URLs to the app-relative media route.
--
--    Rows written before this migration hold an absolute
--    `.../storage/v1/object/public/clariti-videos/<path>` URL, which stops
--    resolving the moment the bucket goes private. /api/media/<path> mints a
--    short-lived signed URL after checking ownership, so the stored value
--    becomes the path and the URL is minted per request.
-- ---------------------------------------------------------------------------

update clariti_video_generations
set video_url = '/api/media/' || split_part(video_url, '/object/public/clariti-videos/', 2)
where video_url like '%/object/public/clariti-videos/%';

update clariti_artifacts
set payload = regexp_replace(
  payload::text,
  'https?://[^"]*?/object/public/clariti-videos/',
  '/api/media/',
  'g'
)::jsonb
where payload::text like '%/object/public/clariti-videos/%';

-- ---------------------------------------------------------------------------
-- 3. Ownership cascade.
--
--    No Clariti table referenced auth.users, so deleting an account left every
--    document, analysis, and generated artifact behind as orphaned PHI with no
--    owner to ever reach it again. NOT VALID adds the cascade trigger for all
--    future deletes without failing the migration on any pre-existing row whose
--    owner is already gone; those are cleaned up separately.
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'clariti_documents_owner_fk') then
    alter table clariti_documents
      add constraint clariti_documents_owner_fk
      foreign key (owner_id) references auth.users(id) on delete cascade not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'clariti_sessions_owner_fk') then
    alter table clariti_sessions
      add constraint clariti_sessions_owner_fk
      foreign key (owner_id) references auth.users(id) on delete cascade not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'clariti_video_generations_owner_fk') then
    alter table clariti_video_generations
      add constraint clariti_video_generations_owner_fk
      foreign key (owner_id) references auth.users(id) on delete cascade not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'clariti_profiles_owner_fk') then
    alter table clariti_profiles
      add constraint clariti_profiles_owner_fk
      foreign key (id) references auth.users(id) on delete cascade not valid;
  end if;
end $$;

-- clariti_follow_ups.owner_id is nullable and some rows predate accounts, so it
-- gets ON DELETE CASCADE only where an owner is actually set.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'clariti_follow_ups_owner_fk') then
    alter table clariti_follow_ups
      add constraint clariti_follow_ups_owner_fk
      foreign key (owner_id) references auth.users(id) on delete cascade not valid;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Let users delete their own rows.
--
--    Only documents, sessions and follow-ups had DELETE policies, so a user
--    could never remove a message, an artifact, or a video job — which also
--    meant account deletion had to run entirely as service-role.
-- ---------------------------------------------------------------------------

drop policy if exists "Users can delete messages in own sessions" on clariti_messages;
create policy "Users can delete messages in own sessions"
on clariti_messages for delete
to authenticated
using (exists (
  select 1 from clariti_sessions
  where clariti_sessions.id = clariti_messages.session_id
    and clariti_sessions.owner_id = (select auth.uid())
));

drop policy if exists "Users can delete artifacts in own sessions" on clariti_artifacts;
create policy "Users can delete artifacts in own sessions"
on clariti_artifacts for delete
to authenticated
using (exists (
  select 1 from clariti_sessions
  where clariti_sessions.id = clariti_artifacts.session_id
    and clariti_sessions.owner_id = (select auth.uid())
));

-- The analyze route UPDATEs clariti_artifacts, but no UPDATE policy existed, so
-- that write silently failed under RLS.
drop policy if exists "Users can update artifacts in own sessions" on clariti_artifacts;
create policy "Users can update artifacts in own sessions"
on clariti_artifacts for update
to authenticated
using (exists (
  select 1 from clariti_sessions
  where clariti_sessions.id = clariti_artifacts.session_id
    and clariti_sessions.owner_id = (select auth.uid())
))
with check (exists (
  select 1 from clariti_sessions
  where clariti_sessions.id = clariti_artifacts.session_id
    and clariti_sessions.owner_id = (select auth.uid())
));

drop policy if exists "Users can delete own Clariti video generations" on clariti_video_generations;
create policy "Users can delete own Clariti video generations"
on clariti_video_generations for delete
to authenticated
using ((select auth.uid()) = owner_id);

-- ---------------------------------------------------------------------------
-- 5. Rate limiting.
--
--    Clariti's expensive routes (document extraction, analysis, comparison,
--    illustration and video generation) each cost real provider money per call
--    and had no ceiling of any kind. The counter is a fixed window keyed on
--    (owner, route, window start); the increment is one atomic upsert so
--    concurrent requests cannot both read the same count.
--
--    NOTE: the function's signature is replaced in
--    0007_rate_limit_derives_own_caller.sql, which drops the owner argument so a
--    caller cannot spend someone else's quota. Apply both.
-- ---------------------------------------------------------------------------

create table if not exists clariti_rate_limits (
  owner_id uuid not null,
  route text not null,
  window_start timestamptz not null,
  request_count integer not null default 0,
  primary key (owner_id, route, window_start)
);

alter table clariti_rate_limits enable row level security;

-- Deliberately no policy for `authenticated`: the counter is only ever touched
-- through the SECURITY DEFINER function below, never read or written directly by
-- a client, and a client that could UPDATE its own counter could reset it.

create index if not exists clariti_rate_limits_window_idx
  on clariti_rate_limits (window_start);

create or replace function public.clariti_increment_rate_limit(
  p_owner_id uuid,
  p_route text,
  p_window_start timestamptz
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count integer;
begin
  insert into clariti_rate_limits (owner_id, route, window_start, request_count)
  values (p_owner_id, p_route, p_window_start, 1)
  on conflict (owner_id, route, window_start)
  do update set request_count = clariti_rate_limits.request_count + 1
  returning request_count into new_count;

  return new_count;
end;
$$;

revoke all on function public.clariti_increment_rate_limit(uuid, text, timestamptz) from public;
grant execute on function public.clariti_increment_rate_limit(uuid, text, timestamptz) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. Indexes for the lookups that currently scan.
-- ---------------------------------------------------------------------------

create index if not exists clariti_documents_owner_created_idx
  on clariti_documents (owner_id, created_at desc);

create index if not exists clariti_messages_session_created_idx
  on clariti_messages (session_id, created_at);

create index if not exists clariti_video_generations_owner_created_idx
  on clariti_video_generations (owner_id, created_at desc);

create index if not exists clariti_follow_ups_scheduled_idx
  on clariti_follow_ups (scheduled_for)
  where triggered_at is null;

-- ---------------------------------------------------------------------------
-- 7. Retention on the webhook event log.
--
--    clariti_revenuecat_webhook_events stores full billing payloads and grew
--    without bound. Ninety days is well past any window in which a purchase
--    dispute would need replaying.
-- ---------------------------------------------------------------------------

delete from clariti_revenuecat_webhook_events
where processed_at < now() - interval '90 days';
