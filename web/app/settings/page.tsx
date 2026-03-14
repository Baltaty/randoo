'use client'

import BottomNav from '@/components/BottomNav'
import SettingsContent from '@/components/SettingsContent'

export default function SettingsPage() {
  return (
    <div className="bg-gradient-hero min-h-screen flex flex-col items-center justify-between px-4 py-8">
      <div className="flex-1 w-full max-w-2xl pt-4">
        <div
          className="rounded-3xl overflow-hidden mb-6"
          style={{ background: 'var(--theme-surface)', border: '1px solid var(--theme-border)' }}
        >
          <SettingsContent />
        </div>
      </div>

      <BottomNav active="settings" />
    </div>
  )
}
