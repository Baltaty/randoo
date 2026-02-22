import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

const PLANS: Record<string, { label: string; amount: number; minutes: number }> = {
  '10min': { label: 'Randoo Boost — 10 min', amount: 299, minutes: 10  },
  '30min': { label: 'Randoo Boost — 30 min', amount: 799, minutes: 30  },
  '60min': { label: 'Randoo Boost — 1h',     amount: 1499, minutes: 60  },
}

export async function POST(req: NextRequest) {
  // Must be authenticated — use SSR client to read session from cookies
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } },
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { plan, wantGender } = await req.json()

  if (!PLANS[plan]) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
  if (!['M', 'F'].includes(wantGender)) return NextResponse.json({ error: 'Invalid gender' }, { status: 400 })

  const { label, amount } = PLANS[plan]
  const origin = req.headers.get('origin') ?? 'http://localhost:3000'

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{
      price_data: {
        currency: 'usd',
        unit_amount: amount,
        product_data: { name: label },
      },
      quantity: 1,
    }],
    metadata: { plan, wantGender, userId: user.id },
    success_url: `${origin}/boost/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:  `${origin}/boost`,
  })

  return NextResponse.json({ url: session.url })
}
