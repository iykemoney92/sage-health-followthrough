create table if not exists nura_channel_links (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  provider text not null,
  channel_identifier text,
  link_code text not null,
  status text not null default 'pending',
  expires_at timestamptz not null,
  linked_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists nura_channel_links_pending_code_idx
  on nura_channel_links (provider, link_code)
  where status = 'pending';

create unique index if not exists nura_channel_links_active_identifier_idx
  on nura_channel_links (provider, channel_identifier)
  where status = 'active' and channel_identifier is not null;

create index if not exists nura_channel_links_owner_idx
  on nura_channel_links (owner_id, provider, status);
