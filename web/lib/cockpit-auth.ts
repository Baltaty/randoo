// Cockpit session: the cookie holds a signed, expiring token — never the password.
// token = "<expiresAtMs>.<hex HMAC-SHA256(COCKPIT_PASSWORD, 'cockpit:' + expiresAtMs)>"
// Changing COCKPIT_PASSWORD invalidates every session.
import { createHmac, timingSafeEqual } from 'crypto'

export const COCKPIT_COOKIE = 'cockpit_session'
export const COCKPIT_SESSION_MS = 30 * 24 * 3600e3

function sign(expiresAt: number, secret: string): string {
  return createHmac('sha256', secret).update(`cockpit:${expiresAt}`).digest('hex')
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  return ba.length === bb.length && timingSafeEqual(ba, bb)
}

export function checkPassword(password: unknown): boolean {
  const correct = process.env.COCKPIT_PASSWORD
  return !!correct && typeof password === 'string' && safeEqual(password, correct)
}

export function createSessionToken(): string {
  const secret = process.env.COCKPIT_PASSWORD
  if (!secret) throw new Error('COCKPIT_PASSWORD not set')
  const expiresAt = Date.now() + COCKPIT_SESSION_MS
  return `${expiresAt}.${sign(expiresAt, secret)}`
}

export function verifySessionToken(token: string | undefined): boolean {
  const secret = process.env.COCKPIT_PASSWORD
  if (!secret || !token) return false
  const [expStr, sig] = token.split('.')
  const expiresAt = Number(expStr)
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now() || !sig) return false
  return safeEqual(sig, sign(expiresAt, secret))
}

// ── Login rate limit (per server instance, best effort) ──
const attempts = new Map<string, { count: number; resetAt: number }>()
const MAX_ATTEMPTS = 8
const WINDOW_MS = 15 * 60e3

export function loginAllowed(ip: string): boolean {
  const now = Date.now()
  const a = attempts.get(ip)
  if (!a || a.resetAt < now) return true
  return a.count < MAX_ATTEMPTS
}

export function recordFailedLogin(ip: string) {
  const now = Date.now()
  const a = attempts.get(ip)
  if (!a || a.resetAt < now) attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS })
  else a.count++
  if (attempts.size > 5000) attempts.clear()
}
