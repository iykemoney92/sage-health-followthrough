-- Clariti schema was accidentally applied to the Nura Supabase project
-- (ygzflyahftmyokfepyqf) before Clariti got its own project
-- (hkfmavdrzsayxpifpoho). Clariti tables here were empty; drop the stray
-- objects so Nura only keeps nura_* schema.

drop trigger if exists clariti_profiles_protect_subscription on public.clariti_profiles;
drop function if exists public.clariti_protect_subscription_columns();

drop table if exists public.clariti_session_documents cascade;
drop table if exists public.clariti_messages cascade;
drop table if exists public.clariti_artifacts cascade;
drop table if exists public.clariti_follow_ups cascade;
drop table if exists public.clariti_video_generations cascade;
drop table if exists public.clariti_documents cascade;
drop table if exists public.clariti_sessions cascade;
drop table if exists public.clariti_revenuecat_webhook_events cascade;
drop table if exists public.clariti_profiles cascade;
