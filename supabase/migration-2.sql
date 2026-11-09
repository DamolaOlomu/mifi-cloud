-- Run once in the Supabase SQL editor (safe to re-run).
alter table settings add column if not exists start_date date;
alter table settings add column if not exists cycle_days int default 30;
alter table settings add column if not exists auto_renew boolean default true;
alter table collector_state add column if not exists rate_bps numeric default 0;
create table if not exists hourly_usage (hour timestamptz primary key, bytes bigint not null default 0);
alter table hourly_usage enable row level security;
