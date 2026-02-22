import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { supabaseAdmin } from '@/lib/supabase-admin'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

const PLAN_MINUTES: Record<string, number> = {
  '10min': 10,
  '30min': 30,
  '60min': 60,
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const sig     = req.headers.get('stripe-signature') ?? ''
  const secret  = process.env.STRIPE_WEBHOOK_SECRET!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, secret)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    if (session.payment_status !== 'paid') {
      return NextResponse.json({ received: true })
    }

    const { plan, wantGender, userId } = session.metadata ?? {}
    const minutes = PLAN_MINUTES[plan] ?? 30
    const expiresAt = new Date(Date.now() + minutes * 60 * 1000).toISOString()

    await supabaseAdmin.from('boost_sessions').insert({
      stripe_session_id: session.id,
      user_id:           userId ?? null,
      want_gender:       wantGender,
      plan,
      expires_at:        expiresAt,
    })
  }

  return NextResponse.json({ received: true })
}

// Disable body parsing — Stripe needs the raw body for signature verification
export const config = { api: { bodyParser: false } }
