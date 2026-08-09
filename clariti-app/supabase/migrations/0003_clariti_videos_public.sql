-- Ensure Clariti generated videos remain publicly readable for playback and Shotstack stitching.
update storage.buckets
set public = true
where id = 'clariti-videos';

insert into storage.buckets (id, name, public)
values ('clariti-videos', 'clariti-videos', true)
on conflict (id) do update
set public = excluded.public;

-- Public bucket objects are served via /object/public/..., but keep authenticated
-- read/write policies for dashboard and signed clients.
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
