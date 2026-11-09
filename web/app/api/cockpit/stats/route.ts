import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { COCKPIT_COOKIE, verifySessionToken } from '@/lib/cockpit-auth'
import { RANGE_KEYS, RangeKey, maskIp, resolveRange, COCKPIT_TZ } from '@/lib/cockpit-data'

export const dynamic = 'force-dynamic'

// Aggregates for the selected period — computed in Postgres by cockpit_stats()
// (see supabase/2026-11-09_cockpit.sql).
export async function GET(req: NextRequest) {
  if (!verifySessionToken(req.cookies.get(COCKPIT_COOKIE)?.value)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const param = req.nextUrl.searchParams.get('range') as RangeKey | null
  const key: RangeKey = param && RANGE_KEYS.includes(param) ? param : 'today'
  const range = resolveRange(key)

  // "All time" starts at the first recorded visit (no empty weeks before launch)
  if (key === 'all') {
    const { data: first } = await supabaseAdmin
      .from('connection_logs').select('ts').order('ts', { ascending: true }).limit(1).maybeSingle()
    if (first?.ts) range.from = new Date(Number(first.ts))
  }

  const call = (from: Date, to: Date) => supabaseAdmin.rpc('cockpit_stats', {
    p_from: from.toISOString(), p_to: to.toISOString(), p_bucket: range.bucket, p_tz: COCKPIT_TZ,
  })

  const [cur, prev] = await Promise.all([
    call(range.from, range.to),
    range.prev ? call(range.prev.from, range.prev.to) : Promise.resolve(null),
  ])

  if (cur.error) {
    // PGRST202 = function not found → the SQL migration hasn't been run yet
    const migrationMissing = cur.error.code === 'PGRST202' || /cockpit_stats/.test(cur.error.message)
    return NextResponse.json(
      { migrationMissing, error: cur.error.message },
      { status: migrationMissing ? 200 : 500 },
    )
  }

  const data = cur.data as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
  // GDPR: the cockpit never receives full IP addresses
  if (Array.isArray(data?.audience?.returning)) {
    data.audience.returning = data.audience.returning.map((r: { ip: string }) => ({ ...r, ip: maskIp(r.ip) }))
  }

  const p = prev?.data as Record<string, any> | null // eslint-disable-line @typescript-eslint/no-explicit-any
  return NextResponse.json({
    range: { key, from: range.from, to: range.to, bucket: range.bucket },
    current: data,
    previous: p ? {
      business: p.business,
      audience: { visits: p.audience?.visits, uniqueVisitors: p.audience?.uniqueVisitors },
      calls:    p.calls,
      reports:  { total: p.reports?.total },
    } : null,
  })
}
