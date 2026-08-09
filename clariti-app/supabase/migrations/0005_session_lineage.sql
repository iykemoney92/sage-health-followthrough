alter table clariti_sessions
  add column if not exists parent_session_id uuid references clariti_sessions(id) on delete set null;

create index if not exists clariti_sessions_parent_idx
  on clariti_sessions (parent_session_id);
