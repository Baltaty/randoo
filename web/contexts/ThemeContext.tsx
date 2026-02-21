'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import type { ThemeName } from '@/lib/themes'

interface ThemeCtx {
  theme: ThemeName
  setTheme: (t: ThemeName) => void
}

const ThemeContext = createContext<ThemeCtx>({ theme: 'default', setTheme: () => {} })

function applyTheme(t: ThemeName) {
  document.documentElement.setAttribute('data-theme', t)
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>('default')

  useEffect(() => {
    const saved = (localStorage.getItem('randoo-theme') || 'default') as ThemeName
    setThemeState(saved)
    applyTheme(saved)
  }, [])

  function setTheme(t: ThemeName) {
    setThemeState(t)
    applyTheme(t)
    localStorage.setItem('randoo-theme', t)
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
