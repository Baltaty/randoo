'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function PasswordForm() {
  const router   = useRouter()
  const [pass, setPass] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch('/api/cockpit/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pass }),
    })
    setLoading(false)
    if (res.ok) {
      router.refresh()
    } else {
      setError('Wrong password')
      setPass('')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0a0a' }}>
      <form onSubmit={submit} className="w-full max-w-sm px-4">
        <div className="flex items-center gap-2 mb-8">
          <svg width="18" height="22" viewBox="0 0 44 52" fill="none">
            <path d="M 10 18 C 10 8 34 8 34 18 C 34 26 24 28 22 32"
              stroke="#ffd53a" strokeWidth="9" strokeLinecap="round"/>
            <circle cx="22" cy="46" r="5" fill="#ffd53a"/>
          </svg>
          <span className="font-bold text-white text-lg" style={{ letterSpacing: '-0.5px' }}>
            cockpit
          </span>
        </div>

        <input
          type="password"
          value={pass}
          onChange={e => setPass(e.target.value)}
          placeholder="Password"
          autoFocus
          className="w-full px-4 py-3 rounded-xl text-sm outline-none mb-3"
          style={{ background: '#141414', color: 'white', border: '1px solid #272727' }}
        />

        {error && (
          <p className="text-sm mb-3" style={{ color: '#f02031' }}>{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || !pass}
          className="w-full py-3 rounded-xl font-bold text-sm transition-all hover:brightness-90 active:scale-95 disabled:opacity-40"
          style={{ background: '#ffd53a', color: '#0a0a0a' }}
        >
          {loading ? 'Checking…' : 'Enter'}
        </button>
      </form>
    </div>
  )
}
