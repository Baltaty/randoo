'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import { useI18n } from '@/contexts/I18nContext'

const PLANS = [
  { id: '10min', duration: '10 min', price: '1,99 €', popular: false },
  { id: '30min', duration: '30 min', price: '3,99 €', popular: true  },
  { id: '60min', duration: '1h',     price: '5,99 €', popular: false },
]

type WantGender = 'M' | 'F'

export default function BoostPage() {
  const router = useRouter()
  const { t } = useI18n()
  const [selectedPlan, setSelectedPlan] = useState<string>('30min')
  const [wantGender, setWantGender] = useState<WantGender>('F')

  function handleBoost() {
    router.push(`/chat?wantGender=${wantGender}`)
  }

  return (
    <div className="bg-gradient-cta min-h-screen flex flex-col items-center justify-between px-4 py-8">

      <div className="flex-1 flex flex-col w-full max-w-2xl pt-6">

        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-2 mb-3">
            <svg width="26" height="32" viewBox="0 0 44 52" fill="none">
              <path d="M26 0L0 30H18L18 52L44 22H26L26 0Z" fill="var(--theme-accent)"/>
            </svg>
            <span className="text-3xl font-bold tracking-tighter-xl" style={{ color: 'var(--theme-text)' }}>
              Boost
            </span>
          </div>
          <p className="text-sm font-medium" style={{ color: 'var(--theme-text-muted)' }}>
            {t('boost.subtitle')}
          </p>
        </div>

        {/* Gender selector */}
        <div className="mb-8">
          <p className="text-xs uppercase tracking-widest mb-3 font-semibold" style={{ color: 'var(--theme-text-muted)' }}>
            {t('boost.want')}
          </p>
          <div className="flex gap-3">
            {(['M', 'F'] as WantGender[]).map(g => (
              <button
                key={g}
                onClick={() => setWantGender(g)}
                className="flex-1 py-3.5 rounded-full font-semibold text-sm transition-all border"
                style={{
                  background:  wantGender === g ? 'var(--theme-accent)' : 'transparent',
                  color:       wantGender === g ? 'var(--theme-btn-fg)' : 'var(--theme-text-muted)',
                  borderColor: wantGender === g ? 'var(--theme-accent)' : 'var(--theme-border)',
                }}
              >
                {g === 'M' ? t('boost.men') : t('boost.women')}
              </button>
            ))}
          </div>
        </div>

        {/* Plans */}
        <div className="flex flex-col gap-3 mb-8">
          {PLANS.map(plan => {
            const isSelected = selectedPlan === plan.id
            return (
              <button
                key={plan.id}
                onClick={() => setSelectedPlan(plan.id)}
                className="relative w-full p-5 rounded-5xl text-left transition-all border"
                style={{
                  background:  isSelected ? 'var(--theme-surface)' : 'transparent',
                  borderColor: isSelected ? 'var(--theme-accent)'  : 'var(--theme-border)',
                }}
              >
                {plan.popular && (
                  <span
                    className="absolute -top-3 right-5 px-3 py-1 rounded-full text-xs font-semibold"
                    style={{ background: 'var(--theme-accent)', color: 'var(--theme-btn-fg)' }}
                  >
                    {t('boost.popular')}
                  </span>
                )}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-base" style={{ color: 'var(--theme-text)' }}>
                      {plan.duration}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--theme-text-muted)' }}>
                      {t('boost.filter_active')}
                    </p>
                  </div>
                  <p className="text-xl font-bold" style={{ color: isSelected ? 'var(--theme-accent)' : 'var(--theme-text-muted)' }}>
                    {plan.price}
                  </p>
                </div>
              </button>
            )
          })}
        </div>

        {/* CTA */}
        <button
          onClick={handleBoost}
          className="w-full py-5 rounded-full font-semibold text-lg transition-all active:scale-[0.98] hover:brightness-95 flex items-center justify-center gap-2"
          style={{ background: 'var(--theme-accent)', color: 'var(--theme-btn-fg)' }}
        >
          <span>⚡</span>
          <span>{t('boost.cta')}</span>
        </button>

        <p className="mt-3 text-xs text-center" style={{ color: 'var(--theme-text-muted)' }}>
          {t('boost.soon')}
        </p>
      </div>

      <BottomNav active="boost" />
    </div>
  )
}
