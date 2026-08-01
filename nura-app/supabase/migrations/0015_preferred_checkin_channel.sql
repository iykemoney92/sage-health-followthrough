alter table nura_profiles
  add column if not exists preferred_checkin_channel text not null default 'whatsapp';

comment on column nura_profiles.preferred_channel is
  'Where conversations happen: in_app | whatsapp | both';

comment on column nura_profiles.preferred_checkin_channel is
  'How Nura checks in: in_app | whatsapp | voice';
