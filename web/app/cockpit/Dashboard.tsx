'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import LiveGlobe from './LiveGlobe'

interface LogEntry {
  ts:         number
  ip?:        string
  country?:   string
  gender?:    string
  interests:  string[]
  duration?:  number
}

interface Stats {
  live:      { online: number; queue: number; rooms: number; log: LogEntry[] }
  today:     { signups: number; revenue: number; boosts: number }
  week:      { revenue: number; boosts: number }
  month:     { revenue: number; boosts: number }
  alltime:   { users: number; revenue: number; boosts: number }
  plans:     Record<string, { count: number; revenue: number }>
  returning: { ip: string; sessions: number; country?: string }[]
}

function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 5)  return 'just now'
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  return `${Math.floor(s / 3600)}h ago`
}

function countryFlag(code?: string) {
  if (!code) return '🌐'
  return code.toUpperCase().split('').map(c =>
    String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)
  ).join('')
}

function fmt(n: number) { return n.toLocaleString('en-US') }
function fmtMoney(n: number) { return '$' + n.toFixed(2) }
function fmtDate(ts: number) {
  return new Date(ts).toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}
function fmtDuration(secs?: number) {
  if (secs === undefined) return '—'
  if (secs < 60) return `${secs}s`
  return `${Math.floor(secs / 60)}m ${secs % 60}s`
}

function StatRow({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex items-center justify-between py-3" style={{ borderBottom: '1px solid #1e1e1e' }}>
      <span className="text-sm" style={{ color: '#666' }}>{label}</span>
      <span className="text-base font-bold tabular-nums" style={{ color: accent ?? 'white' }}>
        {value}
      </span>
    </div>
  )
}

function Card({ title, dot, children }: { title: string; dot?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-5" style={{ background: '#111', border: '1px solid #1e1e1e' }}>
      <div className="flex items-center gap-2 mb-1">
        {dot && (
          <span className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: dot, boxShadow: `0 0 6px ${dot}` }} />
        )}
        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#444' }}>
          {title}
        </span>
      </div>
      <div>{children}</div>
    </div>
  )
}

function SectionHeader({ dot, title, right }: { dot: string; title: string; right?: string }) {
  return (
    <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid #1e1e1e' }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: dot, boxShadow: `0 0 5px ${dot}` }} />
      <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#444' }}>{title}</span>
      {right && <span className="text-xs ml-auto" style={{ color: '#333' }}>{right}</span>}
    </div>
  )
}

const PLAN_LABELS: Record<string, string> = {
  '10min': '10 min — $2.99',
  '30min': '30 min — $7.99',
  '60min': '1 h — $14.99',
}

export default function Dashboard() {
  const router = useRouter()
  const [stats, setStats]   = useState<Stats | null>(null)
  const [error, setError]   = useState('')
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [tick, setTick]     = useState(0)

  const fetchStats = useCallback(async () => {
    const res = await fetch('/api/cockpit/stats')
    if (res.status === 401) { router.refresh(); return }
    if (!res.ok) { setError('Failed to fetch stats'); return }
    setStats(await res.json())
    setLastUpdate(new Date())
    setError('')
  }, [router])

  useEffect(() => {
    fetchStats()
    const id = setInterval(fetchStats, 5000)
    return () => clearInterval(id)
  }, [fetchStats])

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  // ── Computed from log ──────────────────────────────────
  const computed = useMemo(() => {
    const log = stats?.live.log ?? []

    // Avg duration
    const withDur = log.filter(e => e.duration !== undefined) as (LogEntry & { duration: number })[]
    const avgDuration = withDur.length > 0
      ? Math.round(withDur.reduce((s, e) => s + e.duration, 0) / withDur.length)
      : undefined

    // Top countries
    const countryCounts: Record<string, number> = {}
    for (const e of log) {
      if (e.country) countryCounts[e.country] = (countryCounts[e.country] ?? 0) + 1
    }
    const topCountries = Object.entries(countryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)

    // Gender split
    const genderCounts: Record<string, number> = { M: 0, F: 0, O: 0 }
    for (const e of log) {
      if (e.gender && e.gender in genderCounts) genderCounts[e.gender]++
    }
    const genderTotal = genderCounts.M + genderCounts.F + genderCounts.O

    // Top interests
    const interestCounts: Record<string, number> = {}
    for (const e of log) {
      for (const i of e.interests) {
        const k = i.toLowerCase()
        interestCounts[k] = (interestCounts[k] ?? 0) + 1
      }
    }
    const topInterests = Object.entries(interestCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)

    // Conversion rate
    const convRate = stats && stats.alltime.users > 0
      ? ((stats.alltime.boosts / stats.alltime.users) * 100).toFixed(1)
      : null

    return { avgDuration, topCountries, genderCounts, genderTotal, topInterests, convRate }
  }, [stats])

  async function logout() {
    await fetch('/api/cockpit/auth', { method: 'DELETE' })
    router.refresh()
  }

  const secAgo = lastUpdate ? Math.floor((Date.now() - lastUpdate.getTime()) / 1000) : null
  const lastStr = secAgo === null ? '…' : secAgo < 5 ? 'just now' : `${secAgo}s ago`

  return (
    <div className="min-h-screen p-6" style={{ background: '#0a0a0a' }}>

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-2.5">
          <svg width="18" height="22" viewBox="0 0 44 52" fill="none">
            <path d="M 10 18 C 10 8 34 8 34 18 C 34 26 24 28 22 32"
              stroke="#ffd53a" strokeWidth="9" strokeLinecap="round"/>
            <circle cx="22" cy="46" r="5" fill="#ffd53a"/>
          </svg>
          <span className="font-bold text-white text-lg" style={{ letterSpacing: '-0.5px' }}>cockpit</span>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#1a1a1a', color: '#555' }}>
            randoo.fun
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs" style={{ color: '#444' }}>
            {void tick}Updated {lastStr}
          </span>
          <button onClick={fetchStats}
            className="text-xs px-3 py-1.5 rounded-lg transition-all hover:opacity-70"
            style={{ background: '#1a1a1a', color: '#666', border: '1px solid #272727' }}>
            Refresh
          </button>
          <button onClick={logout}
            className="text-xs px-3 py-1.5 rounded-lg transition-all hover:opacity-70"
            style={{ background: '#1a1a1a', color: '#666', border: '1px solid #272727' }}>
            Logout
          </button>
        </div>
      </div>

      {error && (
        <p className="text-sm mb-6 px-4 py-3 rounded-xl" style={{ background: '#1a0a0a', color: '#f02031', border: '1px solid #2a1010' }}>
          {error}
        </p>
      )}

      {/* Row 1 — Live / Today / Week / Month / All time */}
      <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>

        <Card title="Live" dot="#3beea8">
          <StatRow label="Online"       value={stats ? fmt(stats.live.online) : '…'} accent="#3beea8" />
          <StatRow label="In queue"     value={stats ? fmt(stats.live.queue)  : '…'} />
          <StatRow label="Active chats" value={stats ? fmt(stats.live.rooms)  : '…'} />
          <StatRow
            label="Avg chat duration"
            value={computed.avgDuration !== undefined ? fmtDuration(computed.avgDuration) : '—'}
          />
        </Card>

        <Card title="Today">
          <StatRow label="New signups" value={stats ? `+${fmt(stats.today.signups)}` : '…'} accent="#ffd53a" />
          <StatRow label="Revenue"     value={stats ? fmtMoney(stats.today.revenue)  : '…'} accent="#ffd53a" />
          <StatRow label="Boosts sold" value={stats ? fmt(stats.today.boosts)        : '…'} />
        </Card>

        <Card title="This week">
          <StatRow label="Revenue"     value={stats ? fmtMoney(stats.week.revenue) : '…'} accent="#7c61ff" />
          <StatRow label="Boosts sold" value={stats ? fmt(stats.week.boosts)       : '…'} />
        </Card>

        <Card title="This month">
          <StatRow label="Revenue"     value={stats ? fmtMoney(stats.month.revenue) : '…'} accent="#ff66b3" />
          <StatRow label="Boosts sold" value={stats ? fmt(stats.month.boosts)       : '…'} />
        </Card>

        <Card title="All time">
          <StatRow label="Total users"      value={stats ? fmt(stats.alltime.users)        : '…'} />
          <StatRow label="Total revenue"    value={stats ? fmtMoney(stats.alltime.revenue) : '…'} accent="#ff66b3" />
          <StatRow label="Total boosts"     value={stats ? fmt(stats.alltime.boosts)       : '…'} />
          <StatRow
            label="Signup → boost"
            value={computed.convRate !== null ? `${computed.convRate}%` : '—'}
            accent="#3aff43"
          />
        </Card>

      </div>

      {/* Row 2 — Top countries / Gender / Top interests */}
      <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>

        {/* Top countries */}
        <div className="rounded-2xl overflow-hidden" style={{ background: '#111', border: '1px solid #1e1e1e' }}>
          <SectionHeader dot="#ffd53a" title="Top countries" right="last 200 connections" />
          <div className="p-5">
            {computed.topCountries.length === 0
              ? <p className="text-xs" style={{ color: '#333' }}>No data yet</p>
              : computed.topCountries.map(([country, count]) => {
                  const max = computed.topCountries[0][1]
                  const pct = Math.round((count / max) * 100)
                  return (
                    <div key={country} className="mb-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm" style={{ color: '#888' }}>
                          {countryFlag(country)} {country}
                        </span>
                        <span className="text-sm font-bold tabular-nums" style={{ color: 'white' }}>{count}</span>
                      </div>
                      <div className="h-1 rounded-full" style={{ background: '#1e1e1e' }}>
                        <div className="h-1 rounded-full" style={{ width: `${pct}%`, background: '#ffd53a' }} />
                      </div>
                    </div>
                  )
                })
            }
          </div>
        </div>

        {/* Gender split */}
        <div className="rounded-2xl overflow-hidden" style={{ background: '#111', border: '1px solid #1e1e1e' }}>
          <SectionHeader dot="#ff66b3" title="Gender split" right="last 200 connections" />
          <div className="p-5">
            {computed.genderTotal === 0
              ? <p className="text-xs" style={{ color: '#333' }}>No data yet</p>
              : (['M', 'F', 'O'] as const).map(g => {
                  const count = computed.genderCounts[g]
                  const pct   = computed.genderTotal > 0 ? ((count / computed.genderTotal) * 100).toFixed(0) : '0'
                  const labels = { M: 'Man', F: 'Woman', O: 'Other' }
                  const colors = { M: '#7c61ff', F: '#ff66b3', O: '#888' }
                  return (
                    <div key={g} className="mb-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm" style={{ color: '#888' }}>{labels[g]}</span>
                        <span className="text-sm font-bold tabular-nums" style={{ color: 'white' }}>
                          {count} <span style={{ color: '#444', fontWeight: 400 }}>({pct}%)</span>
                        </span>
                      </div>
                      <div className="h-1 rounded-full" style={{ background: '#1e1e1e' }}>
                        <div className="h-1 rounded-full" style={{ width: `${pct}%`, background: colors[g] }} />
                      </div>
                    </div>
                  )
                })
            }
          </div>
        </div>

        {/* Top interests */}
        <div className="rounded-2xl overflow-hidden" style={{ background: '#111', border: '1px solid #1e1e1e' }}>
          <SectionHeader dot="#3aff43" title="Top interests" right="last 200 connections" />
          <div className="p-5">
            {computed.topInterests.length === 0
              ? <p className="text-xs" style={{ color: '#333' }}>No data yet</p>
              : (
                <div className="flex flex-wrap gap-2">
                  {computed.topInterests.map(([interest, count]) => (
                    <span key={interest}
                      className="text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5"
                      style={{ background: '#1a1a1a', border: '1px solid #272727', color: '#888' }}>
                      {interest}
                      <span style={{ color: '#3aff43', fontWeight: 700 }}>{count}</span>
                    </span>
                  ))}
                </div>
              )
            }
          </div>
        </div>

      </div>

      {/* Plan breakdown */}
      {stats && Object.keys(stats.plans).length > 0 && (
        <div className="mb-4 rounded-2xl overflow-hidden" style={{ background: '#111', border: '1px solid #1e1e1e' }}>
          <SectionHeader dot="#ff66b3" title="Boost plan breakdown" />
          <div className="grid gap-px" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', background: '#1e1e1e' }}>
            {['10min', '30min', '60min'].map(plan => {
              const d = stats.plans[plan]
              return (
                <div key={plan} className="p-5" style={{ background: '#111' }}>
                  <p className="text-xs mb-3" style={{ color: '#444' }}>{PLAN_LABELS[plan] ?? plan}</p>
                  <p className="text-2xl font-bold tabular-nums" style={{ color: 'white' }}>
                    {d ? fmt(d.count) : '0'}
                  </p>
                  <p className="text-sm mt-1" style={{ color: '#ff66b3' }}>
                    {d ? fmtMoney(d.revenue) : '$0.00'}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Returning visitors */}
      {stats && stats.returning.length > 0 && (
        <div className="mb-4 rounded-2xl overflow-hidden" style={{ background: '#111', border: '1px solid #1e1e1e' }}>
          <SectionHeader dot="#3aff43" title="Returning visitors" right="≥ 2 sessions, all-time" />
          <div style={{ overflowY: 'auto', maxHeight: 320 }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid #1a1a1a' }}>
                  {['#', 'IP', 'Country', 'Sessions'].map(h => (
                    <th key={h} className="text-left px-5 py-2 text-xs font-semibold"
                      style={{ color: '#333', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats.returning.map((v, i) => (
                  <tr key={v.ip} style={{ borderBottom: '1px solid #141414' }}
                    className="transition-colors hover:bg-white/[0.02]">
                    <td className="px-5 py-2.5 text-xs tabular-nums" style={{ color: '#333' }}>{i + 1}</td>
                    <td className="px-5 py-2.5 text-xs font-mono" style={{ color: '#555' }}>{v.ip}</td>
                    <td className="px-5 py-2.5 text-xs" style={{ whiteSpace: 'nowrap' }}>
                      <span className="mr-1.5">{countryFlag(v.country)}</span>
                      <span style={{ color: '#666' }}>{v.country ?? '—'}</span>
                    </td>
                    <td className="px-5 py-2.5 text-sm font-bold tabular-nums" style={{ color: '#3aff43' }}>
                      {v.sessions}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Live globe */}
      <div className="mb-4 rounded-2xl overflow-hidden" style={{ background: '#111', border: '1px solid #1e1e1e' }}>
        <SectionHeader
          dot="#ffd53a"
          title="Live visitors map"
          right={stats ? `${stats.live.log.filter(e => e.country).length} located` : '…'}
        />
        <LiveGlobe log={stats?.live.log ?? []} />
      </div>

      {/* Recent connections */}
      <div className="rounded-2xl overflow-hidden" style={{ background: '#111', border: '1px solid #1e1e1e' }}>
        <SectionHeader dot="#3beea8" title="Recent connections" right="last 100" />

        {(() => {
          const seen = new Set<string>()
          const uniqueLog: LogEntry[] = []
          for (const entry of (stats?.live.log ?? [])) {
            const key = entry.ip ?? `anon-${entry.ts}`
            if (!seen.has(key)) { seen.add(key); uniqueLog.push(entry) }
          }
          return (
            <div style={{ overflowY: 'auto', maxHeight: 360 }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid #1a1a1a' }}>
                    {['Date', 'Time ago', 'Country', 'IP', 'Gender', 'Duration', 'Interests'].map(h => (
                      <th key={h} className="text-left px-5 py-2 text-xs font-semibold"
                        style={{ color: '#333', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {uniqueLog.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-5 py-6 text-xs text-center" style={{ color: '#333' }}>
                        No connections yet — will fill up as users join
                      </td>
                    </tr>
                  )}
                  {uniqueLog.map((entry, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #141414' }}
                      className="transition-colors hover:bg-white/[0.02]">
                      <td className="px-5 py-2.5 text-xs tabular-nums" style={{ color: '#444', whiteSpace: 'nowrap' }}>
                        {fmtDate(entry.ts)}
                      </td>
                      <td className="px-5 py-2.5 text-xs tabular-nums" style={{ color: '#555', whiteSpace: 'nowrap' }}>
                        {void tick}{timeAgo(entry.ts)}
                      </td>
                      <td className="px-5 py-2.5 text-xs" style={{ whiteSpace: 'nowrap' }}>
                        <span className="mr-1.5">{countryFlag(entry.country)}</span>
                        <span style={{ color: '#666' }}>{entry.country ?? '—'}</span>
                      </td>
                      <td className="px-5 py-2.5 text-xs font-mono" style={{ color: '#555' }}>
                        {entry.ip ?? '—'}
                      </td>
                      <td className="px-5 py-2.5 text-xs" style={{ color: '#555' }}>
                        {entry.gender ?? '—'}
                      </td>
                      <td className="px-5 py-2.5 text-xs tabular-nums"
                        style={{ color: entry.duration ? '#3beea8' : '#333', whiteSpace: 'nowrap' }}>
                        {fmtDuration(entry.duration)}
                      </td>
                      <td className="px-5 py-2.5 text-xs" style={{ color: '#555' }}>
                        {entry.interests.length > 0 ? entry.interests.join(', ') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        })()}
      </div>

    </div>
  )
}
