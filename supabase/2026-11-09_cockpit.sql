-- Cockpit v2 — run once in the Supabase SQL editor (idempotent).
--
-- 1. connection_logs becomes one row per visit (socket connection):
--      duration = total chat seconds during the visit, matches = conversations
-- 2. matches: one row per conversation (duration, WebRTC connected, TURN relay, wait)
-- 3. boost_sessions.amount_cents: amount actually paid (from Stripe)
-- 4. cockpit_stats(): all cockpit aggregates computed in Postgres (Europe/Paris)

-- ── 1. connection_logs ─────────────────────────────────────
alter table public.connection_logs add column if not exists matches integer not null default 0;
create index if not exists connection_logs_ts_idx on public.connection_logs (ts);
create index if not exists connection_logs_ip_idx on public.connection_logs (ip);

-- ── 2. matches ─────────────────────────────────────────────
create table if not exists public.matches (
  id          uuid primary key default gen_random_uuid(),
  room_id     text not null unique,
  started_at  timestamptz not null default now(),
  ended_at    timestamptz,
  duration    integer,          -- seconds
  connected   boolean,          -- WebRTC connected (null = never reported)
  relay       boolean,          -- media went through TURN
  setup_ms    integer,          -- match → connected
  wait_ms_a   integer,          -- queue wait of each participant
  wait_ms_b   integer,
  country_a   text,
  country_b   text
);
create index if not exists matches_started_at_idx on public.matches (started_at);
alter table public.matches enable row level security;  -- service role only

-- ── 3. boost_sessions ──────────────────────────────────────
alter table public.boost_sessions add column if not exists amount_cents integer;
alter table public.boost_sessions add column if not exists currency text;
create index if not exists boost_sessions_created_at_idx on public.boost_sessions (created_at);
create index if not exists reports_ts_idx on public.reports (ts);

-- ── 4. cockpit_stats ───────────────────────────────────────
-- p_bucket: 'hour' | 'day' | 'week' — granularity of the time series
create or replace function public.cockpit_stats(
  p_from   timestamptz,
  p_to     timestamptz,
  p_bucket text default 'day',
  p_tz     text default 'Europe/Paris'
) returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_from_ms bigint := (extract(epoch from p_from) * 1000)::bigint;
  v_to_ms   bigint := (extract(epoch from p_to)   * 1000)::bigint;
  v_bucket  text   := case when p_bucket in ('hour', 'day', 'week') then p_bucket else 'day' end;
  v_step    interval := ('1 ' || v_bucket)::interval;
  result    jsonb;
begin
  with
  boosts as (
    select b.*,
           coalesce(b.amount_cents,
             case b.plan when '10min' then 299 when '30min' then 799 when '60min' then 1499 else 0 end
           ) as cents
    from boost_sessions b
    where b.created_at >= p_from and b.created_at < p_to
  ),
  users_in as (
    select u.created_at from auth.users u
    where u.created_at >= p_from and u.created_at < p_to and u.deleted_at is null
  ),
  visits as (
    select c.* from connection_logs c where c.ts >= v_from_ms and c.ts < v_to_ms
  ),
  m as (
    select * from matches where started_at >= p_from and started_at < p_to
  ),
  r as (
    select * from reports where ts >= v_from_ms and ts < v_to_ms
  ),
  buckets as (
    select gs as local_start
    from generate_series(
      date_trunc(v_bucket, p_from at time zone p_tz),
      date_trunc(v_bucket, (p_to - interval '1 millisecond') at time zone p_tz),
      v_step
    ) gs
  )
  select jsonb_build_object(
    'business', (
      select jsonb_build_object(
        'revenue',        coalesce(sum(cents), 0) / 100.0,
        'boosts',         count(*),
        'buyers',         count(distinct user_id),
        'signups',        (select count(*) from users_in),
        'plans', coalesce((
          select jsonb_object_agg(plan, jsonb_build_object('count', n, 'revenue', rev))
          from (select coalesce(plan, 'unknown') as plan, count(*) as n, sum(cents) / 100.0 as rev
                from boosts group by 1) p
        ), '{}'::jsonb)
      ) from boosts
    ),
    'totals', jsonb_build_object(
      'users',        (select count(*) from auth.users where deleted_at is null),
      'payingUsers',  (select count(distinct user_id) from boost_sessions where user_id is not null),
      'revenue',      (select coalesce(sum(coalesce(amount_cents,
                         case plan when '10min' then 299 when '30min' then 799 when '60min' then 1499 else 0 end
                       )), 0) / 100.0 from boost_sessions)
    ),
    'audience', jsonb_build_object(
      'visits',          (select count(*) from visits),
      'uniqueVisitors',  (select count(distinct ip) from visits),
      'countries', coalesce((select jsonb_agg(jsonb_build_object('key', k, 'count', n) order by n desc) from (
          select country as k, count(*) as n from visits where country is not null group by 1 order by 2 desc limit 10) x), '[]'),
      'genders', coalesce((select jsonb_agg(jsonb_build_object('key', k, 'count', n) order by n desc) from (
          select coalesce(gender, '?') as k, count(*) as n from visits group by 1) x), '[]'),
      'devices', coalesce((select jsonb_agg(jsonb_build_object('key', k, 'count', n) order by n desc) from (
          select coalesce(device_type, '?') as k, count(*) as n from visits group by 1 order by 2 desc limit 6) x), '[]'),
      'os', coalesce((select jsonb_agg(jsonb_build_object('key', k, 'count', n) order by n desc) from (
          select coalesce(os, '?') as k, count(*) as n from visits group by 1 order by 2 desc limit 8) x), '[]'),
      'referrers', coalesce((select jsonb_agg(jsonb_build_object('key', k, 'count', n) order by n desc) from (
          select coalesce(lower(substring(referrer from '^[a-zA-Z]+://(?:www\.)?([^/:?#]+)')), 'direct') as k,
                 count(*) as n
          from visits group by 1 order by 2 desc limit 8) x), '[]'),
      'interests', coalesce((select jsonb_agg(jsonb_build_object('key', k, 'count', n) order by n desc) from (
          select lower(i) as k, count(*) as n from visits, unnest(interests) as i
          group by 1 order by 2 desc limit 12) x), '[]'),
      -- Returning = IP seen on at least 2 different days (robust to several rows per visit)
      'returning', coalesce((select jsonb_agg(jsonb_build_object('ip', ip, 'days', days, 'visits', n, 'country', country) order by days desc, n desc) from (
          select ip, count(distinct (to_timestamp(ts / 1000.0) at time zone p_tz)::date) as days,
                 count(*) as n, max(country) as country
          from visits where ip is not null group by ip
          having count(distinct (to_timestamp(ts / 1000.0) at time zone p_tz)::date) >= 2
          order by 2 desc, 3 desc limit 15) x), '[]'),
      'returningCount', (select count(*) from (
          select ip from visits where ip is not null group by ip
          having count(distinct (to_timestamp(ts / 1000.0) at time zone p_tz)::date) >= 2) x)
    ),
    'calls', (
      select jsonb_build_object(
        'matches',         count(*),
        'reported',        count(connected),
        'connected',       count(*) filter (where connected),
        'relay',           count(*) filter (where connected and relay),
        'medianDuration',  percentile_cont(0.5) within group (order by duration) filter (where duration is not null),
        'avgDuration',     avg(duration) filter (where duration is not null),
        'shortSkips',      count(*) filter (where duration is not null and duration < 10),
        'ended',           count(duration),
        'medianSetupMs',   percentile_cont(0.5) within group (order by setup_ms) filter (where setup_ms is not null),
        'medianWaitMs',    (select percentile_cont(0.5) within group (order by w) from (
                              select wait_ms_a as w from m where wait_ms_a is not null
                              union all select wait_ms_b from m where wait_ms_b is not null) ww)
      ) from m
    ),
    'reports', jsonb_build_object(
      'total',    (select count(*) from r),
      'byReason', coalesce((select jsonb_agg(jsonb_build_object('key', reason, 'count', n) order by n desc) from (
                    select reason, count(*) as n from r group by 1) x), '[]'),
      'latest',   coalesce((select jsonb_agg(jsonb_build_object('ts', ts, 'reason', reason, 'roomId', room_id) order by ts desc) from (
                    select ts, reason, room_id from r order by ts desc limit 20) x), '[]')
    ),
    'series', coalesce((
      select jsonb_agg(jsonb_build_object(
        't',       (b.local_start at time zone p_tz),
        'revenue', coalesce(rv.v, 0) / 100.0,
        'signups', coalesce(su.v, 0),
        'visits',  coalesce(vi.v, 0),
        'matches', coalesce(mm.v, 0)
      ) order by b.local_start)
      from buckets b
      left join (select date_trunc(v_bucket, created_at at time zone p_tz) as k, sum(cents) as v
                 from boosts group by 1) rv on rv.k = b.local_start
      left join (select date_trunc(v_bucket, created_at at time zone p_tz) as k, count(*) as v
                 from users_in group by 1) su on su.k = b.local_start
      left join (select date_trunc(v_bucket, to_timestamp(ts / 1000.0) at time zone p_tz) as k, count(*) as v
                 from visits group by 1) vi on vi.k = b.local_start
      left join (select date_trunc(v_bucket, started_at at time zone p_tz) as k, count(*) as v
                 from m group by 1) mm on mm.k = b.local_start
    ), '[]')
  ) into result;

  return result;
end;
$$;

revoke all on function public.cockpit_stats(timestamptz, timestamptz, text, text) from public, anon, authenticated;
grant execute on function public.cockpit_stats(timestamptz, timestamptz, text, text) to service_role;

-- Make PostgREST pick up the new function/columns immediately
notify pgrst, 'reload schema';
