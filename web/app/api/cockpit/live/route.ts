import { NextRequest, NextResponse } from 'next/server'
import { COCKPIT_COOKIE, verifySessionToken } from '@/lib/cockpit-auth'

export const dynamic = 'force-dynamic'

// Live metrics from the Railway signaling server — polled every few seconds.
export async function GET(req: NextRequest) {
  if (!verifySessionToken(req.cookies.get(COCKPIT_COOKIE)?.value)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const serverUrl   = process.env.SERVER_URL
  const statsSecret = process.env.STATS_SECRET
  try {
    const res = await fetch(`${serverUrl}/stats`, {
      headers: statsSecret ? { Authorization: `Bearer ${statsSecret}` } : {},
      cache:   'no-store',
      signal:  AbortSignal.timeout(4000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const s = await res.json()
    return NextResponse.json({
      serverOk: true,
      online:   s.clients ?? 0,
      queue:    s.queue ?? 0,
      rooms:    s.rooms ?? 0,
      turn:     s.turn ?? 'unknown',
      uptime:   s.uptime ?? null,
      lastHour: s.lastHour ?? null,
      history:  Array.isArray(s.history) ? s.history : [],
    })
  } catch (err) {
    // Never report "0 online" when the server is simply unreachable
    return NextResponse.json({ serverOk: false, error: (err as Error).message })
  }
}
