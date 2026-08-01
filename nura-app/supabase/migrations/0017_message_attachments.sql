-- Persist lightweight attachment metadata on chat messages for UI chips.
alter table nura_messages
  add column if not exists attachments jsonb not null default '[]'::jsonb;
