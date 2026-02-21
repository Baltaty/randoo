'use client'

import { useTheme } from '@/contexts/ThemeContext'
import { THEMES, isLightAccent } from '@/lib/themes'

interface Props {
  open: boolean
  onClose: () => void
}

export default function ThemeSelector({ open, onClose }: Props) {
  const { theme, setTheme } = useTheme()

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Floating list — anchored above the Theme nav button */}
      <div
        className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 rounded-2xl overflow-hidden shadow-2xl"
        style={{
          minWidth: 180,
          background: 'var(--theme-surface-solid)',
          border: '1px solid var(--theme-border)',
        }}
      >
        {THEMES.map(t => {
          const isActive = theme === t.name
          const lightText = !isLightAccent(t.accent)
          return (
            <button
              key={t.name}
              onClick={() => { setTheme(t.name); onClose() }}
              className="w-full px-5 py-3 text-left text-sm font-semibold transition-colors"
              style={{
                background: isActive ? t.accent : 'transparent',
                color: isActive
                  ? (isLightAccent(t.accent) ? '#000' : '#fff')
                  : 'var(--theme-text-muted)',
              }}
            >
              {t.label}
            </button>
          )
        })}
      </div>
    </>
  )
}
