-- WhatsApp only delivers a free-form message within 24 hours of the person's last message to
-- Nura. last_inbound_at records that moment so a check-in outside the window goes out as an
-- approved template instead of being silently dropped. call_permission_requested_at is when Nura
-- last asked to call on WhatsApp, so she asks at most once a month.

alter table public.nura_channel_links
  add column if not exists last_inbound_at timestamptz,
  add column if not exists call_permission_requested_at timestamptz;

comment on column public.nura_channel_links.last_inbound_at is
  'Last time this person messaged Nura on WhatsApp; opens Meta''s 24h free-form window.';
comment on column public.nura_channel_links.call_permission_requested_at is
  'Last time Nura sent the WhatsApp call-permission request to this number.';
