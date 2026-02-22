import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('session_id')
  if (!sessionId) return NextResponse.json({ error: 'Missing session_id' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('boost_sessions')
    .select('session_token, want_gender, expires_at')
    .eq('stripe_session_id', sessionId)
    .single()

  if (error || !data) return NextResponse.json({ ready: false }, { status: 202 })

  // Check not expired
  if (new Date(data.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Boost expired' }, { status: 410 })
  }

  return NextResponse.json({
    ready:      true,
    token:      data.session_token,
    wantGender: data.want_gender,
    expiresAt:  data.expires_at,
  })
}
