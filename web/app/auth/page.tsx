'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'

type Mode = 'signin' | 'signup'

function AuthForm() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const next         = searchParams.get('next') || '/'

  const [mode, setMode]       = useState<Mode>('signin')
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]     = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) { setError(error.message); setLoading(false); return }
      // Email confirmation is disabled — user is immediately active, redirect now
      router.push(next)
      router.refresh()
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { setError(error.message); setLoading(false); return }
      router.push(next)
      router.refresh()
    }

    setLoading(false)
  }

  function switchMode(m: Mode) {
    setMode(m)
    setError(null)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: 'var(--theme-bg)' }}>

      {/* Logo */}
      <div className="flex items-center gap-2.5 mb-10">
        <svg width="28" height="34" viewBox="0 0 44 52" fill="none">
          <path d="M 10 18 C 10 8 34 8 34 18 C 34 26 24 28 22 32"
            stroke="var(--theme-accent)" strokeWidth="9" strokeLinecap="round"/>
          <circle cx="22" cy="46" r="5" fill="var(--theme-accent)"/>
        </svg>
        <span className="font-bold text-2xl" style={{ color: 'var(--theme-text)', letterSpacing: '-0.5px' }}>
          randoo
        </span>
      </div>

      <div className="w-full max-w-sm">

        {/* Mode tabs */}
        <div className="flex rounded-2xl p-1 mb-6"
          style={{ background: 'var(--theme-surface)', border: '1px solid var(--theme-border)' }}>
          {(['signin', 'signup'] as Mode[]).map(m => (
            <button key={m} onClick={() => switchMode(m)}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: mode === m ? 'var(--theme-accent)' : 'transparent',
                color: mode === m ? 'var(--theme-btn-fg)' : 'var(--theme-text-muted)',
              }}>
              {m === 'signin' ? 'Sign in' : 'Sign up'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="w-full px-5 py-4 rounded-2xl text-sm outline-none"
            style={{
              background: 'var(--theme-surface)',
              border: '1px solid var(--theme-border)',
              color: 'var(--theme-text)',
            }}
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={6}
            className="w-full px-5 py-4 rounded-2xl text-sm outline-none"
            style={{
              background: 'var(--theme-surface)',
              border: '1px solid var(--theme-border)',
              color: 'var(--theme-text)',
            }}
          />

          {error && (
            <p className="text-sm px-2" style={{ color: 'var(--color-error)' }}>{error}</p>
          )}

          <button type="submit" disabled={loading}
            className="w-full py-4 rounded-2xl font-semibold text-base transition-all active:scale-[0.98] disabled:opacity-60 mt-1"
            style={{ background: 'var(--theme-accent)', color: 'var(--theme-btn-fg)' }}>
            {loading ? '…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function AuthPage() {
  return <Suspense><AuthForm /></Suspense>
}
