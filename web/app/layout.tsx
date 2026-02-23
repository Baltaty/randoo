import type { Metadata } from 'next'
import './globals.css'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { I18nProvider } from '@/contexts/I18nContext'
import { AuthProvider } from '@/contexts/AuthContext'

export const metadata: Metadata = {
  title: 'Randoo - Talk to Strangers & Random Video Chat',
  description: 'Randoo is a free random video chat. Meet strangers instantly, anonymously — no sign-up required. The best Omegle alternative.',
  keywords: ['random video chat', 'talk to strangers', 'omegle alternative', 'video chat', 'meet strangers', 'random chat'],
  metadataBase: new URL('https://randoo.fun'),
  openGraph: {
    title: 'Randoo - Talk to Strangers & Random Video Chat',
    description: 'Free random video chat. Meet strangers instantly and anonymously.',
    url: 'https://randoo.fun',
    siteName: 'Randoo',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Randoo - Talk to Strangers & Random Video Chat',
    description: 'Free random video chat. Meet strangers instantly and anonymously.',
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: 'https://randoo.fun',
  },
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          href="https://api.fontshare.com/v2/css?f[]=clash-grotesk@400,500,600,700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ThemeProvider>
          <I18nProvider>
            <AuthProvider>
              {children}
            </AuthProvider>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
