'use client'

import { useRouter } from 'next/navigation'

export default function PrivacyPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen px-4 py-12" style={{ background: 'var(--theme-bg)' }}>
      <div className="max-w-2xl mx-auto">

        {/* Back */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 mb-8 text-sm font-semibold transition-opacity hover:opacity-70"
          style={{ color: 'var(--theme-text-muted)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          Back
        </button>

        <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--theme-text)' }}>Privacy Policy</h1>
        <p className="text-sm mb-10" style={{ color: 'var(--theme-text-muted)' }}>Last updated: February 2026</p>

        {[
          {
            title: '1. Data We Collect',
            body: 'We collect: your email address (for authentication), your declared gender (for matching), your IP address (to determine your country for the matching filter — not stored permanently), and payment information processed by Stripe (we never see your card number).',
          },
          {
            title: '2. Video & Audio',
            body: 'Video and audio streams are transmitted peer-to-peer directly between users via WebRTC. We do not record, store, or have access to the content of your video chats.',
          },
          {
            title: '3. How We Use Your Data',
            body: 'Your email is used solely for authentication. Your gender is used for optional matching preferences. Your country (derived from IP) is used only for the country filter feature and is not stored beyond your active session.',
          },
          {
            title: '4. Third-Party Services',
            body: 'We use Supabase for authentication and data storage, Stripe for payment processing, and Google STUN servers to facilitate peer-to-peer connections. Each of these services has its own privacy policy.',
          },
          {
            title: '5. Data Retention',
            body: 'Your account data is retained until you delete your account. Boost purchase records are retained for accounting purposes as required by law. You may request deletion at any time via Settings → Profile → Delete Account.',
          },
          {
            title: '6. Your Rights (GDPR)',
            body: 'If you are in the EU/EEA, you have the right to access, correct, or delete your personal data, to object to or restrict processing, and to data portability. To exercise these rights, contact us at privacy@randoo.app or use the Delete Account feature in Settings.',
          },
          {
            title: '7. Cookies & Local Storage',
            body: 'We use browser localStorage to store your preferences (theme, language, settings). No tracking cookies are used. No advertising networks have access to your data.',
          },
          {
            title: '8. Security',
            body: 'We use industry-standard security measures including HTTPS, encrypted connections, and Supabase Row-Level Security. However, no system is 100% secure.',
          },
          {
            title: '9. Children',
            body: 'Randoo is not intended for users under 18. We do not knowingly collect data from minors. If you believe a minor has created an account, contact us immediately.',
          },
          {
            title: '10. Contact',
            body: 'For privacy-related questions or requests, contact us at privacy@randoo.app.',
          },
        ].map(({ title, body }) => (
          <div key={title} className="mb-8">
            <h2 className="text-base font-bold mb-2" style={{ color: 'var(--theme-text)' }}>{title}</h2>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--theme-text-muted)' }}>{body}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
