import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

const PLAN_PRICES: Record<string, number> = {
  '10min': 2.99,
  '30min': 7.99,
  '60min': 14.99,
}

function isAuthed(req: NextRequest) {
  const pass = req.cookies.get('cockpit_pass')?.value
  return !!pass && pass === process.env.COCKPIT_PASSWORD
}

export async function GET(req: NextRequest) {
  if (!isAuthed(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  // ── Live stats from Railway ──────────────────────────
  const serverUrl = process.env.SERVER_URL
  const statsSecret = process.env.STATS_SECRET
  let live = { clients: 0, queue: 0, rooms: 0 }
  try {
    const res = await fetch(`${serverUrl}/stats`, {
      headers: statsSecret ? { Authorization: `Bearer ${statsSecret}` } : {},
      cache: 'no-store',
    })
    if (res.ok) live = await res.json()
  } catch { /* server unreachable */ }

  // ── Users (Supabase auth) ──────────────────────────────
  let allUsers: { created_at: string }[] = []
  try {
    // listUsers returns up to 1000 per page — fine for a new platform
    const { data } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    allUsers = data?.users ?? []
  } catch { /* ignore */ }

  const totalUsers    = allUsers.length
  const todaySignups  = allUsers.filter(u => new Date(u.created_at) >= todayStart).length

  // ── Boosts / revenue (boost_sessions) ──────────────────
  let allBoosts: { plan: string; created_at: string }[] = []
  try {
    const { data } = await supabaseAdmin.from('boost_sessions').select('plan, created_at')
    allBoosts = data ?? []
  } catch { /* ignore */ }

  const totalBoosts   = allBoosts.length
  const totalRevenue  = allBoosts.reduce((s, b) => s + (PLAN_PRICES[b.plan] ?? 0), 0)
  const todayBoosts   = allBoosts.filter(b => new Date(b.created_at) >= todayStart)
  const todayRevenue  = todayBoosts.reduce((s, b) => s + (PLAN_PRICES[b.plan] ?? 0), 0)

  return NextResponse.json({
    live: {
      online: live.clients,
      queue:  live.queue,
      rooms:  live.rooms,
    },
    today: {
      signups: todaySignups,
      revenue: todayRevenue,
      boosts:  todayBoosts.length,
    },
    alltime: {
      users:   totalUsers,
      revenue: totalRevenue,
      boosts:  totalBoosts,
    },
  })
}
