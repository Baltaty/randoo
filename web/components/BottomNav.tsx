'use client'

import Link from 'next/link'
import { useState } from 'react'
import ThemeSelector from './ThemeSelector'
import { useI18n } from '@/contexts/I18nContext'

type NavItem = 'home' | 'boost' | 'theme' | 'settings'

interface Props {
  active?: NavItem
}

function HomeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"/>
      <path d="M9 21V12h6v9"/>
    </svg>
  )
}

function BoostIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
    </svg>
  )
}

function ThemeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 2a10 10 0 0 1 0 20 2 2 0 0 1-2-2c0-.4.1-.7.1-1 .1-.6-.4-1.1-1.1-1.1H7a4 4 0 0 1-4-4 10 10 0 0 1 9-9.9"/>
      <circle cx="7.5" cy="10.5" r="1" fill="currentColor" stroke="none"/>
      <circle cx="12" cy="7" r="1" fill="currentColor" stroke="none"/>
      <circle cx="16.5" cy="10.5" r="1" fill="currentColor" stroke="none"/>
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  )
}

export default function BottomNav({ active }: Props) {
  const [themeOpen, setThemeOpen] = useState(false)
  const { t } = useI18n()

  return (
    <>
      <ThemeSelector open={themeOpen} onClose={() => setThemeOpen(false)} />

      <nav className="w-full max-w-sm relative z-50">
        <div
          className="flex items-center justify-around px-2 py-3 rounded-7xl border backdrop-blur-md"
          style={{
            background: 'var(--theme-surface)',
            borderColor: 'var(--theme-border)',
          }}
        >
          {/* Home */}
          <Link
            href="/"
            className="flex flex-col items-center gap-1.5 px-5 py-1 rounded-2xl transition-all"
            style={{ color: active === 'home' ? 'var(--theme-text)' : 'var(--theme-text-muted)' }}
          >
            <HomeIcon />
            <span className="text-xs font-medium">{t('nav.home')}</span>
          </Link>

          {/* Boost */}
          <Link
            href="/boost"
            className="flex flex-col items-center gap-1.5 px-5 py-1 rounded-2xl transition-all"
            style={{ color: active === 'boost' ? 'var(--theme-text)' : 'var(--theme-text-muted)' }}
          >
            <BoostIcon />
            <span className="text-xs font-medium">{t('nav.boost')}</span>
          </Link>

          {/* Theme — toggles selector */}
          <button
            onClick={() => setThemeOpen(v => !v)}
            className="flex flex-col items-center gap-1.5 px-5 py-1 rounded-2xl transition-all"
            style={{ color: themeOpen || active === 'theme' ? 'var(--theme-accent)' : 'var(--theme-text-muted)' }}
          >
            <ThemeIcon />
            <span className="text-xs font-medium">{t('nav.theme')}</span>
          </button>

          {/* Settings */}
          <Link
            href="/settings"
            className="flex flex-col items-center gap-1.5 px-5 py-1 rounded-2xl transition-all"
            style={{ color: active === 'settings' ? 'var(--theme-text)' : 'var(--theme-text-muted)' }}
          >
            <SettingsIcon />
            <span className="text-xs font-medium">{t('nav.settings')}</span>
          </Link>
        </div>
      </nav>
    </>
  )
}
