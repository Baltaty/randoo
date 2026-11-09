// Supabase REST persistence — all calls are best-effort and never throw.

export type Gender = 'M' | 'F' | 'O'

export interface LogEntry {
  ts:          number
  ip?:         string
  country?:    string
  gender?:     string
  interests:   string[]
  referrer?:   string
  device_type?: string
  os?:         string
  screen?:     string
  matchedAt?:  number   // epoch ms when the current conversation started
  duration?:   number   // total seconds of conversation during this visit
  matches?:    number   // conversations during this visit
  supabaseId?: string   // uuid of the row in connection_logs
}

async function sbFetch(path: string, init: RequestInit = {}): Promise<Response | null> {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  try {
    return await fetch(`${url}/rest/v1/${path}`, {
      ...init,
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    })
  } catch {
    return null
  }
}

export async function verifyBoostToken(token: string): Promise<{ wantGender: Gender; expiresAt: number } | null> {
  if (!token) return null
  const res = await sbFetch(
    `boost_sessions?session_token=eq.${encodeURIComponent(token)}&select=want_gender,expires_at&limit=1`,
  )
  if (!res?.ok) return null
  try {
    const rows = await res.json() as Array<{ want_gender: string; expires_at: string }>
    const row = rows[0]
    if (!row) return null
    const expiresAt = new Date(row.expires_at).getTime()
    if (!(expiresAt > Date.now())) return null
    if (row.want_gender !== 'M' && row.want_gender !== 'F' && row.want_gender !== 'O') return null
    return { wantGender: row.want_gender, expiresAt }
  } catch {
    return null
  }
}

export async function sbInsertLog(entry: LogEntry): Promise<void> {
  const res = await sbFetch('connection_logs', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      ts:          entry.ts,
      ip:          entry.ip          ?? null,
      country:     entry.country     ?? null,
      gender:      entry.gender      ?? null,
      interests:   entry.interests,
      referrer:    entry.referrer    ?? null,
      device_type: entry.device_type ?? null,
      os:          entry.os          ?? null,
      screen:      entry.screen      ?? null,
    }),
  })
  if (!res?.ok) return
  try {
    const rows = await res.json() as Array<{ id: string }>
    if (rows[0]) entry.supabaseId = rows[0].id
  } catch { /* ignore — in-memory log is the fallback */ }
}

// Update the visit row (one per socket connection). Falls back to `duration`
// only if the `matches` column doesn't exist yet (migration not applied).
export async function sbUpdateVisit(entry: LogEntry): Promise<void> {
  if (!entry.supabaseId) return
  const path = `connection_logs?id=eq.${encodeURIComponent(entry.supabaseId)}`
  const res = await sbFetch(path, {
    method: 'PATCH',
    body: JSON.stringify({ duration: entry.duration ?? 0, matches: entry.matches ?? 0 }),
  })
  if (res && res.status === 400) {
    await sbFetch(path, { method: 'PATCH', body: JSON.stringify({ duration: entry.duration ?? 0 }) })
  }
}

// ── matches (one row per conversation) — no-ops if the table doesn't exist yet ──

export interface MatchRow {
  room_id:     string
  started_at?: string
  ended_at?:   string
  duration?:   number
  connected?:  boolean
  relay?:      boolean
  setup_ms?:   number
  wait_ms_a?:  number
  wait_ms_b?:  number
  country_a?:  string | null
  country_b?:  string | null
}

export async function sbInsertMatch(row: MatchRow): Promise<void> {
  await sbFetch('matches', { method: 'POST', body: JSON.stringify(row) })
}

export async function sbUpdateMatch(roomId: string, patch: Partial<MatchRow>): Promise<void> {
  await sbFetch(`matches?room_id=eq.${encodeURIComponent(roomId)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
}

export async function sbInsertReport(reporterIp: string | undefined, roomId: string, reason: string): Promise<void> {
  await sbFetch('reports', {
    method: 'POST',
    body: JSON.stringify({
      ts:          Date.now(),
      reporter_ip: reporterIp ?? null,
      room_id:     roomId,
      reason,
    }),
  })
}
