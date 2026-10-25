-- Someone can connect Apple Health on an iPhone and Health Connect on an Android phone.
-- Keyed without the platform, the two overwrote each other's day for each metric and the
-- series flipped between devices on every sync. Readers now pick one source per metric
-- (lib/health/health-store.ts pickOneSourcePerMetric).
alter table nura_health_daily drop constraint if exists nura_health_daily_pkey;
alter table nura_health_daily add primary key (owner_id, day, metric, platform);
