-- Enables RLS on every user-data table and scopes access to the owning user.
-- Routes using the service-role client (webhooks, agent tool routes) bypass
-- RLS entirely by design and are unaffected by these policies.

alter table nura_profiles enable row level security;
alter table nura_plans enable row level security;
alter table nura_plan_milestones enable row level security;
alter table nura_plan_steps enable row level security;
alter table nura_messages enable row level security;
alter table nura_check_ins enable row level security;
alter table nura_observations enable row level security;
alter table nura_source_contexts enable row level security;
alter table nura_calendar_events enable row level security;
alter table nura_appointment_summaries enable row level security;
alter table nura_channel_links enable row level security;

create policy "owner_access" on nura_profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

create policy "owner_access" on nura_plans
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "owner_access" on nura_plan_milestones
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "owner_access" on nura_plan_steps
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "owner_access" on nura_messages
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "owner_access" on nura_check_ins
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "owner_access" on nura_observations
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "owner_access" on nura_source_contexts
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "owner_access" on nura_calendar_events
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "owner_access" on nura_appointment_summaries
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "owner_access" on nura_channel_links
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
