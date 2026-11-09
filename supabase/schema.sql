create table if not exists daily_usage (day date primary key, bytes bigint not null default 0);
create table if not exists collector_state (id int primary key, last_total bigint, last_seen timestamptz);
create table if not exists settings (id int primary key, cap_gb numeric, used_gb numeric default 0, tracked_at_save bigint default 0);
-- Tables are only touched by the server with the service-role key, so lock them from the public API:
alter table daily_usage enable row level security;
alter table collector_state enable row level security;
alter table settings enable row level security;
