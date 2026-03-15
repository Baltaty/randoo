import type { Metadata } from 'next'
import Script from 'next/script'
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
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'Randoo' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Randoo - Talk to Strangers & Random Video Chat',
    description: 'Free random video chat. Meet strangers instantly and anonymously.',
    images: ['/opengraph-image'],
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
        <script src="https://t.contentsquare.net/uxa/8e0e4fddeae23.js" async />
      </head>
      <body>
        <Script id="meta-pixel" strategy="afterInteractive">{`
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window, document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '471242474063298');
          fbq('track', 'PageView');
        `}</Script>
        <noscript>
          <img height="1" width="1" style={{display:'none'}}
            src="https://www.facebook.com/tr?id=471242474063298&ev=PageView&noscript=1"
          />
        </noscript>
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
