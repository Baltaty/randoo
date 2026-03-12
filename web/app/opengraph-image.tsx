import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Randoo - Talk to Strangers & Random Video Chat'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a0a0a',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Subtle radial glow */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 700,
            height: 700,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,213,58,0.12) 0%, transparent 70%)',
          }}
        />

        {/* Logo + name row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 28, marginBottom: 28 }}>
          {/* Randoo logo SVG */}
          <svg width="72" height="86" viewBox="0 0 44 52" fill="none">
            <path
              d="M 10 18 C 10 8 34 8 34 18 C 34 26 24 28 22 32"
              stroke="#ffd53a"
              strokeWidth="9"
              strokeLinecap="round"
            />
            <circle cx="22" cy="46" r="5" fill="#ffd53a" />
          </svg>

          <span
            style={{
              fontSize: 108,
              fontWeight: 800,
              color: 'white',
              letterSpacing: '-4px',
              lineHeight: 1,
            }}
          >
            randoo
          </span>
        </div>

        {/* Tagline */}
        <p
          style={{
            fontSize: 32,
            color: 'rgba(255,255,255,0.5)',
            margin: 0,
            letterSpacing: '0.5px',
          }}
        >
          Talk to Strangers &amp; Random Video Chat
        </p>

        {/* Domain badge */}
        <div
          style={{
            position: 'absolute',
            bottom: 40,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 22px',
            borderRadius: 999,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
          }}
        >
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: '#3beea8',
            }}
          />
          <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 22 }}>randoo.fun</span>
        </div>
      </div>
    ),
    { ...size },
  )
}
