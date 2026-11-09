import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { COCKPIT_COOKIE, verifySessionToken } from '@/lib/cockpit-auth'
import { maskIp, referrerHost } from '@/lib/cockpit-data'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 25

// Recent visits (connection_logs), newest first, paginated. IPs are masked.
export async function GET(req: NextRequest) {
  if (!verifySessionToken(req.cookies.get(COCKPIT_COOKIE)?.value)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const page = Math.max(0, Math.min(200, Number(req.nextUrl.searchParams.get('page')) || 0))
  const from = page * PAGE_SIZE

  const { data, error, count } = await supabaseAdmin
    .from('connection_logs')
    .select('*', { count: 'estimated' })
    .order('ts', { ascending: false })
    .range(from, from + PAGE_SIZE - 1)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = (data ?? []).map((r: Record<string, unknown>) => ({
    ts:        r.ts as number,
    ip:        maskIp(r.ip as string | null),
    country:   (r.country as string | null) ?? null,
    gender:    (r.gender as string | null) ?? null,
    interests: (r.interests as string[] | null) ?? [],
    duration:  (r.duration as number | null) ?? null,
    matches:   (r.matches as number | null | undefined) ?? null, // column added by the cockpit migration
    source:    referrerHost(r.referrer as string | null),
    device:    (r.device_type as string | null) ?? null,
    os:        (r.os as string | null) ?? null,
    screen:    (r.screen as string | null) ?? null,
  }))

  return NextResponse.json({
    page,
    pageSize: PAGE_SIZE,
    total: count ?? null,
    hasMore: rows.length === PAGE_SIZE,
    rows,
  })
}
