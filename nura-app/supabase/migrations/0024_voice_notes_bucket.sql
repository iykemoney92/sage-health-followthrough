-- Voice notes recorded in the in-app chat.
--
-- Until now the mic only dictated: the audio went to speech-to-text and was thrown away, so
-- nothing was ever playable again. A voice note has to outlive the request, so the recording
-- lands in a private bucket under a folder named after the owner's auth uid - the same
-- per-user-folder pattern the clariti-documents policies use - and the message row keeps only
-- the object path. Signed URLs are minted client-side under these SELECT rights for playback.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('voice-notes', 'voice-notes', false, 10485760, array['audio/*'])
on conflict (id) do nothing;

drop policy if exists "Users can upload own Nura voice notes" on storage.objects;
create policy "Users can upload own Nura voice notes"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'voice-notes' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users can read own Nura voice notes" on storage.objects;
create policy "Users can read own Nura voice notes"
  on storage.objects for select to authenticated
  using (bucket_id = 'voice-notes' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users can delete own Nura voice notes" on storage.objects;
create policy "Users can delete own Nura voice notes"
  on storage.objects for delete to authenticated
  using (bucket_id = 'voice-notes' and (storage.foldername(name))[1] = (select auth.uid())::text);
