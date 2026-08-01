alter table nura_profiles
  add column if not exists preferred_checkin_channels text[] not null default array['whatsapp','in_app','voice']::text[];

comment on column nura_profiles.preferred_checkin_channels is
  'Channels Nura may proactively use for scheduled check-ins: subset of in_app | whatsapp | voice. Defaults to all three for backward compatibility.';
