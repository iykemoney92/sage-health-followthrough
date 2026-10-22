-- The summary ElevenLabs writes when a check-in call ends. Kept for calls to someone an owner
-- cares for, so the owner can see how the call went on the plan page.
alter table nura_check_ins
  add column if not exists call_summary text;
