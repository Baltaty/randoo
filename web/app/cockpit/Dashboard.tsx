'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { BarChart, BarPoint, RankedBars, RankItem, Sparkline } from './charts'

// WebGL globe — only loaded when the user opens it
const LiveGlobe = dynamic(() => import('./LiveGlobe'), { ssr: false })

// ── Types (mirror /api/cockpit/*) ────────────────────────────

type RangeKey = 'today' | '7d' | '30d' | 'all'
type Bucket = 'hour' | 'day' | 'week'

interface Live {
  serverOk: boolean
  error?:   string
  online?:  number
  queue?:   number
  rooms?:   number
  turn?:    'ok' | 'not_configured' | 'error' | 'pending' | 'unknown'
  uptime?:  number | null
  lastHour?: {
    matches: number; medianWaitMs: number | null
    callsReported: number; callsConnected: number; callsRelay: number; medianSetupMs: number | null
  } | null
  history?: Array<{ ts: number; online: number; queue: number; rooms: number }>
}

interface KeyCount { key: string; count: number }

interface Business {
  revenue: number; boosts: number; buyers: number; signups: number
  plans?: Record<string, { count: number; revenue: number }>
}
interface Calls {
  matches: number; reported: number; connected: number; relay: number
  medianDuration: number | null; avgDuration: number | null; shortSkips: number; ended: number
  medianSetupMs: number | null; medianWaitMs: number | null
}
interface StatsPayload {
  business: Business
  totals:   { users: number; payingUsers: number; revenue: number }
  audience: {
    visits: number; uniqueVisitors: number; returningCount: number
    countries: KeyCount[]; genders: KeyCount[]; devices: KeyCount[]; os: KeyCount[]
    referrers: KeyCount[]; interests: KeyCount[]
    returning: Array<{ ip: string | null; days: number; visits: number; country: string | null }>
  }
  calls:   Calls
  reports: { total: number; byReason: KeyCount[]; latest: Array<{ ts: number; reason: string; roomId: string }> }
  series:  Array<{ t: string; revenue: number; signups: number; visits: number; matches: number }>
}
interface StatsResponse {
  migrationMissing?: boolean
  error?: string
  range?: { key: RangeKey; from: string; to: string; bucket: Bucket }
  current?: StatsPayload
  previous?: {
    business: Business
    audience: { visits: number; uniqueVisitors: number }
    calls: Calls
    reports: { total: number }
  } | null
}
interface VisitRow {
  ts: number; ip: string | null; country: string | null; gender: string | null; interests: string[]
  duration: number | null; matches: number | null; source: string; device: string | null; os: string | null
}
interface VisitsResponse { page: number; total: number | null; hasMore: boolean; rows: VisitRow[] }

// ── Formatting (fr-FR, Europe/Paris) ─────────────────────────

const TZ = 'Europe/Paris'
const nf = new Intl.NumberFormat('fr-FR')
const money = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'USD' })
const fmtInt = (n: number | null | undefined) => (n === null || n === undefined ? '—' : nf.format(Math.round(n)))
const fmtPct = (num: number, den: number) => (den > 0 ? `${Math.round((num / den) * 100)} %` : '—')
function fmtSecs(s: number | null | undefined) {
  if (s === null || s === undefined) return '—'
  const v = Math.round(s)
  if (v < 60) return `${v} s`
  const m = Math.floor(v / 60)
  if (m < 60) return `${m} min ${String(v % 60).padStart(2, '0')}`
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`
}
function fmtMs(ms: number | null | undefined) {
  if (ms === null || ms === undefined) return '—'
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} s`
}
function fmtDateTime(ts: number) {
  return new Date(ts).toLocaleString('fr-FR', { timeZone: TZ, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}
function bucketLabel(iso: string, bucket: Bucket) {
  const d = new Date(iso)
  if (bucket === 'hour') return d.toLocaleTimeString('fr-FR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })
  const day = d.toLocaleDateString('fr-FR', { timeZone: TZ, day: 'numeric', month: 'short' })
  return bucket === 'week' ? `sem. ${day}` : d.toLocaleDateString('fr-FR', { timeZone: TZ, weekday: 'short' }) + ' ' + day
}
function timeAgo(ts: number) {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000))
  if (s < 10) return "à l'instant"
  if (s < 60) return `il y a ${s} s`
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`
  return `il y a ${Math.floor(s / 86400)} j`
}
function countryName(code: string) {
  try { return new Intl.DisplayNames(['fr'], { type: 'region' }).of(code) ?? code } catch { return code }
}
function flag(code?: string | null) {
  if (!code || code.length !== 2) return '🌐'
  return code.toUpperCase().split('').map(c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)).join('')
}

const RANGE_LABELS: Record<RangeKey, string> = { today: "Aujourd'hui", '7d': '7 jours', '30d': '30 jours', all: 'Tout' }
const PREV_LABELS: Record<RangeKey, string> = {
  today: 'vs hier à la même heure', '7d': 'vs 7 jours précédents', '30d': 'vs 30 jours précédents', all: '',
}
const GENDER_LABELS: Record<string, string> = { M: 'Homme', F: 'Femme', O: 'Autre', '?': 'Non renseigné' }
const DEVICE_LABELS: Record<string, string> = { mobile: 'Mobile', desktop: 'Ordinateur', tablet: 'Tablette', '?': 'Inconnu' }
const REASON_LABELS: Record<string, string> = {
  nudity: 'Nudité / sexuel', spam: 'Spam / bot', harassment: 'Harcèlement', underage: 'Mineur suspecté', other: 'Autre',
}
const PLAN_LABELS: Record<string, string> = { '10min': '10 min', '30min': '30 min', '60min': '1 h' }
const TURN_LABELS: Record<string, { label: string; ok: boolean | null }> = {
  ok:             { label: 'TURN actif', ok: true },
  not_configured: { label: 'TURN non configuré', ok: false },
  error:          { label: 'TURN en erreur', ok: false },
  pending:        { label: 'TURN en attente', ok: null },
  unknown:        { label: 'TURN inconnu', ok: null },
}

const toRank = (items: KeyCount[] | undefined, labels?: Record<string, string>): RankItem[] =>
  (items ?? []).map(i => ({ key: i.key, label: labels?.[i.key] ?? i.key, count: i.count }))

// ── Building blocks ──────────────────────────────────────────

function Panel({ title, hint, children, className = '' }: {
  title: string; hint?: string; children: React.ReactNode; className?: string
}) {
  return (
    <section className={`rounded-2xl p-5 ${className}`}
      style={{ background: 'var(--theme-surface-solid)', border: '1px solid var(--theme-border)' }}>
      <header className="flex items-baseline justify-between gap-3 mb-4">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--theme-text)' }}>{title}</h3>
        {hint && <span className="text-xs text-right" style={{ color: 'var(--theme-text-muted)' }}>{hint}</span>}
      </header>
      {children}
    </section>
  )
}

function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 mt-10 mb-3">
      <h2 className="text-lg font-bold" style={{ color: 'var(--theme-text)', letterSpacing: '-0.3px' }}>{title}</h2>
      {hint && <span className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>{hint}</span>}
    </div>
  )
}

/** Change vs previous period. `better` = which direction is good. */
function Delta({ cur, prev, better = 'up' }: { cur: number; prev: number | null | undefined; better?: 'up' | 'down' }) {
  if (prev === null || prev === undefined) return null
  if (prev === 0 && cur === 0) return <span style={{ color: 'var(--theme-text-muted)' }}>= stable</span>
  if (prev === 0) return <span style={{ color: 'var(--theme-text-muted)' }}>nouveau</span>
  const change = (cur - prev) / prev
  const rounded = Math.round(change * 100)
  if (rounded === 0) return <span style={{ color: 'var(--theme-text-muted)' }}>= stable</span>
  const good = (rounded > 0) === (better === 'up')
  return (
    <span style={{ color: good ? 'var(--color-success)' : 'var(--color-error)' }}>
      {rounded > 0 ? '▲' : '▼'} {Math.abs(rounded)} %
    </span>
  )
}

function Tile({ label, value, sub, title }: { label: string; value: string; sub?: React.ReactNode; title?: string }) {
  return (
    <div className="rounded-2xl px-4 py-3.5" title={title}
      style={{ background: 'var(--theme-surface-solid)', border: '1px solid var(--theme-border)' }}>
      <div className="text-xs mb-1.5" style={{ color: 'var(--theme-text-muted)' }}>{label}</div>
      <div className="text-2xl font-bold tabular-nums leading-tight" style={{ color: 'var(--theme-text)' }}>{value}</div>
      {sub !== undefined && <div className="text-xs mt-1 tabular-nums" style={{ color: 'var(--theme-text-muted)' }}>{sub}</div>}
    </div>
  )
}

function StatusPill({ ok, label }: { ok: boolean | null; label: string }) {
  const color = ok === null ? 'var(--color-warning)' : ok ? 'var(--color-success)' : 'var(--color-error)'
  return (
    <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full whitespace-nowrap"
      style={{ border: '1px solid var(--theme-border)', color: 'var(--theme-text)' }}>
      <span className="w-2 h-2 rounded-full" style={{ background: color }} aria-hidden />
      {label}
    </span>
  )
}

const tileGrid = 'grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-6'
const btnStyle = { background: 'var(--theme-surface)', color: 'var(--theme-text)', border: '1px solid var(--theme-border)' }

// ── Dashboard ────────────────────────────────────────────────

export default function Dashboard() {
  const router = useRouter()
  const [range, setRange] = useState<RangeKey>('today')
  const [live, setLive] = useState<Live | null>(null)
  const [stats, setStats] = useState<StatsResponse | null>(null)
  const [statsLoading, setStatsLoading] = useState(false)
  const [visits, setVisits] = useState<VisitsResponse | null>(null)
  const [visitsPage, setVisitsPage] = useState(0)
  const [showGlobe, setShowGlobe] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<number | null>(null)
  const [, setTick] = useState(0)

  const getJson = useCallback(async <T,>(url: string): Promise<T | null> => {
    try {
      const res = await fetch(url, { cache: 'no-store' })
      if (res.status === 401) { router.refresh(); return null }
      return await res.json() as T
    } catch {
      return null
    }
  }, [router])

  const loadLive = useCallback(async () => {
    const d = await getJson<Live>('/api/cockpit/live')
    setLive(d ?? { serverOk: false, error: 'cockpit API unreachable' })
    setLastUpdate(Date.now())
  }, [getJson])

  const loadStats = useCallback(async (r: RangeKey) => {
    setStatsLoading(true)
    const d = await getJson<StatsResponse>(`/api/cockpit/stats?range=${r}`)
    if (d) setStats(d)
    setStatsLoading(false)
  }, [getJson])

  const loadVisits = useCallback(async (page: number) => {
    const d = await getJson<VisitsResponse>(`/api/cockpit/visits?page=${page}`)
    if (d && Array.isArray(d.rows)) setVisits(d)
  }, [getJson])

  // Live: every 5 s
  useEffect(() => {
    const first = setTimeout(loadLive, 0)
    const id = setInterval(loadLive, 5000)
    return () => { clearTimeout(first); clearInterval(id) }
  }, [loadLive])

  // Period stats: on range change + every 60 s
  useEffect(() => {
    const first = setTimeout(() => loadStats(range), 0)
    const id = setInterval(() => loadStats(range), 60_000)
    return () => { clearTimeout(first); clearInterval(id) }
  }, [range, loadStats])

  // Visits: on page change + every 60 s (first page only)
  useEffect(() => {
    const first = setTimeout(() => loadVisits(visitsPage), 0)
    const id = visitsPage === 0 ? setInterval(() => loadVisits(0), 60_000) : undefined
    return () => { clearTimeout(first); if (id) clearInterval(id) }
  }, [visitsPage, loadVisits])

  // Re-render relative times
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  async function logout() {
    await fetch('/api/cockpit/auth', { method: 'DELETE' })
    router.refresh()
  }

  const cur = stats?.current
  const prev = stats?.previous ?? null
  const bucket: Bucket = stats?.range?.bucket ?? 'hour'

  const series = useMemo(() => {
    const s = cur?.series ?? []
    const mk = (pick: (x: StatsPayload['series'][number]) => number, fmt: (v: number) => string): BarPoint[] =>
      s.map(x => ({ label: bucketLabel(x.t, bucket), value: pick(x), display: fmt(pick(x)) }))
    return {
      revenue: mk(x => x.revenue, v => money.format(v)),
      signups: mk(x => x.signups, v => `${fmtInt(v)} inscription${v > 1 ? 's' : ''}`),
      visits:  mk(x => x.visits, v => `${fmtInt(v)} visite${v > 1 ? 's' : ''}`),
      matches: mk(x => x.matches, v => `${fmtInt(v)} conversation${v > 1 ? 's' : ''}`),
    }
  }, [cur, bucket])

  const onlineLine = useMemo(() => (live?.history ?? []).map(h => ({
    ts: h.ts, value: h.online,
    label: new Date(h.ts).toLocaleTimeString('fr-FR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }),
  })), [live])

  const lh = live?.lastHour
  const turn = TURN_LABELS[live?.turn ?? 'unknown'] ?? TURN_LABELS.unknown
  const updatedAgo = lastUpdate ? timeAgo(lastUpdate) : '…'
  const liveVal = (n: number | undefined) => (live?.serverOk ? fmtInt(n) : '—')
  const calls = cur?.calls
  const business = cur?.business

  return (
    <div className="min-h-screen px-4 py-6 md:px-8" style={{ background: 'var(--theme-bg)', color: 'var(--theme-text)' }}>
      <div className="max-w-7xl mx-auto">

        {/* ── Header ── */}
        <header className="flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-2.5">
            <svg width="18" height="22" viewBox="0 0 44 52" fill="none" aria-hidden>
              <path d="M 10 18 C 10 8 34 8 34 18 C 34 26 24 28 22 32"
                stroke="var(--color-brand-primary)" strokeWidth="9" strokeLinecap="round"/>
              <circle cx="22" cy="46" r="5" fill="var(--color-brand-primary)"/>
            </svg>
            <span className="font-bold text-lg" style={{ letterSpacing: '-0.5px' }}>cockpit</span>
            <StatusPill ok={live ? live.serverOk : null} label={live ? (live.serverOk ? 'Serveur en ligne' : 'Serveur injoignable') : 'Serveur…'} />
            <StatusPill ok={live?.serverOk ? turn.ok : null} label={turn.label} />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>Mis à jour {updatedAgo}</span>
            <button onClick={() => { loadLive(); loadStats(range); loadVisits(visitsPage) }}
              className="text-xs px-3 py-1.5 rounded-lg hover:opacity-70" style={btnStyle}>Rafraîchir</button>
            <button onClick={logout} className="text-xs px-3 py-1.5 rounded-lg hover:opacity-70" style={btnStyle}>Déconnexion</button>
          </div>
        </header>

        {/* ── Live ── */}
        <SectionTitle title="En direct" hint="rafraîchi toutes les 5 s · stats sur la dernière heure" />
        {live && !live.serverOk && (
          <p className="text-sm mb-3 px-4 py-3 rounded-xl" style={{ border: '1px solid var(--color-error)', color: 'var(--theme-text)' }}>
            ⚠ Le serveur temps réel (Railway) ne répond pas — les chiffres en direct sont indisponibles.
          </p>
        )}
        <div className={tileGrid}>
          <Tile label="En ligne" value={liveVal(live?.online)} />
          <Tile label="En file d'attente" value={liveVal(live?.queue)} />
          <Tile label="Conversations actives" value={liveVal(live?.rooms)} />
          <Tile label="Attente médiane" value={live?.serverOk ? fmtMs(lh?.medianWaitMs) : '—'}
            sub={lh ? `${fmtInt(lh.matches)} matchs / h` : undefined} />
          <Tile label="Appels connectés" value={live?.serverOk && lh ? fmtPct(lh.callsConnected, lh.callsReported) : '—'}
            sub={lh ? `${fmtInt(lh.callsConnected)} / ${fmtInt(lh.callsReported)} signalés` : undefined}
            title="Part des conversations où la vidéo s'est réellement établie (WebRTC)" />
          <Tile label="Via TURN" value={live?.serverOk && lh ? fmtPct(lh.callsRelay, lh.callsConnected) : '—'}
            sub={lh?.medianSetupMs ? `connexion en ${fmtMs(lh.medianSetupMs)}` : undefined}
            title="Part des appels connectés qui passent par le relais Cloudflare TURN" />
        </div>
        <Panel title="Utilisateurs en ligne" hint="dernière heure, un point par minute" className="mt-3">
          <Sparkline points={onlineLine} format={v => `${fmtInt(v)} en ligne`} />
        </Panel>

        {/* ── Period selector ── */}
        <div className="sticky top-0 z-20 mt-10 py-3 flex flex-wrap items-center gap-3 justify-between"
          style={{ background: 'var(--theme-bg)' }}>
          <div className="inline-flex rounded-xl p-1" role="tablist" aria-label="Période"
            style={{ background: 'var(--theme-surface)', border: '1px solid var(--theme-border)' }}>
            {(Object.keys(RANGE_LABELS) as RangeKey[]).map(k => (
              <button key={k} role="tab" aria-selected={range === k} onClick={() => setRange(k)}
                className="text-sm px-3.5 py-1.5 rounded-lg font-semibold transition-all"
                style={range === k
                  ? { background: 'var(--theme-accent)', color: 'var(--theme-btn-fg)' }
                  : { color: 'var(--theme-text-muted)' }}>
                {RANGE_LABELS[k]}
              </button>
            ))}
          </div>
          <span className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
            {statsLoading ? 'Chargement…' : `Heure de Paris${PREV_LABELS[range] ? ` · variations ${PREV_LABELS[range]}` : ''}`}
          </span>
        </div>

        {stats?.migrationMissing && (
          <div className="text-sm px-4 py-3 rounded-xl" style={{ border: '1px solid var(--color-warning)' }}>
            <strong>Migration SQL non appliquée.</strong> Exécute <code>supabase/2026-11-09_cockpit.sql</code> dans
            l&apos;éditeur SQL de Supabase pour activer les statistiques par période.
          </div>
        )}
        {stats?.error && !stats.migrationMissing && (
          <p className="text-sm px-4 py-3 rounded-xl" style={{ border: '1px solid var(--color-error)' }}>
            Erreur de chargement des statistiques : {stats.error}
          </p>
        )}

        {cur && business && calls && (
          <>
            {/* ── Business ── */}
            <SectionTitle title="Business" />
            <div className={tileGrid}>
              <Tile label="Chiffre d'affaires" value={money.format(business.revenue)}
                sub={<Delta cur={business.revenue} prev={prev?.business.revenue} />} />
              <Tile label="Boosts vendus" value={fmtInt(business.boosts)}
                sub={<Delta cur={business.boosts} prev={prev?.business.boosts} />} />
              <Tile label="Acheteurs" value={fmtInt(business.buyers)}
                sub={<Delta cur={business.buyers} prev={prev?.business.buyers} />} />
              <Tile label="Inscriptions" value={fmtInt(business.signups)}
                sub={<Delta cur={business.signups} prev={prev?.business.signups} />} />
              <Tile label="Comptes payants" value={fmtPct(cur.totals.payingUsers, cur.totals.users)}
                sub={`${fmtInt(cur.totals.payingUsers)} / ${fmtInt(cur.totals.users)} comptes`}
                title="Part des comptes ayant acheté au moins un boost (depuis le début)" />
              <Tile label="CA total" value={money.format(cur.totals.revenue)} sub="depuis le début" />
            </div>
            <div className="grid gap-3 mt-3 lg:grid-cols-3">
              <Panel title="Chiffre d'affaires" hint={bucket === 'hour' ? 'par heure' : bucket === 'day' ? 'par jour' : 'par semaine'} className="lg:col-span-2">
                <BarChart points={series.revenue} emptyText="Aucune vente sur la période" />
              </Panel>
              <Panel title="Boosts par formule">
                <RankedBars
                  items={Object.entries(business.plans ?? {}).map(([k, v]) => ({
                    key: k, label: `${PLAN_LABELS[k] ?? k} · ${money.format(v.revenue)}`, count: v.count,
                  })).sort((a, b) => b.count - a.count)}
                  emptyText="Aucun boost sur la période" />
              </Panel>
            </div>
            <Panel title="Inscriptions" className="mt-3">
              <BarChart points={series.signups} height={120} emptyText="Aucune inscription sur la période" />
            </Panel>

            {/* ── Call quality ── */}
            <SectionTitle title="Qualité des appels" hint="mesurée depuis le 9 nov. 2026" />
            <div className={tileGrid}>
              <Tile label="Conversations" value={fmtInt(calls.matches)}
                sub={<Delta cur={calls.matches} prev={prev?.calls.matches} />} />
              <Tile label="Taux de connexion" value={fmtPct(calls.connected, calls.reported)}
                sub={`${fmtInt(calls.connected)} / ${fmtInt(calls.reported)} signalés`}
                title="Conversations où la vidéo s'est établie / conversations dont le résultat est connu" />
              <Tile label="Via TURN" value={fmtPct(calls.relay, calls.connected)}
                sub={`${fmtInt(calls.relay)} appels relayés`} />
              <Tile label="Durée médiane" value={fmtSecs(calls.medianDuration)}
                sub={`moyenne ${fmtSecs(calls.avgDuration)}`} />
              <Tile label="Skips < 10 s" value={fmtPct(calls.shortSkips, calls.ended)}
                sub={prev ? <Delta cur={calls.ended ? calls.shortSkips / calls.ended : 0}
                  prev={prev.calls.ended ? prev.calls.shortSkips / prev.calls.ended : null} better="down" /> : undefined}
                title="Conversations terminées en moins de 10 secondes" />
              <Tile label="Attente médiane" value={fmtMs(calls.medianWaitMs)}
                sub={`connexion ${fmtMs(calls.medianSetupMs)}`} />
            </div>
            <Panel title="Conversations" hint={bucket === 'hour' ? 'par heure' : bucket === 'day' ? 'par jour' : 'par semaine'} className="mt-3">
              <BarChart points={series.matches} height={120} emptyText="Aucune conversation enregistrée sur la période" />
            </Panel>

            {/* ── Audience ── */}
            <SectionTitle title="Audience" />
            <div className="grid gap-3 grid-cols-2 md:grid-cols-3">
              <Tile label="Visites" value={fmtInt(cur.audience.visits)}
                sub={<Delta cur={cur.audience.visits} prev={prev?.audience.visits} />} />
              <Tile label="Visiteurs uniques" value={fmtInt(cur.audience.uniqueVisitors)}
                sub={<Delta cur={cur.audience.uniqueVisitors} prev={prev?.audience.uniqueVisitors} />}
                title="Adresses IP distinctes" />
              <Tile label="Visiteurs revenus" value={fmtInt(cur.audience.returningCount)}
                sub={fmtPct(cur.audience.returningCount, cur.audience.uniqueVisitors) + ' des visiteurs'}
                title="IP vues sur au moins 2 jours différents de la période" />
            </div>
            <Panel title="Visites" hint={bucket === 'hour' ? 'par heure' : bucket === 'day' ? 'par jour' : 'par semaine'} className="mt-3">
              <BarChart points={series.visits} height={120} />
            </Panel>
            <div className="grid gap-3 mt-3 md:grid-cols-2 xl:grid-cols-3">
              <Panel title="Pays">
                <RankedBars total={cur.audience.visits}
                  items={cur.audience.countries.map(c => ({ key: c.key, label: `${flag(c.key)} ${countryName(c.key)}`, count: c.count }))} />
              </Panel>
              <Panel title="Sources de trafic">
                <RankedBars total={cur.audience.visits} items={toRank(cur.audience.referrers, { direct: 'Accès direct' })} />
              </Panel>
              <Panel title="Genre déclaré">
                <RankedBars items={toRank(cur.audience.genders, GENDER_LABELS)} />
              </Panel>
              <Panel title="Appareils">
                <RankedBars items={toRank(cur.audience.devices, DEVICE_LABELS)} />
              </Panel>
              <Panel title="Systèmes">
                <RankedBars items={toRank(cur.audience.os, { '?': 'Inconnu' })} />
              </Panel>
              <Panel title="Centres d'intérêt">
                {cur.audience.interests.length === 0
                  ? <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>Aucune donnée</p>
                  : (
                    <div className="flex flex-wrap gap-2">
                      {cur.audience.interests.map(i => (
                        <span key={i.key} className="text-xs px-2.5 py-1 rounded-full"
                          style={{ border: '1px solid var(--theme-border)', color: 'var(--theme-text)' }}>
                          {i.key} <strong className="tabular-nums">{fmtInt(i.count)}</strong>
                        </span>
                      ))}
                    </div>
                  )}
              </Panel>
            </div>

            {/* ── Moderation ── */}
            <SectionTitle title="Modération" />
            <div className="grid gap-3 lg:grid-cols-3">
              <Panel title="Signalements" hint={prev ? undefined : 'sur la période'}>
                <div className="text-3xl font-bold tabular-nums mb-1">{fmtInt(cur.reports.total)}</div>
                <div className="text-xs mb-4" style={{ color: 'var(--theme-text-muted)' }}>
                  <Delta cur={cur.reports.total} prev={prev?.reports.total} better="down" />
                  {calls.matches > 0 && ` · ${fmtPct(cur.reports.total, calls.matches)} des conversations`}
                </div>
                <RankedBars items={toRank(cur.reports.byReason, REASON_LABELS)} emptyText="Aucun signalement 🎉" />
              </Panel>
              <Panel title="Derniers signalements" className="lg:col-span-2">
                {cur.reports.latest.length === 0
                  ? <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>Aucun signalement sur la période</p>
                  : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead><tr style={{ color: 'var(--theme-text-muted)' }}>
                          {['Quand', 'Motif', 'Conversation'].map(h => <th key={h} className="text-left text-xs font-semibold pb-2 pr-4">{h}</th>)}
                        </tr></thead>
                        <tbody>
                          {cur.reports.latest.map(r => (
                            <tr key={`${r.roomId}-${r.ts}`} style={{ borderTop: '1px solid var(--theme-border)' }}>
                              <td className="py-2 pr-4 whitespace-nowrap tabular-nums">{fmtDateTime(r.ts)}</td>
                              <td className="py-2 pr-4">{REASON_LABELS[r.reason] ?? r.reason}</td>
                              <td className="py-2 font-mono text-xs" style={{ color: 'var(--theme-text-muted)' }}>{r.roomId}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
              </Panel>
            </div>

            {/* ── Returning visitors ── */}
            <SectionTitle title="Visiteurs fidèles" hint="IP masquées · vues sur ≥ 2 jours" />
            <Panel title="Top visiteurs revenus">
              {cur.audience.returning.length === 0
                ? <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>Aucun visiteur revenu sur la période</p>
                : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr style={{ color: 'var(--theme-text-muted)' }}>
                        {['IP', 'Pays', 'Jours actifs', 'Visites'].map(h => <th key={h} className="text-left text-xs font-semibold pb-2 pr-4">{h}</th>)}
                      </tr></thead>
                      <tbody>
                        {cur.audience.returning.map((v, i) => (
                          <tr key={i} style={{ borderTop: '1px solid var(--theme-border)' }}>
                            <td className="py-2 pr-4 font-mono text-xs">{v.ip ?? '—'}</td>
                            <td className="py-2 pr-4 whitespace-nowrap">{flag(v.country)} {v.country ? countryName(v.country) : '—'}</td>
                            <td className="py-2 pr-4 tabular-nums font-semibold">{fmtInt(v.days)}</td>
                            <td className="py-2 tabular-nums">{fmtInt(v.visits)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
            </Panel>
          </>
        )}

        {/* ── Recent visits (independent of the period) ── */}
        <SectionTitle title="Visites récentes" hint="IP masquées · une ligne par visite depuis le 9 nov. 2026" />
        <Panel title={visits?.total ? `${fmtInt(visits.total)} visites enregistrées` : 'Visites'}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr style={{ color: 'var(--theme-text-muted)' }}>
                {['Quand', 'Pays', 'IP', 'Genre', 'Conversations', 'Temps de chat', 'Appareil', 'Source', 'Intérêts'].map(h => (
                  <th key={h} className="text-left text-xs font-semibold pb-2 pr-4 whitespace-nowrap">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {(visits?.rows ?? []).length === 0 && (
                  <tr><td colSpan={9} className="py-6 text-center text-xs" style={{ color: 'var(--theme-text-muted)' }}>
                    {visits ? 'Aucune visite' : 'Chargement…'}
                  </td></tr>
                )}
                {(visits?.rows ?? []).map((v, i) => (
                  <tr key={`${v.ts}-${i}`} style={{ borderTop: '1px solid var(--theme-border)' }}>
                    <td className="py-2 pr-4 whitespace-nowrap tabular-nums" title={fmtDateTime(v.ts)}>{timeAgo(v.ts)}</td>
                    <td className="py-2 pr-4 whitespace-nowrap">{flag(v.country)} {v.country ?? '—'}</td>
                    <td className="py-2 pr-4 font-mono text-xs whitespace-nowrap" style={{ color: 'var(--theme-text-muted)' }}>{v.ip ?? '—'}</td>
                    <td className="py-2 pr-4">{v.gender ? (GENDER_LABELS[v.gender] ?? v.gender) : '—'}</td>
                    <td className="py-2 pr-4 tabular-nums">{v.matches ?? '—'}</td>
                    <td className="py-2 pr-4 tabular-nums whitespace-nowrap">{v.duration ? fmtSecs(v.duration) : '—'}</td>
                    <td className="py-2 pr-4 whitespace-nowrap">{[v.device ? DEVICE_LABELS[v.device] ?? v.device : null, v.os].filter(Boolean).join(' · ') || '—'}</td>
                    <td className="py-2 pr-4 whitespace-nowrap">{v.source === 'direct' ? 'Accès direct' : v.source}</td>
                    <td className="py-2 text-xs" style={{ color: 'var(--theme-text-muted)' }}>{v.interests.length ? v.interests.join(', ') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between mt-4">
            <button disabled={visitsPage === 0} onClick={() => setVisitsPage(p => Math.max(0, p - 1))}
              className="text-xs px-3 py-1.5 rounded-lg disabled:opacity-30" style={btnStyle}>← Plus récentes</button>
            <span className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>Page {visitsPage + 1}</span>
            <button disabled={!visits?.hasMore} onClick={() => setVisitsPage(p => p + 1)}
              className="text-xs px-3 py-1.5 rounded-lg disabled:opacity-30" style={btnStyle}>Plus anciennes →</button>
          </div>
        </Panel>

        {/* ── Globe (lazy) ── */}
        <SectionTitle title="Carte des visiteurs" hint="visites de la page affichée ci-dessus" />
        <Panel title="Globe">
          {showGlobe
            ? <div className="overflow-hidden"><LiveGlobe log={(visits?.rows ?? []).map(v => ({ ts: v.ts, country: v.country ?? undefined }))} /></div>
            : (
              <button onClick={() => setShowGlobe(true)} className="text-sm px-4 py-2 rounded-lg" style={btnStyle}>
                Afficher le globe 3D
              </button>
            )}
        </Panel>

        <footer className="mt-10 mb-4 text-xs" style={{ color: 'var(--theme-text-muted)' }}>
          Avant le 9 nov. 2026, une ligne de visite était créée à chaque « Next » : les visites antérieures sont surestimées.
          Conversations, taux de connexion et TURN ne sont mesurés que depuis cette date.
        </footer>
      </div>
    </div>
  )
}
