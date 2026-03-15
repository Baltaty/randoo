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
  let live: { clients: number; queue: number; rooms: number; log?: unknown[] } = { clients: 0, queue: 0, rooms: 0 }
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

  const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - 7); weekStart.setHours(0, 0, 0, 0)
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)
  const weekBoosts  = allBoosts.filter(b => new Date(b.created_at) >= weekStart)
  const monthBoosts = allBoosts.filter(b => new Date(b.created_at) >= monthStart)
  const weekRevenue  = weekBoosts.reduce((s, b)  => s + (PLAN_PRICES[b.plan] ?? 0), 0)
  const monthRevenue = monthBoosts.reduce((s, b) => s + (PLAN_PRICES[b.plan] ?? 0), 0)

  const plans: Record<string, { count: number; revenue: number }> = {}
  for (const b of allBoosts) {
    const p = b.plan ?? 'unknown'
    if (!plans[p]) plans[p] = { count: 0, revenue: 0 }
    plans[p].count++
    plans[p].revenue += PLAN_PRICES[p] ?? 0
  }

  // ── Connection log (Supabase — persistent, full history) ─────────────
  let connectionLog: {
    ts: number; ip?: string; country?: string
    gender?: string; interests: string[]; duration?: number
  }[] = []
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/connection_logs?select=ts,ip,country,gender,interests,duration&order=ts.desc&limit=200`,
      {
        headers: {
          apikey:        process.env.SUPABASE_SERVICE_ROLE_KEY!,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
        },
        cache: 'no-store',
      }
    )
    if (res.ok) {
      const rows = await res.json() as Array<{
        ts: number; ip: string | null; country: string | null
        gender: string | null; interests: string[]; duration: number | null
      }>
      connectionLog = rows.map(r => ({
        ts:        r.ts,
        ip:        r.ip        ?? undefined,
        country:   r.country   ?? undefined,
        gender:    r.gender    ?? undefined,
        interests: r.interests ?? [],
        duration:  r.duration  ?? undefined,
      }))
    }
  } catch { /* fallback to empty */ }

  // ── Returning visitors (all-time, grouped by IP) ──────
  let returning: { ip: string; sessions: number; country?: string }[] = []
  try {
    const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const res = await fetch(
      `${sbUrl}/rest/v1/connection_logs?select=ip,country&ip=not.is.null`,
      { headers: { apikey: sbKey, Authorization: `Bearer ${sbKey}` }, cache: 'no-store' }
    )
    if (res.ok) {
      const rows = await res.json() as Array<{ ip: string; country: string | null }>
      const ipMap: Record<string, { sessions: number; country?: string }> = {}
      for (const r of rows) {
        if (!ipMap[r.ip]) ipMap[r.ip] = { sessions: 0, country: r.country ?? undefined }
        ipMap[r.ip].sessions++
      }
      returning = Object.entries(ipMap)
        .filter(([, v]) => v.sessions >= 2)
        .sort((a, b) => b[1].sessions - a[1].sessions)
        .slice(0, 10)
        .map(([ip, v]) => ({ ip, sessions: v.sessions, country: v.country }))
    }
  } catch { /* ignore */ }

  return NextResponse.json({
    live: {
      online: live.clients,
      queue:  live.queue,
      rooms:  live.rooms,
      log:    connectionLog,
    },
    today: {
      signups: todaySignups,
      revenue: todayRevenue,
      boosts:  todayBoosts.length,
    },
    week: {
      revenue: weekRevenue,
      boosts:  weekBoosts.length,
    },
    month: {
      revenue: monthRevenue,
      boosts:  monthBoosts.length,
    },
    alltime: {
      users:   totalUsers,
      revenue: totalRevenue,
      boosts:  totalBoosts,
    },
    plans,
    returning,
  })
}
