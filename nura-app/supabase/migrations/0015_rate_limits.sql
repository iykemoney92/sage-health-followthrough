create table if not exists nura_rate_limits (
  owner_id uuid not null,
  route text not null,
  window_start timestamptz not null,
  count int not null default 1,
  primary key (owner_id, route, window_start)
);

create index if not exists nura_rate_limits_window_idx on nura_rate_limits(window_start);

alter table nura_rate_limits enable row level security;

create policy "owner_access" on nura_rate_limits
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create or replace function nura_increment_rate_limit(p_owner_id uuid, p_route text, p_window_start timestamptz)
returns int
language sql
as $$
  insert into nura_rate_limits (owner_id, route, window_start, count)
  values (p_owner_id, p_route, p_window_start, 1)
  on conflict (owner_id, route, window_start)
  do update set count = nura_rate_limits.count + 1
  returning count;
$$;
