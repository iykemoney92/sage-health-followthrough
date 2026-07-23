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
