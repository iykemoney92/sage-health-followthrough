-- Usual times people anchor check-ins to ("after work", "after school", "after the school run"),
-- learned once in chat so Nura doesn't have to ask again. Local wall-clock "HH:MM" per anchor,
-- e.g. {"after_work": "18:00"}. The owner can read and write their own row like the rest of
-- the profile; it goes with the profile on export and deletion.

alter table public.nura_profiles
  add column if not exists routine_times jsonb not null default '{}'::jsonb;

comment on column public.nura_profiles.routine_times is
  'Learned routine anchors → local "HH:MM", e.g. {"after_work":"18:00"}. Set from chat.';
