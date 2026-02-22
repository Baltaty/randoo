'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function SuccessContent() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const sessionId    = searchParams.get('session_id') ?? ''

  const [status, setStatus] = useState<'polling' | 'error'>('polling')
  const [dots,   setDots]   = useState('.')

  // Animated dots
  useEffect(() => {
    const id = setInterval(() => setDots(d => d.length >= 3 ? '.' : d + '.'), 500)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!sessionId) { setStatus('error'); return }

    let attempts = 0
    const MAX = 30 // 30s max

    const poll = async () => {
      attempts++
      try {
        const res  = await fetch(`/api/boost-status?session_id=${encodeURIComponent(sessionId)}`)
        const data = await res.json()

        if (data.ready) {
          // Persist boost in localStorage so it survives navigation
          localStorage.setItem('randoo-boost', JSON.stringify({
            token:      data.token,
            wantGender: data.wantGender,
            expiresAt:  data.expiresAt,
          }))
          const expires = encodeURIComponent(data.expiresAt)
          router.replace(`/chat?boost=${data.token}&wantGender=${data.wantGender}&boostExpires=${expires}`)
          return
        }
      } catch { /* retry */ }

      if (attempts >= MAX) { setStatus('error'); return }
      setTimeout(poll, 1000)
    }

    poll()
  }, [sessionId, router])

  if (status === 'error') {
    return (
      <div className="text-center">
        <p className="text-lg font-semibold mb-2" style={{ color: 'var(--theme-text)' }}>
          Something went wrong
        </p>
        <p className="text-sm mb-6" style={{ color: 'var(--theme-text-muted)' }}>
          Your payment was received but activation timed out.
        </p>
        <button
          onClick={() => router.push('/boost')}
          className="px-6 py-3 rounded-full font-semibold text-sm"
          style={{ background: 'var(--theme-accent)', color: 'var(--theme-btn-fg)' }}
        >
          Back to Boost
        </button>
      </div>
    )
  }

  return (
    <div className="text-center">
      {/* Spinner */}
      <div className="flex justify-center mb-8">
        <div
          className="w-16 h-16 rounded-full border-4 border-t-transparent animate-spin"
          style={{ borderColor: 'var(--theme-border)', borderTopColor: 'var(--theme-accent)' }}
        />
      </div>
      <p className="text-lg font-semibold mb-2" style={{ color: 'var(--theme-text)' }}>
        Activating your Boost{dots}
      </p>
      <p className="text-sm" style={{ color: 'var(--theme-text-muted)' }}>
        You&apos;ll be redirected to chat automatically.
      </p>
    </div>
  )
}

export default function BoostSuccessPage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'var(--theme-bg)' }}
    >
      <Suspense>
        <SuccessContent />
      </Suspense>
    </div>
  )
}
