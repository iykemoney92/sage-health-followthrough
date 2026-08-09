-- Pre-check-in reminder idempotency (email + browser push ~1h before due).
alter table public.nura_check_ins
  add column if not exists reminder_sent_at timestamptz;

create index if not exists nura_check_ins_reminder_due_idx
  on public.nura_check_ins (scheduled_for)
  where completed_at is null
    and triggered_at is null
    and reminder_sent_at is null;
