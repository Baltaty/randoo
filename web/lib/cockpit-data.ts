// Server-side helpers for the cockpit API (time ranges in Europe/Paris, IP masking).

export const COCKPIT_TZ = 'Europe/Paris'

export type RangeKey = 'today' | '7d' | '30d' | 'all'
export const RANGE_KEYS: RangeKey[] = ['today', '7d', '30d', 'all']

export interface ResolvedRange {
  from:    Date
  to:      Date
  bucket:  'hour' | 'day' | 'week'
  prev:    { from: Date; to: Date } | null
}

/** Offset (ms) of `tz` vs UTC at instant `date` — positive east of Greenwich. */
export function tzOffsetMs(date: Date, tz = COCKPIT_TZ): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(date)
  const get = (t: string) => Number(parts.find(p => p.type === t)?.value)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return asUtc - Math.floor(date.getTime() / 1000) * 1000
}

/** UTC instant of local midnight in `tz`, `daysAgo` days before today. */
export function startOfDay(daysAgo: number, now = new Date(), tz = COCKPIT_TZ): Date {
  const local = new Date(now.getTime() + tzOffsetMs(now, tz)) // UTC fields = local wall time
  const midnightWall = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - daysAgo)
  // First guess with today's offset, then correct for a DST change in between
  const guess = midnightWall - tzOffsetMs(now, tz)
  return new Date(midnightWall - tzOffsetMs(new Date(guess), tz))
}

export function resolveRange(key: RangeKey, now = new Date()): ResolvedRange {
  const DAY = 24 * 3600e3
  switch (key) {
    case 'today':
      // Compared with yesterday at the same time of day
      return {
        from: startOfDay(0, now), to: now, bucket: 'hour',
        prev: { from: startOfDay(1, now), to: new Date(now.getTime() - DAY) },
      }
    case '7d':
      return {
        from: startOfDay(6, now), to: now, bucket: 'day',
        prev: { from: startOfDay(13, now), to: new Date(now.getTime() - 7 * DAY) },
      }
    case '30d':
      return {
        from: startOfDay(29, now), to: now, bucket: 'day',
        prev: { from: startOfDay(59, now), to: new Date(now.getTime() - 30 * DAY) },
      }
    case 'all':
    default:
      return { from: new Date('2024-01-01T00:00:00Z'), to: now, bucket: 'week', prev: null }
  }
}

/** 203.0.113.42 → 203.0.•.• · 2001:db8:85a3::1 → 2001:db8:•  (GDPR — never show full IPs) */
export function maskIp(ip: string | null | undefined): string | null {
  if (!ip) return null
  if (ip.includes('.') && !ip.includes(':')) {
    const p = ip.split('.')
    return p.length === 4 ? `${p[0]}.${p[1]}.•.•` : '•'
  }
  const groups = ip.split(':').filter(Boolean)
  return groups.length >= 2 ? `${groups[0]}:${groups[1]}:•` : '•'
}

export function referrerHost(referrer: string | null | undefined): string {
  if (!referrer) return 'direct'
  try { return new URL(referrer).hostname.replace(/^www\./, '') } catch { return referrer.slice(0, 40) }
}
