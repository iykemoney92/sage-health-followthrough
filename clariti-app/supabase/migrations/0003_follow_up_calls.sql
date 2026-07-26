alter table clariti_follow_ups
  add column if not exists analysis_payload jsonb,
  add column if not exists triggered_at timestamptz,
  add column if not exists call_status text,
  add column if not exists call_error text,
  add column if not exists call_conversation_id text;
