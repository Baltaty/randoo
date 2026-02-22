'use client'

import { useRouter } from 'next/navigation'

export default function TermsPage() {
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

        <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--theme-text)' }}>Terms of Service</h1>
        <p className="text-sm mb-10" style={{ color: 'var(--theme-text-muted)' }}>Last updated: February 2026</p>

        {[
          {
            title: '1. Acceptance',
            body: 'By accessing or using Randoo, you agree to be bound by these Terms of Service. If you do not agree, do not use the service.',
          },
          {
            title: '2. Eligibility',
            body: 'You must be at least 18 years old to use Randoo. By using this service, you represent that you meet this requirement.',
          },
          {
            title: '3. Prohibited Content',
            body: 'You may not use Randoo to share, display, or transmit: nudity or sexual content, hate speech, harassment or threats, illegal content of any kind, or content involving minors. Violations will result in immediate account termination and may be reported to authorities.',
          },
          {
            title: '4. Your Account',
            body: 'You are responsible for maintaining the confidentiality of your credentials. You are responsible for all activity that occurs under your account.',
          },
          {
            title: '5. Payments & Boost',
            body: 'Boost purchases are non-refundable once activated. Payments are processed securely by Stripe. We do not store your payment card details.',
          },
          {
            title: '6. Termination',
            body: 'We reserve the right to suspend or terminate your account at any time, with or without cause, including for violations of these Terms.',
          },
          {
            title: '7. Disclaimer',
            body: 'Randoo is provided "as is" without warranties of any kind. We are not responsible for the content shared by users during video chats.',
          },
          {
            title: '8. Limitation of Liability',
            body: 'To the maximum extent permitted by law, Randoo shall not be liable for any indirect, incidental, or consequential damages arising from your use of the service.',
          },
          {
            title: '9. Changes',
            body: 'We may update these Terms at any time. Continued use of the service constitutes acceptance of the updated Terms.',
          },
          {
            title: '10. Contact',
            body: 'For questions about these Terms, please contact us at legal@randoo.app.',
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
