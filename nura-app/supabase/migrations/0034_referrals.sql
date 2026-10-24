-- Referrals, phase 1: a personal invite link per person, and 30 days of Plus (no card) for a
-- friend who signs up through it.
--
-- Both tables are service-role only: RLS is on with no policies. A person's own code and the
-- number of friends who joined are read through /api/referrals/me, which never returns who
-- those friends are - knowing that someone you invited uses a health app is not ours to share.
-- The friend's Plus itself is the existing complimentary_plus_until grant on nura_profiles.

create table if not exists nura_referral_codes (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  code text not null unique check (code ~ '^[A-Z2-9]{8}$'),
  created_at timestamptz not null default now()
);

alter table nura_referral_codes enable row level security;

create table if not exists nura_referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references auth.users(id) on delete cascade,
  -- One referral per account, ever: the unique key is what makes claiming idempotent.
  referee_id uuid not null unique references auth.users(id) on delete cascade,
  code text not null,
  status text not null check (status in ('rewarded', 'not_eligible')),
  friend_plus_until timestamptz,
  not_eligible_reason text,
  source text,
  created_at timestamptz not null default now()
);

create index if not exists nura_referrals_referrer_idx on nura_referrals(referrer_id, created_at desc);

alter table nura_referrals enable row level security;
