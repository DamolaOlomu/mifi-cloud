-- Run once in the Supabase SQL editor (safe to re-run).
create table if not exists account (
  id int primary key, name text, tagline text, avatar text,
  socials jsonb default '[]'::jsonb, pin_hash text, alert_gb numeric default 0
);
alter table account enable row level security;
