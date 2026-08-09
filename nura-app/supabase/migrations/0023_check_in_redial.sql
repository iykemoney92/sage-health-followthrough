-- Redial-once support: track voice attempt count and when a pending redial is due.
alter table nura_check_ins
  add column if not exists call_attempts integer not null default 0,
  add column if not exists redial_at timestamptz;

create index if not exists nura_check_ins_redial_due_idx
  on public.nura_check_ins (redial_at)
  where call_status = 'redial_pending';
