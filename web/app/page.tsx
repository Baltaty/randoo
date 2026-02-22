'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import { useI18n } from '@/contexts/I18nContext'
import { useAuth } from '@/contexts/AuthContext'

export default function Home() {
  const router = useRouter()
  const { t } = useI18n()
  const { user } = useAuth()
  const [tags, setTags]         = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('randoo-interests') ?? '[]') } catch { return [] }
  })
  const [tagInput, setTagInput] = useState('')
  const [onlineCount, setOnlineCount] = useState<number | null>(null)
  const tagInputRef = useRef<HTMLInputElement>(null)

  // Persist tags to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('randoo-interests', JSON.stringify(tags))
  }, [tags])

  useEffect(() => {
    const fetchCount = () =>
      fetch('/api/online-count')
        .then(r => r.json())
        .then(d => setOnlineCount(d.count ?? 0))
        .catch(() => {})

    fetchCount()
    const id = setInterval(fetchCount, 30_000)
    return () => clearInterval(id)
  }, [])

  function addTag(value: string) {
    const v = value.trim()
    if (!v || tags.length >= 5 || tags.some(t => t.toLowerCase() === v.toLowerCase())) return
    setTags(prev => [...prev, v])
    setTagInput('')
  }

  function handleTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (tagInput.trim()) { addTag(tagInput); return }
      handleStart()
    } else if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
      setTags(prev => prev.slice(0, -1))
    }
  }

  function handleStart() {
    if (!user) { router.push('/auth?next=/chat'); return }
    const params = new URLSearchParams()
    if (tags.length > 0) params.set('interests', tags.join(','))
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
              {onlineCount === null ? '…' : t('home.online', { n: onlineCount.toLocaleString('en-US') })}
            </div>
          </div>

          {/* Interests tag input */}
          <div
            className="w-full px-5 py-3 rounded-2xl flex flex-wrap items-center gap-2 backdrop-blur-sm cursor-text transition-all"
            style={{ border: '1px solid var(--theme-border)', background: 'var(--theme-surface)', minHeight: '60px' }}
            onClick={() => tagInputRef.current?.focus()}
          >
            {tags.map(tag => (
              <span
                key={tag}
                className="flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold"
                style={{ background: 'var(--theme-accent)', color: 'var(--theme-btn-fg)' }}
              >
                {tag}
                <button
                  onClick={e => { e.stopPropagation(); setTags(prev => prev.filter(t => t !== tag)) }}
                  className="ml-0.5 hover:opacity-70 leading-none"
                  style={{ fontSize: 16 }}
                >×</button>
              </span>
            ))}
            {tags.length < 5 && (
              <input
                ref={tagInputRef}
                type="text"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                placeholder={tags.length === 0 ? t('home.interests') : ''}
                className="flex-1 min-w-[120px] bg-transparent outline-none text-base"
                style={{ color: 'var(--theme-text)' }}
              />
            )}
          </div>

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
