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

insert into storage.buckets (id, name, public)
values ('clariti-videos', 'clariti-videos', true)
on conflict (id) do nothing;

alter table clariti_video_generations enable row level security;

grant select, insert, update, delete on table clariti_video_generations to authenticated;

drop policy if exists "Users can read own Clariti video generations" on clariti_video_generations;
create policy "Users can read own Clariti video generations"
on clariti_video_generations for select
to authenticated
using ((select auth.uid()) = owner_id);

drop policy if exists "Users can insert own Clariti video generations" on clariti_video_generations;
create policy "Users can insert own Clariti video generations"
on clariti_video_generations for insert
to authenticated
with check ((select auth.uid()) = owner_id);

drop policy if exists "Users can update own Clariti video generations" on clariti_video_generations;
create policy "Users can update own Clariti video generations"
on clariti_video_generations for update
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

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
