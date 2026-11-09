// Cloudflare Realtime TURN — short-lived ICE credentials, generated server-side
// so the API token never reaches the browser.
//
// Credentials are cached and shared by all clients, refreshed well before expiry.
// If Cloudflare is not configured or unreachable, returns null and clients fall
// back to their built-in STUN servers.

export interface IceServer {
  urls:        string | string[]
  username?:   string
  credential?: string
}

const CREDENTIAL_TTL_S  = 24 * 3600   // lifetime requested from Cloudflare
const REFRESH_BEFORE_MS = 12 * 3600e3 // refresh once less than this remains
const RETRY_AFTER_MS    = 60e3        // back-off after a failed fetch

let cached: { iceServers: IceServer[]; expiresAt: number } | null = null
let inflight: Promise<void> | null = null
let lastFailureAt = 0

function isConfigured(): boolean {
  return !!process.env.CLOUDFLARE_TURN_KEY_ID && !!process.env.CLOUDFLARE_TURN_API_TOKEN
}

// Browsers time out on port 53 — Cloudflare recommends dropping those URLs
function withoutPort53(servers: IceServer[]): IceServer[] {
  return servers
    .map(s => ({
      ...s,
      urls: (Array.isArray(s.urls) ? s.urls : [s.urls]).filter(u => !/:53(\?|$)/.test(u)),
    }))
    .filter(s => s.urls.length > 0)
}

async function refresh(): Promise<void> {
  const keyId = process.env.CLOUDFLARE_TURN_KEY_ID
  const token = process.env.CLOUDFLARE_TURN_API_TOKEN
  if (!keyId || !token) return
  try {
    const res = await fetch(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(keyId)}/credentials/generate-ice-servers`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ttl: CREDENTIAL_TTL_S }),
        signal: AbortSignal.timeout(5000),
      },
    )
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json() as { iceServers?: IceServer[] }
    if (!Array.isArray(data.iceServers) || !data.iceServers.length) throw new Error('empty iceServers')
    cached = { iceServers: withoutPort53(data.iceServers), expiresAt: Date.now() + CREDENTIAL_TTL_S * 1000 }
    console.log('[turn] Cloudflare TURN credentials refreshed')
  } catch (err) {
    lastFailureAt = Date.now()
    console.warn('[turn] failed to fetch Cloudflare TURN credentials:', (err as Error).message)
  }
}

function refreshInBackground() {
  if (inflight || Date.now() - lastFailureAt < RETRY_AFTER_MS) return
  inflight = refresh().finally(() => { inflight = null })
}

/** Current ICE servers (never blocks; triggers a background refresh when needed). */
export function getIceServers(): IceServer[] | null {
  if (!isConfigured()) return null
  const now = Date.now()
  if (!cached || cached.expiresAt - now < REFRESH_BEFORE_MS) refreshInBackground()
  return cached && cached.expiresAt > now ? cached.iceServers : null
}

export type TurnStatus = 'ok' | 'not_configured' | 'error' | 'pending'

/** TURN health for /health — no secrets exposed. */
export function getTurnStatus(): TurnStatus {
  if (!isConfigured()) return 'not_configured'
  if (cached && cached.expiresAt > Date.now()) return 'ok'
  return lastFailureAt ? 'error' : 'pending'
}

/** Fetch credentials at boot so the first matches already have TURN. */
export async function warmUpTurn(): Promise<void> {
  if (!isConfigured()) {
    console.warn('[turn] CLOUDFLARE_TURN_KEY_ID / CLOUDFLARE_TURN_API_TOKEN not set — STUN only')
    return
  }
  refreshInBackground()
  await inflight
}
