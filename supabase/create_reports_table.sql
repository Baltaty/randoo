-- Run this in your Supabase SQL editor to enable the report feature
create table if not exists reports (
  id          uuid default gen_random_uuid() primary key,
  ts          bigint not null,
  reporter_ip text,
  room_id     text not null,
  reason      text not null,
  created_at  timestamptz default now()
);
