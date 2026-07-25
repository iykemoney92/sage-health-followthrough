create table if not exists nura_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  preferred_channel text not null default 'whatsapp',
  interests text[] not null default '{}',
  created_at timestamptz not null default now()
);
