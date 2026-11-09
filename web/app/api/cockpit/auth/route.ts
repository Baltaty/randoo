import { NextRequest, NextResponse } from 'next/server'
import {
  COCKPIT_COOKIE, COCKPIT_SESSION_MS,
  checkPassword, createSessionToken, loginAllowed, recordFailedLogin,
} from '@/lib/cockpit-auth'

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
  if (!loginAllowed(ip)) {
    return NextResponse.json({ error: 'Too many attempts' }, { status: 429 })
  }

  let password: unknown
  try { ({ password } = await req.json()) } catch { /* invalid body */ }

  if (!checkPassword(password)) {
    recordFailedLogin(ip)
    // Small constant delay slows down brute force
    await new Promise(r => setTimeout(r, 400))
    return NextResponse.json({ error: 'Wrong password' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set(COCKPIT_COOKIE, createSessionToken(), {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    maxAge:   COCKPIT_SESSION_MS / 1000,
    path:     '/',
    sameSite: 'strict',
  })
  // Remove the legacy cookie that stored the password in clear
  res.cookies.set('cockpit_pass', '', { maxAge: 0, path: '/' })
  return res
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(COCKPIT_COOKIE, '', { maxAge: 0, path: '/' })
  res.cookies.set('cockpit_pass', '', { maxAge: 0, path: '/' })
  return res
}
