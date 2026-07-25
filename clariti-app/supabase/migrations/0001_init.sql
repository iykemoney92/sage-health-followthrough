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

insert into storage.buckets (id, name, public)
values ('clariti-documents', 'clariti-documents', false)
on conflict (id) do nothing;

alter table clariti_documents enable row level security;
alter table clariti_sessions enable row level security;
alter table clariti_session_documents enable row level security;
alter table clariti_messages enable row level security;
alter table clariti_artifacts enable row level security;
alter table clariti_follow_ups enable row level security;

grant select, insert, update, delete on table
  clariti_documents,
  clariti_sessions,
  clariti_session_documents,
  clariti_messages,
  clariti_artifacts,
  clariti_follow_ups
to authenticated;

create policy "Users can read own Clariti documents"
on clariti_documents for select
to authenticated
using ((select auth.uid()) = owner_id);

create policy "Users can insert own Clariti documents"
on clariti_documents for insert
to authenticated
with check ((select auth.uid()) = owner_id);

create policy "Users can update own Clariti documents"
on clariti_documents for update
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

create policy "Users can delete own Clariti documents"
on clariti_documents for delete
to authenticated
using ((select auth.uid()) = owner_id);

create policy "Users can read own Clariti sessions"
on clariti_sessions for select
to authenticated
using ((select auth.uid()) = owner_id);

create policy "Users can insert own Clariti sessions"
on clariti_sessions for insert
to authenticated
with check ((select auth.uid()) = owner_id);

create policy "Users can update own Clariti sessions"
on clariti_sessions for update
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

create policy "Users can delete own Clariti sessions"
on clariti_sessions for delete
to authenticated
using ((select auth.uid()) = owner_id);

create policy "Users can read own session document links"
on clariti_session_documents for select
to authenticated
using (exists (
  select 1 from clariti_sessions
  where clariti_sessions.id = clariti_session_documents.session_id
    and clariti_sessions.owner_id = (select auth.uid())
));

create policy "Users can insert own session document links"
on clariti_session_documents for insert
to authenticated
with check (
  exists (
    select 1 from clariti_sessions
    where clariti_sessions.id = clariti_session_documents.session_id
      and clariti_sessions.owner_id = (select auth.uid())
  )
  and exists (
    select 1 from clariti_documents
    where clariti_documents.id = clariti_session_documents.document_id
      and clariti_documents.owner_id = (select auth.uid())
  )
);

create policy "Users can delete own session document links"
on clariti_session_documents for delete
to authenticated
using (exists (
  select 1 from clariti_sessions
  where clariti_sessions.id = clariti_session_documents.session_id
    and clariti_sessions.owner_id = (select auth.uid())
));

create policy "Users can read messages in own sessions"
on clariti_messages for select
to authenticated
using (exists (
  select 1 from clariti_sessions
  where clariti_sessions.id = clariti_messages.session_id
    and clariti_sessions.owner_id = (select auth.uid())
));

create policy "Users can insert messages in own sessions"
on clariti_messages for insert
to authenticated
with check (exists (
  select 1 from clariti_sessions
  where clariti_sessions.id = clariti_messages.session_id
    and clariti_sessions.owner_id = (select auth.uid())
));

create policy "Users can read artifacts in own sessions"
on clariti_artifacts for select
to authenticated
using (exists (
  select 1 from clariti_sessions
  where clariti_sessions.id = clariti_artifacts.session_id
    and clariti_sessions.owner_id = (select auth.uid())
));

create policy "Users can insert artifacts in own sessions"
on clariti_artifacts for insert
to authenticated
with check (exists (
  select 1 from clariti_sessions
  where clariti_sessions.id = clariti_artifacts.session_id
    and clariti_sessions.owner_id = (select auth.uid())
));

create policy "Users can read own Clariti follow ups"
on clariti_follow_ups for select
to authenticated
using ((select auth.uid()) = owner_id);

create policy "Users can insert own Clariti follow ups"
on clariti_follow_ups for insert
to authenticated
with check ((select auth.uid()) = owner_id);

create policy "Users can update own Clariti follow ups"
on clariti_follow_ups for update
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

create policy "Users can upload own Clariti document files"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'clariti-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Users can read own Clariti document files"
on storage.objects for select
to authenticated
using (
  bucket_id = 'clariti-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

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
