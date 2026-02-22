'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import { useI18n } from '@/contexts/I18nContext'

export default function Home() {
  const router = useRouter()
  const { t } = useI18n()
  const [interests, setInterests] = useState('')
  const onlineCount = 10229

  function handleStart() {
    const params = new URLSearchParams()
    if (interests.trim()) params.set('interests', interests.trim())
    router.push(`/chat?${params.toString()}`)
  }

  return (
    <div className="bg-gradient-hero min-h-screen flex flex-col items-center justify-between px-4 py-8">

      {/* ── Logo ── */}
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-2xl gap-16">

        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-3">
            <svg width="36" height="44" viewBox="0 0 44 52" fill="none">
              <path d="M 10 18 C 10 8 34 8 34 18 C 34 26 24 28 22 32"
                stroke="var(--theme-text)" strokeWidth="9" strokeLinecap="round"/>
              <circle cx="22" cy="46" r="5" fill="var(--theme-text)"/>
            </svg>
            <span
              className="font-bold tracking-tighter-xl"
              style={{ fontSize: 56, lineHeight: 1, color: 'var(--theme-text)' }}
            >
              randoo
            </span>
          </div>
          <p className="text-sm italic font-medium tracking-wide" style={{ color: 'var(--theme-text-muted)' }}>
            {t('home.tagline')}
          </p>
        </div>

        {/* ── Controls ── */}
        <div className="w-full space-y-5">

          {/* Row 1 : ALL pill ↔ Online count */}
          <div className="flex items-center justify-between">
            <button
              className="flex items-center gap-2 px-5 py-3 rounded-full text-sm font-semibold transition-colors backdrop-blur-sm"
              style={{ color: 'var(--theme-text)', border: '1px solid var(--theme-border)', background: 'var(--theme-surface)' }}
            >
              🌍 ALL
            </button>

            <div
              className="flex items-center gap-2 px-5 py-3 rounded-full text-sm font-semibold backdrop-blur-sm"
              style={{ color: 'var(--theme-text)', border: '1px solid var(--theme-border)', background: 'var(--theme-surface)' }}
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: 'var(--color-success)', boxShadow: '0 0 6px var(--color-success)' }}
              />
              {t('home.online', { n: onlineCount.toLocaleString('en-US') })}
            </div>
          </div>

          {/* Interests input */}
          <input
            type="text"
            value={interests}
            onChange={e => setInterests(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleStart()}
            placeholder={t('home.interests')}
            className="w-full px-7 py-5 rounded-full text-base outline-none transition-all backdrop-blur-sm"
            style={{
              border: '1px solid var(--theme-border)',
              background: 'var(--theme-surface)',
              color: 'var(--theme-text)',
            }}
          />

          {/* Start button */}
          <button
            onClick={handleStart}
            className="w-full py-6 rounded-full font-semibold text-xl transition-all duration-150 active:scale-[0.98] hover:brightness-95 flex items-center justify-center gap-3"
            style={{ background: 'var(--theme-accent)', color: 'var(--theme-btn-fg)' }}
          >
            <span>{t('home.start')}</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </button>
        </div>

      </div>

      {/* ── Bottom nav ── */}
      <BottomNav active="home" />
    </div>
  )
}
