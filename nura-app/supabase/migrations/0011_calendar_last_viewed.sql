alter table nura_profiles
  add column if not exists calendar_last_viewed_at timestamptz;
