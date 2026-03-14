'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/contexts/I18nContext'
import { useAuth } from '@/contexts/AuthContext'

type Tab = 'general' | 'matching' | 'filters' | 'profile'
type Sex = 'M' | 'F' | 'O'
type LookingFor = 'all' | 'M' | 'F' | 'O'

interface Settings {
  privacyMode: boolean
  sfxVolume: boolean
  autoRollVideo: boolean
  yourSex: Sex
  lookingFor: LookingFor
  maxWait: number
  countries: string[]
}

const DEFAULTS: Settings = {
  privacyMode: false,
  sfxVolume: true,
  autoRollVideo: true,
  yourSex: 'M',
  lookingFor: 'all',
  maxWait: 3,
  countries: [],
}

// ── Country data ──────────────────────────────

const COUNTRIES: { code: string; name: string; flag: string }[] = [
  { code: 'AF', name: 'Afghanistan',           flag: '🇦🇫' },
  { code: 'AL', name: 'Albania',               flag: '🇦🇱' },
  { code: 'DZ', name: 'Algeria',               flag: '🇩🇿' },
  { code: 'AR', name: 'Argentina',             flag: '🇦🇷' },
  { code: 'AM', name: 'Armenia',               flag: '🇦🇲' },
  { code: 'AU', name: 'Australia',             flag: '🇦🇺' },
  { code: 'AT', name: 'Austria',               flag: '🇦🇹' },
  { code: 'AZ', name: 'Azerbaijan',            flag: '🇦🇿' },
  { code: 'BH', name: 'Bahrain',               flag: '🇧🇭' },
  { code: 'BD', name: 'Bangladesh',            flag: '🇧🇩' },
  { code: 'BY', name: 'Belarus',               flag: '🇧🇾' },
  { code: 'BE', name: 'Belgium',               flag: '🇧🇪' },
  { code: 'BJ', name: 'Benin',                 flag: '🇧🇯' },
  { code: 'BO', name: 'Bolivia',               flag: '🇧🇴' },
  { code: 'BA', name: 'Bosnia & Herzegovina',  flag: '🇧🇦' },
  { code: 'BR', name: 'Brazil',                flag: '🇧🇷' },
  { code: 'BG', name: 'Bulgaria',              flag: '🇧🇬' },
  { code: 'KH', name: 'Cambodia',              flag: '🇰🇭' },
  { code: 'CM', name: 'Cameroon',              flag: '🇨🇲' },
  { code: 'CA', name: 'Canada',                flag: '🇨🇦' },
  { code: 'CL', name: 'Chile',                 flag: '🇨🇱' },
  { code: 'CN', name: 'China',                 flag: '🇨🇳' },
  { code: 'CO', name: 'Colombia',              flag: '🇨🇴' },
  { code: 'CD', name: 'Congo (DRC)',           flag: '🇨🇩' },
  { code: 'CR', name: 'Costa Rica',            flag: '🇨🇷' },
  { code: 'HR', name: 'Croatia',               flag: '🇭🇷' },
  { code: 'CU', name: 'Cuba',                  flag: '🇨🇺' },
  { code: 'CY', name: 'Cyprus',                flag: '🇨🇾' },
  { code: 'CZ', name: 'Czech Republic',        flag: '🇨🇿' },
  { code: 'DK', name: 'Denmark',               flag: '🇩🇰' },
  { code: 'DO', name: 'Dominican Republic',    flag: '🇩🇴' },
  { code: 'EC', name: 'Ecuador',               flag: '🇪🇨' },
  { code: 'EG', name: 'Egypt',                 flag: '🇪🇬' },
  { code: 'SV', name: 'El Salvador',           flag: '🇸🇻' },
  { code: 'ET', name: 'Ethiopia',              flag: '🇪🇹' },
  { code: 'FI', name: 'Finland',               flag: '🇫🇮' },
  { code: 'FR', name: 'France',                flag: '🇫🇷' },
  { code: 'GE', name: 'Georgia',               flag: '🇬🇪' },
  { code: 'DE', name: 'Germany',               flag: '🇩🇪' },
  { code: 'GH', name: 'Ghana',                 flag: '🇬🇭' },
  { code: 'GR', name: 'Greece',                flag: '🇬🇷' },
  { code: 'GT', name: 'Guatemala',             flag: '🇬🇹' },
  { code: 'HN', name: 'Honduras',              flag: '🇭🇳' },
  { code: 'HK', name: 'Hong Kong',             flag: '🇭🇰' },
  { code: 'HU', name: 'Hungary',               flag: '🇭🇺' },
  { code: 'IN', name: 'India',                 flag: '🇮🇳' },
  { code: 'ID', name: 'Indonesia',             flag: '🇮🇩' },
  { code: 'IR', name: 'Iran',                  flag: '🇮🇷' },
  { code: 'IQ', name: 'Iraq',                  flag: '🇮🇶' },
  { code: 'IE', name: 'Ireland',               flag: '🇮🇪' },
  { code: 'IL', name: 'Israel',                flag: '🇮🇱' },
  { code: 'IT', name: 'Italy',                 flag: '🇮🇹' },
  { code: 'CI', name: 'Ivory Coast',           flag: '🇨🇮' },
  { code: 'JM', name: 'Jamaica',               flag: '🇯🇲' },
  { code: 'JP', name: 'Japan',                 flag: '🇯🇵' },
  { code: 'JO', name: 'Jordan',                flag: '🇯🇴' },
  { code: 'KZ', name: 'Kazakhstan',            flag: '🇰🇿' },
  { code: 'KE', name: 'Kenya',                 flag: '🇰🇪' },
  { code: 'KW', name: 'Kuwait',                flag: '🇰🇼' },
  { code: 'KG', name: 'Kyrgyzstan',            flag: '🇰🇬' },
  { code: 'LA', name: 'Laos',                  flag: '🇱🇦' },
  { code: 'LB', name: 'Lebanon',               flag: '🇱🇧' },
  { code: 'LY', name: 'Libya',                 flag: '🇱🇾' },
  { code: 'LT', name: 'Lithuania',             flag: '🇱🇹' },
  { code: 'LU', name: 'Luxembourg',            flag: '🇱🇺' },
  { code: 'MK', name: 'North Macedonia',       flag: '🇲🇰' },
  { code: 'MY', name: 'Malaysia',              flag: '🇲🇾' },
  { code: 'MV', name: 'Maldives',              flag: '🇲🇻' },
  { code: 'ML', name: 'Mali',                  flag: '🇲🇱' },
  { code: 'MT', name: 'Malta',                 flag: '🇲🇹' },
  { code: 'MX', name: 'Mexico',                flag: '🇲🇽' },
  { code: 'MD', name: 'Moldova',               flag: '🇲🇩' },
  { code: 'MN', name: 'Mongolia',              flag: '🇲🇳' },
  { code: 'MA', name: 'Morocco',               flag: '🇲🇦' },
  { code: 'MZ', name: 'Mozambique',            flag: '🇲🇿' },
  { code: 'MM', name: 'Myanmar',               flag: '🇲🇲' },
  { code: 'NP', name: 'Nepal',                 flag: '🇳🇵' },
  { code: 'NL', name: 'Netherlands',           flag: '🇳🇱' },
  { code: 'NZ', name: 'New Zealand',           flag: '🇳🇿' },
  { code: 'NI', name: 'Nicaragua',             flag: '🇳🇮' },
  { code: 'NG', name: 'Nigeria',               flag: '🇳🇬' },
  { code: 'NO', name: 'Norway',                flag: '🇳🇴' },
  { code: 'OM', name: 'Oman',                  flag: '🇴🇲' },
  { code: 'PK', name: 'Pakistan',              flag: '🇵🇰' },
  { code: 'PA', name: 'Panama',                flag: '🇵🇦' },
  { code: 'PY', name: 'Paraguay',              flag: '🇵🇾' },
  { code: 'PE', name: 'Peru',                  flag: '🇵🇪' },
  { code: 'PH', name: 'Philippines',           flag: '🇵🇭' },
  { code: 'PL', name: 'Poland',                flag: '🇵🇱' },
  { code: 'PT', name: 'Portugal',              flag: '🇵🇹' },
  { code: 'QA', name: 'Qatar',                 flag: '🇶🇦' },
  { code: 'RO', name: 'Romania',               flag: '🇷🇴' },
  { code: 'RU', name: 'Russia',                flag: '🇷🇺' },
  { code: 'SA', name: 'Saudi Arabia',          flag: '🇸🇦' },
  { code: 'SN', name: 'Senegal',               flag: '🇸🇳' },
  { code: 'RS', name: 'Serbia',                flag: '🇷🇸' },
  { code: 'SG', name: 'Singapore',             flag: '🇸🇬' },
  { code: 'SK', name: 'Slovakia',              flag: '🇸🇰' },
  { code: 'SI', name: 'Slovenia',              flag: '🇸🇮' },
  { code: 'SO', name: 'Somalia',               flag: '🇸🇴' },
  { code: 'ZA', name: 'South Africa',          flag: '🇿🇦' },
  { code: 'KR', name: 'South Korea',           flag: '🇰🇷' },
  { code: 'SS', name: 'South Sudan',           flag: '🇸🇸' },
  { code: 'ES', name: 'Spain',                 flag: '🇪🇸' },
  { code: 'LK', name: 'Sri Lanka',             flag: '🇱🇰' },
  { code: 'SD', name: 'Sudan',                 flag: '🇸🇩' },
  { code: 'SE', name: 'Sweden',                flag: '🇸🇪' },
  { code: 'CH', name: 'Switzerland',           flag: '🇨🇭' },
  { code: 'SY', name: 'Syria',                 flag: '🇸🇾' },
  { code: 'TW', name: 'Taiwan',                flag: '🇹🇼' },
  { code: 'TJ', name: 'Tajikistan',            flag: '🇹🇯' },
  { code: 'TZ', name: 'Tanzania',              flag: '🇹🇿' },
  { code: 'TH', name: 'Thailand',              flag: '🇹🇭' },
  { code: 'TN', name: 'Tunisia',               flag: '🇹🇳' },
  { code: 'TR', name: 'Turkey',                flag: '🇹🇷' },
  { code: 'TM', name: 'Turkmenistan',          flag: '🇹🇲' },
  { code: 'UG', name: 'Uganda',                flag: '🇺🇬' },
  { code: 'UA', name: 'Ukraine',               flag: '🇺🇦' },
  { code: 'AE', name: 'United Arab Emirates',  flag: '🇦🇪' },
  { code: 'GB', name: 'United Kingdom',        flag: '🇬🇧' },
  { code: 'US', name: 'United States',         flag: '🇺🇸' },
  { code: 'UY', name: 'Uruguay',               flag: '🇺🇾' },
  { code: 'UZ', name: 'Uzbekistan',            flag: '🇺🇿' },
  { code: 'VE', name: 'Venezuela',             flag: '🇻🇪' },
  { code: 'VN', name: 'Vietnam',               flag: '🇻🇳' },
  { code: 'YE', name: 'Yemen',                 flag: '🇾🇪' },
  { code: 'ZM', name: 'Zambia',                flag: '🇿🇲' },
  { code: 'ZW', name: 'Zimbabwe',              flag: '🇿🇼' },
].sort((a, b) => a.name.localeCompare(b.name))

// ── Country picker modal ──────────────────────

function CountryModal({
  selected,
  onClose,
  onSave,
}: {
  selected: string[]
  onClose: () => void
  onSave: (codes: string[]) => void
}) {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState<string[]>(selected)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const filtered = query.trim()
    ? COUNTRIES.filter(c => c.name.toLowerCase().includes(query.toLowerCase()))
    : COUNTRIES

  function toggle(code: string) {
    setDraft(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    )
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-2xl flex flex-col"
        style={{
          background: 'var(--theme-surface-solid)',
          border: '1px solid var(--theme-border)',
          borderBottom: 'none',
          borderRadius: '24px 24px 0 0',
          height: '85vh',
        }}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-4" style={{ borderBottom: '1px solid var(--theme-border)' }}>
          <div>
            <p className="font-bold text-base" style={{ color: 'var(--theme-text)' }}>{t('country.title')}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--theme-text-muted)' }}>
              {draft.length === 0 ? t('country.all') : t('country.selected', { n: String(draft.length) })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {draft.length > 0 && (
              <button
                onClick={() => setDraft([])}
                className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                style={{ color: 'var(--theme-text-muted)', background: 'var(--theme-border)' }}
              >
                {t('country.clear')}
              </button>
            )}
            <button
              onClick={() => { onSave(draft); onClose() }}
              className="px-4 py-1.5 rounded-full text-sm font-bold transition-all active:scale-95"
              style={{ background: 'var(--theme-accent)', color: 'var(--theme-btn-fg)' }}
            >
              {t('country.done')}
            </button>
          </div>
        </div>

        <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--theme-border)' }}>
          <div
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
            style={{ background: 'var(--theme-surface)', border: '1px solid var(--theme-border)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--theme-text-muted)', flexShrink: 0 }}>
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              ref={inputRef}
              type="text"
              placeholder={t('country.search')}
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none"
              style={{ color: 'var(--theme-text)' }}
            />
            {query && (
              <button onClick={() => setQuery('')} style={{ color: 'var(--theme-text-muted)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-center py-10 text-sm" style={{ color: 'var(--theme-text-muted)' }}>{t('country.empty')}</p>
          ) : (
            filtered.map((country, i) => {
              const isSelected = draft.includes(country.code)
              return (
                <button
                  key={country.code}
                  onClick={() => toggle(country.code)}
                  className="w-full flex items-center gap-3 px-5 py-3.5 transition-colors text-left"
                  style={{
                    borderTop: i > 0 ? '1px solid var(--theme-border)' : undefined,
                    background: isSelected ? 'rgba(var(--theme-accent-rgb), 0.08)' : 'transparent',
                  }}
                >
                  <span className="text-xl leading-none">{country.flag}</span>
                  <span className="flex-1 text-sm font-medium" style={{ color: 'var(--theme-text)' }}>{country.name}</span>
                  {isSelected && (
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: 'var(--theme-accent)' }}
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--theme-btn-fg)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    </span>
                  )}
                </button>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

// ── Reusable components ──────────────────────

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className="relative flex-shrink-0 rounded-full transition-colors duration-200"
      style={{
        width: 48,
        height: 28,
        background: on ? 'var(--theme-accent)' : 'rgba(128,128,128,0.3)',
      }}
    >
      <span
        className="absolute rounded-full bg-white shadow transition-transform duration-200"
        style={{
          width: 22,
          height: 22,
          top: 3,
          left: 3,
          transform: on ? 'translateX(20px)' : 'translateX(0)',
        }}
      />
    </button>
  )
}

function Radio({ selected, onChange, label }: { selected: boolean; onChange: () => void; label: string }) {
  return (
    <button onClick={onChange} className="flex items-center gap-2.5">
      <span
        className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors"
        style={{ borderColor: selected ? 'var(--theme-accent)' : 'rgba(128,128,128,0.4)' }}
      >
        {selected && (
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--theme-accent)' }} />
        )}
      </span>
      <span className="text-sm font-medium" style={{ color: 'var(--theme-text)' }}>{label}</span>
    </button>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: 'var(--theme-surface-solid)', border: '1px solid var(--theme-border)' }}
    >
      {children}
    </div>
  )
}

function SettingRow({
  label,
  description,
  children,
  divider = false,
}: {
  label: string
  description: string
  children: React.ReactNode
  divider?: boolean
}) {
  return (
    <>
      {divider && <div style={{ height: 1, background: 'var(--theme-border)' }} />}
      <div className="px-5 py-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-semibold" style={{ color: 'var(--theme-text)' }}>{label}</span>
          {children}
        </div>
        <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>{description}</p>
      </div>
    </>
  )
}

function SectionHeader({ emoji, title }: { emoji: string; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-base">{emoji}</span>
      <span className="font-bold text-sm" style={{ color: 'var(--theme-text)' }}>{title}</span>
    </div>
  )
}

// ── Tab content ──────────────────────────────

function GeneralTab({ s, set }: { s: Settings; set: (k: keyof Settings, v: unknown) => void }) {
  const { t, lang, setLang } = useI18n()
  const state = (on: boolean) => on ? t('common.on') : t('common.off')

  return (
    <div className="space-y-6">
      <div>
        <SectionHeader emoji="🎭" title={t('settings.privacy.title')} />
        <Card>
          <SettingRow
            label={t('settings.privacy.label', { state: state(s.privacyMode) })}
            description={t('settings.privacy.desc')}
          >
            <Toggle on={s.privacyMode} onChange={() => set('privacyMode', !s.privacyMode)} />
          </SettingRow>
        </Card>
      </div>

      <div>
        <SectionHeader emoji="🔊" title={t('settings.volume.title')} />
        <Card>
          <SettingRow
            label={t('settings.sfx.label', { state: state(s.sfxVolume) })}
            description={t('settings.sfx.desc')}
          >
            <Toggle on={s.sfxVolume} onChange={() => set('sfxVolume', !s.sfxVolume)} />
          </SettingRow>
        </Card>
      </div>

      <div>
        <SectionHeader emoji="🌐" title={t('settings.language.title')} />
        <Card>
          <div className="px-5 py-4">
            <div className="flex gap-2 mb-3">
              {(['en', 'fr'] as const).map(l => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className="flex-1 py-2.5 rounded-full text-sm font-semibold transition-all border"
                  style={{
                    background:  lang === l ? 'var(--theme-accent)' : 'transparent',
                    color:       lang === l ? 'var(--theme-btn-fg)' : 'var(--theme-text-muted)',
                    borderColor: lang === l ? 'var(--theme-accent)' : 'var(--theme-border)',
                  }}
                >
                  {l === 'en' ? '🇬🇧 English' : '🇫🇷 Français'}
                </button>
              ))}
            </div>
            <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>{t('settings.language.desc')}</p>
          </div>
        </Card>
      </div>
    </div>
  )
}

function MatchingTab({ s, set }: { s: Settings; set: (k: keyof Settings, v: unknown) => void }) {
  const { t } = useI18n()
  const state = (on: boolean) => on ? t('common.on') : t('common.off')

  return (
    <div className="space-y-6">
      <div>
        <SectionHeader emoji="☁️" title={t('settings.autoroll.title')} />
        <Card>
          <SettingRow
            label={t('settings.autoroll.video.label', { state: state(s.autoRollVideo) })}
            description={t('settings.autoroll.video.desc')}
          >
            <Toggle on={s.autoRollVideo} onChange={() => set('autoRollVideo', !s.autoRollVideo)} />
          </SettingRow>
        </Card>
      </div>
    </div>
  )
}

function FiltersTab({ s, set }: { s: Settings; set: (k: keyof Settings, v: unknown) => void }) {
  const { t } = useI18n()
  const [modalOpen, setModalOpen] = useState(false)
  const hasCountries = s.countries.length > 0
  const selectedCountryObjects = COUNTRIES.filter(c => s.countries.includes(c.code))

  return (
    <>
      {modalOpen && (
        <CountryModal
          selected={s.countries}
          onClose={() => setModalOpen(false)}
          onSave={codes => set('countries', codes)}
        />
      )}

      <div className="space-y-6">
        <div>
          <SectionHeader
            emoji="🌍"
            title={t('settings.country.title', { state: hasCountries ? t('common.on') : t('common.off') })}
          />
          <Card>
            <div className="px-5 py-4">
              <button
                onClick={() => setModalOpen(true)}
                className="px-5 py-2.5 rounded-full text-sm font-bold transition-all active:scale-95 hover:brightness-90 mb-3"
                style={{ background: 'var(--theme-accent)', color: 'var(--theme-btn-fg)' }}
              >
                {hasCountries ? t('settings.country.edit') : t('settings.country.select')}
              </button>

              {hasCountries ? (
                <div className="flex flex-wrap gap-1.5">
                  {selectedCountryObjects.map(c => (
                    <span
                      key={c.code}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
                      style={{ background: 'rgba(var(--theme-accent-rgb), 0.15)', color: 'var(--theme-text)' }}
                    >
                      {c.flag} {c.name}
                      <button
                        onClick={() => set('countries', s.countries.filter(x => x !== c.code))}
                        className="ml-0.5 opacity-50 hover:opacity-100 transition-opacity"
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
                  {t('settings.country.desc')}
                </p>
              )}
            </div>
          </Card>
        </div>

        <div>
          <SectionHeader emoji="⏳" title={t('settings.maxwait.title')} />
          <Card>
            <div className="px-5 py-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold" style={{ color: 'var(--theme-text)' }}>
                  {s.maxWait}s
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={30}
                value={s.maxWait}
                onChange={e => set('maxWait', Number(e.target.value))}
              />
              <p className="text-xs mt-3" style={{ color: 'var(--theme-text-muted)' }}>
                {t('settings.maxwait.desc')}
              </p>
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}

function ProfileTab({
  s,
  set,
  onSignOut,
  email,
}: {
  s: Settings
  set: (k: keyof Settings, v: unknown) => void
  onSignOut: () => void
  email?: string
}) {
  const { t } = useI18n()
  const router = useRouter()
  const { signOut } = useAuth()
  const [deleteStep, setDeleteStep] = useState<'idle' | 'confirm' | 'deleting' | 'done'>('idle')
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function handleDelete() {
    setDeleteStep('deleting')
    setDeleteError(null)
    try {
      const res = await fetch('/api/account', { method: 'DELETE' })
      if (!res.ok) {
        const d = await res.json()
        setDeleteError(d.error ?? 'Failed to delete account')
        setDeleteStep('confirm')
        return
      }
      localStorage.clear()
      await signOut()
      setDeleteStep('done')
      setTimeout(() => router.push('/'), 2000)
    } catch {
      setDeleteError('Network error, please try again')
      setDeleteStep('confirm')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <SectionHeader emoji="👤" title={t('settings.sex.title')} />
        <Card>
          <div className="px-5 py-4 flex items-center gap-6">
            <Radio selected={s.yourSex === 'M'} onChange={() => set('yourSex', 'M')} label={t('settings.male')} />
            <Radio selected={s.yourSex === 'F'} onChange={() => set('yourSex', 'F')} label={t('settings.female')} />
            <Radio selected={s.yourSex === 'O'} onChange={() => set('yourSex', 'O')} label={t('settings.other')} />
          </div>
        </Card>
      </div>

      <div>
        <SectionHeader emoji="👥" title={t('settings.looking.title')} />
        <Card>
          <div className="px-5 py-4 flex items-center gap-5 flex-wrap">
            <Radio selected={s.lookingFor === 'all'} onChange={() => set('lookingFor', 'all')} label={t('settings.everyone')} />
            <Radio selected={s.lookingFor === 'M'}   onChange={() => set('lookingFor', 'M')}   label={t('settings.male')} />
            <Radio selected={s.lookingFor === 'F'}   onChange={() => set('lookingFor', 'F')}   label={t('settings.female')} />
            <Radio selected={s.lookingFor === 'O'}   onChange={() => set('lookingFor', 'O')}   label={t('settings.other')} />
          </div>
        </Card>
      </div>

      <div>
        <SectionHeader emoji="💳" title={t('settings.account.title')} />
        <Card>
          <div className="px-5 py-4">
            <p className="text-xs font-semibold mb-1" style={{ color: 'var(--theme-text-muted)' }}>{t('settings.account.username')}</p>
            <p className="text-sm" style={{ color: 'var(--theme-text-muted)' }}>{email ?? '—'}</p>
          </div>

          <div style={{ height: 1, background: 'var(--theme-border)' }} />

          <div className="px-5 py-4">
            <button
              onClick={onSignOut}
              className="w-full py-3.5 rounded-full text-sm font-bold transition-all active:scale-95 border"
              style={{ color: 'var(--color-error)', borderColor: 'var(--color-error)', background: 'transparent' }}
            >
              {t('settings.signout.btn')}
            </button>
            <p className="text-xs mt-2" style={{ color: 'var(--theme-text-muted)' }}>
              {t('settings.signout.desc', { action: t('settings.signout.btn') })}
            </p>
          </div>

          <div style={{ height: 1, background: 'var(--theme-border)' }} />

          <div className="px-5 py-4">
            {deleteStep === 'idle' && (
              <>
                <button
                  onClick={() => setDeleteStep('confirm')}
                  className="w-full py-3.5 rounded-full text-sm font-bold text-white transition-all active:scale-95"
                  style={{ background: 'var(--color-error)' }}
                >
                  {t('settings.delete.btn')}
                </button>
                <p className="text-xs mt-2" style={{ color: 'var(--theme-text-muted)' }}>
                  {t('settings.delete.desc')}
                </p>
              </>
            )}

            {(deleteStep === 'confirm' || deleteStep === 'deleting') && (
              <div
                className="rounded-2xl p-4"
                style={{ background: 'rgba(240,32,49,0.08)', border: '1px solid rgba(240,32,49,0.25)' }}
              >
                <p className="text-sm font-bold mb-1" style={{ color: 'var(--color-error)' }}>{t('settings.delete.confirm.title')}</p>
                <p className="text-xs mb-4" style={{ color: 'var(--theme-text-muted)' }}>
                  {t('settings.delete.confirm.desc')}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setDeleteStep('idle')}
                    className="flex-1 py-2.5 rounded-full text-sm font-semibold transition-all active:scale-95 border"
                    style={{ color: 'var(--theme-text-muted)', borderColor: 'var(--theme-border)', background: 'transparent' }}
                  >
                    {t('settings.delete.cancel')}
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleteStep === 'deleting'}
                    className="flex-1 py-2.5 rounded-full text-sm font-bold text-white transition-all active:scale-95 disabled:opacity-60"
                    style={{ background: 'var(--color-error)' }}
                  >
                    {deleteStep === 'deleting' ? '…' : t('settings.delete.yes')}
                  </button>
                </div>
                {deleteError && (
                  <p className="text-xs mt-2 text-center" style={{ color: 'var(--color-error)' }}>{deleteError}</p>
                )}
              </div>
            )}

            {deleteStep === 'done' && (
              <div
                className="rounded-2xl p-4 text-center"
                style={{ background: 'rgba(240,32,49,0.08)', border: '1px solid rgba(240,32,49,0.25)' }}
              >
                <p className="text-sm font-bold mb-1" style={{ color: 'var(--color-error)' }}>{t('settings.delete.done.title')}</p>
                <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
                  {t('settings.delete.done.desc')}
                </p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}

// ── Main exported component ───────────────────

const TAB_IDS: Tab[] = ['general', 'matching', 'filters', 'profile']

export default function SettingsContent() {
  const { t } = useI18n()
  const { user, signOut } = useAuth()
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('general')
  const [settings, setSettings] = useState<Settings>(DEFAULTS)

  useEffect(() => {
    const saved = localStorage.getItem('randoo-settings')
    const fromStorage: Partial<Settings> = saved ? JSON.parse(saved) : {}
    const metaGender = user?.user_metadata?.gender as Sex | undefined
    setSettings({ ...DEFAULTS, ...fromStorage, ...(metaGender ? { yourSex: metaGender } : {}) })
  }, [user])

  function set(key: keyof Settings, value: unknown) {
    const next = { ...settings, [key]: value }
    setSettings(next)
    localStorage.setItem('randoo-settings', JSON.stringify(next))
  }

  async function handleSignOut() {
    localStorage.removeItem('randoo-settings')
    localStorage.removeItem('randoo-theme')
    await signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <>
      {/* Tab bar */}
      <div className="flex border-b" style={{ borderColor: 'var(--theme-border)' }}>
        {TAB_IDS.map(id => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className="flex-1 py-4 text-sm font-semibold transition-colors relative"
            style={{ color: tab === id ? 'var(--theme-text)' : 'var(--theme-text-muted)' }}
          >
            {t(`settings.tab.${id}`)}
            {tab === id && (
              <span
                className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                style={{ background: 'var(--theme-accent)' }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-5 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 56px)' }}>
        {tab === 'general'  && <GeneralTab  s={settings} set={set} />}
        {tab === 'matching' && <MatchingTab s={settings} set={set} />}
        {tab === 'filters'  && <FiltersTab  s={settings} set={set} />}
        {tab === 'profile'  && <ProfileTab  s={settings} set={set} onSignOut={handleSignOut} email={user?.email} />}
      </div>
    </>
  )
}
