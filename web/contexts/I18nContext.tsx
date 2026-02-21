'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { Lang, createT } from '@/lib/i18n'

interface I18nCtx {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: string, params?: Record<string, string>) => string
}

const I18nContext = createContext<I18nCtx>({
  lang: 'en',
  setLang: () => {},
  t: (key) => key,
})

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en')

  useEffect(() => {
    const saved = localStorage.getItem('randoo-lang') as Lang | null
    if (saved === 'en' || saved === 'fr') {
      setLangState(saved)
      document.documentElement.lang = saved
    }
  }, [])

  function setLang(l: Lang) {
    setLangState(l)
    localStorage.setItem('randoo-lang', l)
    document.documentElement.lang = l
  }

  return (
    <I18nContext.Provider value={{ lang, setLang, t: createT(lang) }}>
      {children}
    </I18nContext.Provider>
  )
}

export const useI18n = () => useContext(I18nContext)
