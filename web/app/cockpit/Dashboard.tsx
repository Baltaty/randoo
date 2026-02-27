'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface Stats {
  live:    { online: number; queue: number; rooms: number }
  today:   { signups: number; revenue: number; boosts: number }
  alltime: { users: number; revenue: number; boosts: number }
}

function fmt(n: number) {
  return n.toLocaleString('en-US')
}

function fmtMoney(n: number) {
  return '$' + n.toFixed(2)
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

export default function Dashboard() {
  const router  = useRouter()
  const [stats, setStats]     = useState<Stats | null>(null)
  const [error, setError]     = useState('')
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [tick, setTick]       = useState(0) // drives "X sec ago" re-render

  const fetchStats = useCallback(async () => {
    const res = await fetch('/api/cockpit/stats')
    if (res.status === 401) { router.refresh(); return }
    if (!res.ok) { setError('Failed to fetch stats'); return }
    setStats(await res.json())
    setLastUpdate(new Date())
    setError('')
  }, [router])

  // Poll every 5s
  useEffect(() => {
    fetchStats()
    const id = setInterval(fetchStats, 5000)
    return () => clearInterval(id)
  }, [fetchStats])

  // "X sec ago" ticker
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

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
            {/* suppress tick warning — it drives re-render */}
            {void tick}
            Updated {lastStr}
          </span>
          <button
            onClick={fetchStats}
            className="text-xs px-3 py-1.5 rounded-lg transition-all hover:opacity-70"
            style={{ background: '#1a1a1a', color: '#666', border: '1px solid #272727' }}
          >
            Refresh
          </button>
          <button
            onClick={logout}
            className="text-xs px-3 py-1.5 rounded-lg transition-all hover:opacity-70"
            style={{ background: '#1a1a1a', color: '#666', border: '1px solid #272727' }}
          >
            Logout
          </button>
        </div>
      </div>

      {error && (
        <p className="text-sm mb-6 px-4 py-3 rounded-xl" style={{ background: '#1a0a0a', color: '#f02031', border: '1px solid #2a1010' }}>
          {error}
        </p>
      )}

      {/* 3-column grid */}
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>

        {/* Live */}
        <Card title="Live" dot="#3beea8">
          <StatRow label="Online"       value={stats ? fmt(stats.live.online) : '…'} accent="#3beea8" />
          <StatRow label="In queue"     value={stats ? fmt(stats.live.queue)  : '…'} />
          <StatRow label="Active chats" value={stats ? fmt(stats.live.rooms)  : '…'} />
        </Card>

        {/* Today */}
        <Card title="Today">
          <StatRow label="New signups" value={stats ? `+${fmt(stats.today.signups)}` : '…'} accent="#ffd53a" />
          <StatRow label="Revenue"     value={stats ? fmtMoney(stats.today.revenue)  : '…'} accent="#ffd53a" />
          <StatRow label="Boosts sold" value={stats ? fmt(stats.today.boosts)        : '…'} />
        </Card>

        {/* All time */}
        <Card title="All time">
          <StatRow label="Total users"   value={stats ? fmt(stats.alltime.users)         : '…'} />
          <StatRow label="Total revenue" value={stats ? fmtMoney(stats.alltime.revenue)  : '…'} accent="#ff66b3" />
          <StatRow label="Total boosts"  value={stats ? fmt(stats.alltime.boosts)        : '…'} />
        </Card>

      </div>

      {/* Boost breakdown */}
      {stats && stats.alltime.boosts > 0 && (
        <div className="mt-4 rounded-2xl p-5" style={{ background: '#111', border: '1px solid #1e1e1e' }}>
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#444' }}>
            Revenue breakdown (all time)
          </span>
          <div className="mt-2 flex gap-6 flex-wrap">
            {[
              { label: '10 min — $2.99', key: '10min' },
              { label: '30 min — $7.99', key: '30min' },
              { label: '1h     — $14.99', key: '60min' },
            ].map(({ label }) => (
              <span key={label} className="text-xs" style={{ color: '#555' }}>{label}</span>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}
