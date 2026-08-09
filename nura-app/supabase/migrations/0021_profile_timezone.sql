-- User IANA timezone for check-in / call scheduling (e.g. Europe/London).
alter table public.nura_profiles
  add column if not exists timezone text;

comment on column public.nura_profiles.timezone is
  'IANA timezone (e.g. Europe/London). Check-ins and quiet hours use this wall clock, not server UTC.';
