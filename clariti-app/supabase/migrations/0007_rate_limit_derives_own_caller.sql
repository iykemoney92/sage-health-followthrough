-- 0006 took the owner id as an argument, which meant any caller who could reach
-- the RPC could increment somebody else's counter and exhaust their quota. The
-- caller is no longer trusted to say who it is: the owner comes from auth.uid(),
-- so a session can only ever spend its own budget. EXECUTE is revoked from anon
-- as well as PUBLIC — Supabase grants anon separately, so revoking PUBLIC alone
-- left it reachable without signing in.

drop function if exists public.clariti_increment_rate_limit(uuid, text, timestamptz);

create or replace function public.clariti_increment_rate_limit(
  p_route text,
  p_window_start timestamptz
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  new_count integer;
begin
  if caller is null then
    raise exception 'clariti_increment_rate_limit requires an authenticated caller';
  end if;

  insert into clariti_rate_limits (owner_id, route, window_start, request_count)
  values (caller, p_route, p_window_start, 1)
  on conflict (owner_id, route, window_start)
  do update set request_count = clariti_rate_limits.request_count + 1
  returning request_count into new_count;

  return new_count;
end;
$$;

revoke all on function public.clariti_increment_rate_limit(text, timestamptz) from public, anon;
grant execute on function public.clariti_increment_rate_limit(text, timestamptz) to authenticated;
