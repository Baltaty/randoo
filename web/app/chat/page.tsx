'use client'

import { useEffect, useRef, useState, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getSocket, disconnectSocket } from '@/lib/socket'
import { WebRTCManager } from '@/lib/webrtc'
import { playMatchSound, playDisconnectSound } from '@/lib/sfx'
import { useI18n } from '@/contexts/I18nContext'

type Status = 'connecting' | 'waiting' | 'matched' | 'disconnected'

// Subset of settings used in chat
interface ChatSettings {
  autoRollVideo: boolean
  privacyMode: boolean
  sfxVolume: boolean
  yourSex: string
  lookingFor: string
  countries: string[]
  maxWait: number
}

const CHAT_SETTINGS_DEFAULTS: ChatSettings = {
  autoRollVideo: true,
  privacyMode: false,
  sfxVolume: true,
  yourSex: '',
  lookingFor: 'all',
  countries: [],
  maxWait: 3,
}

function loadChatSettings(): ChatSettings {
  try {
    const saved = localStorage.getItem('randoo-settings')
    if (saved) return { ...CHAT_SETTINGS_DEFAULTS, ...JSON.parse(saved) }
  } catch {}
  return CHAT_SETTINGS_DEFAULTS
}

// ── Icons ────────────────────────────────────

function MicIcon({ muted }: { muted: boolean }) {
  if (muted) return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="1" y1="1" x2="23" y2="23"/>
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/>
      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/>
      <line x1="12" y1="19" x2="12" y2="23"/>
      <line x1="8" y1="23" x2="16" y2="23"/>
    </svg>
  )
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
      <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
      <line x1="12" y1="19" x2="12" y2="23"/>
      <line x1="8" y1="23" x2="16" y2="23"/>
    </svg>
  )
}

function CamIcon({ off }: { off: boolean }) {
  if (off) return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34"/>
      <path d="M23 7l-7 5 7 5V7z"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  )
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="23 7 16 12 23 17 23 7"/>
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
    </svg>
  )
}

// ── Main chat component ──────────────────────

function ChatContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t } = useI18n()

  // URL params from boost page override settings
  const urlWantGender = searchParams.get('wantGender') || undefined

  const localVideoRef  = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const webrtcRef      = useRef<WebRTCManager>(new WebRTCManager())
  const roomIdRef      = useRef<string | null>(null)
  const settingsRef    = useRef<ChatSettings>(CHAT_SETTINGS_DEFAULTS)

  const [status, setStatus]           = useState<Status>('connecting')
  const [isMuted, setIsMuted]         = useState(false)
  const [isCameraOff, setIsCameraOff] = useState(false)
  const onlineCount = 10229

  // Load settings once before socket connects
  useEffect(() => {
    settingsRef.current = loadChatSettings()
  }, [])

  const handleRemoteStream = useCallback((stream: MediaStream) => {
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = stream
  }, [])

  const joinQueue = useCallback(() => {
    const s = settingsRef.current
    const socket = getSocket()
    setStatus('waiting')
    roomIdRef.current = null

    socket.emit('join', {
      // Privacy mode: hide your gender from server
      gender:     s.privacyMode ? undefined : (s.yourSex || undefined),
      // Boost URL param takes priority over settings lookingFor
      wantGender: urlWantGender ?? (s.lookingFor === 'all' ? undefined : s.lookingFor),
      countries:  s.countries,
      maxWait:    s.maxWait,
    })
  }, [urlWantGender])

  const handleNext = useCallback(() => {
    const socket = getSocket()
    const webrtc = webrtcRef.current
    if (roomIdRef.current) socket.emit('next', { roomId: roomIdRef.current })
    webrtc.closePeerConnection()
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null
    joinQueue()
  }, [joinQueue])

  // Keyboard shortcut: Esc = Next
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleNext() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleNext])

  useEffect(() => {
    const webrtc = webrtcRef.current
    const socket = getSocket()

    async function init() {
      if (localVideoRef.current) await webrtc.startLocalStream(localVideoRef.current)
      socket.connect()

      socket.on('connect', joinQueue)
      socket.on('waiting', () => setStatus('waiting'))

      socket.on('matched', async ({ roomId, initiator }: { roomId: string; initiator: boolean }) => {
        roomIdRef.current = roomId
        setStatus('matched')
        if (settingsRef.current.sfxVolume) playMatchSound()

        const onIce = (c: RTCIceCandidate) => socket.emit('ice-candidate', { roomId, candidate: c.toJSON() })
        webrtc.createPeerConnection(handleRemoteStream, onIce)
        if (initiator) {
          const offer = await webrtc.createOffer()
          socket.emit('offer', { roomId, offer })
        }
      })

      socket.on('offer', async ({ offer }: { offer: RTCSessionDescriptionInit }) => {
        const answer = await webrtc.handleOffer(offer)
        socket.emit('answer', { roomId: roomIdRef.current, answer })
      })

      socket.on('answer', async ({ answer }: { answer: RTCSessionDescriptionInit }) => {
        await webrtc.handleAnswer(answer)
      })

      socket.on('ice-candidate', async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
        await webrtc.addIceCandidate(candidate)
      })

      socket.on('peer-disconnected', () => {
        webrtc.closePeerConnection()
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null

        if (settingsRef.current.autoRollVideo) {
          // Auto-roll: silently find next person
          joinQueue()
        } else {
          if (settingsRef.current.sfxVolume) playDisconnectSound()
          setStatus('disconnected')
        }
      })
    }

    init().catch(console.error)

    return () => {
      socket.off('connect'); socket.off('waiting'); socket.off('matched')
      socket.off('offer'); socket.off('answer'); socket.off('ice-candidate')
      socket.off('peer-disconnected')
      webrtc.destroy()
      disconnectSocket()
    }
  }, [handleRemoteStream, joinQueue])

  const toggleMute   = () => setIsMuted(webrtcRef.current.toggleMute())
  const toggleCamera = () => setIsCameraOff(webrtcRef.current.toggleCamera())

  return (
    <div className="h-screen w-screen bg-black flex flex-col overflow-hidden">

      {/* ── Header ── */}
      <header className="flex-shrink-0 flex items-center justify-between px-6 py-3 z-30 border-b border-white/5"
        style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)' }}>

        {/* Logo */}
        <button onClick={() => router.push('/')} className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
          <svg width="22" height="26" viewBox="0 0 44 52" fill="none">
            <path d="M26 0L0 30H18L18 52L44 22H26L26 0Z" fill="var(--theme-accent)"/>
          </svg>
          <span className="font-bold text-xl" style={{ letterSpacing: '-0.5px', color: 'var(--theme-text)' }}>randoo</span>
        </button>

        {/* Right controls */}
        <div className="flex items-center gap-3">
          {/* Online count */}
          <div className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border"
            style={{ color: 'var(--theme-text)', borderColor: 'var(--theme-border)', background: 'var(--theme-surface)' }}>
            <span className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: 'var(--color-success)', boxShadow: '0 0 6px var(--color-success)' }} />
            {t('chat.online', { n: onlineCount.toLocaleString('en-US') })}
          </div>

          {/* Boost */}
          <button
            onClick={() => router.push('/boost')}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all hover:brightness-90 active:scale-95"
            style={{ background: 'var(--theme-accent)', color: 'var(--theme-btn-fg)' }}
          >
            <svg width="14" height="14" viewBox="0 0 44 52" fill="currentColor">
              <path d="M26 0L0 30H18L18 52L44 22H26L26 0Z"/>
            </svg>
            {t('chat.boost')}
          </button>

          {/* Settings */}
          <button
            onClick={() => router.push('/settings')}
            className="w-9 h-9 rounded-full flex items-center justify-center transition-all hover:opacity-70"
            style={{ color: 'var(--theme-text-muted)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </button>
        </div>
      </header>

      {/* ── Video area ── */}
      <div className="flex-1 relative overflow-hidden bg-black">

        {/* Remote video */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Status overlay */}
        {status !== 'matched' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-10">
            {status === 'connecting' && (
              <>
                <div className="w-10 h-10 rounded-full border-2 animate-spin mb-4"
                  style={{ borderColor: 'rgba(var(--theme-accent-rgb), 0.3)', borderTopColor: 'var(--theme-accent)', borderStyle: 'solid' }} />
                <p className="text-sm font-medium" style={{ color: 'var(--theme-text-muted)' }}>{t('chat.connecting')}</p>
              </>
            )}
            {status === 'waiting' && (
              <>
                <div className="w-10 h-10 rounded-full border-2 animate-spin mb-5"
                  style={{ borderColor: 'rgba(var(--theme-accent-rgb), 0.25)', borderTopColor: 'var(--theme-accent)', borderStyle: 'solid' }} />
                <p className="font-semibold text-lg mb-1" style={{ color: 'var(--theme-text)' }}>{t('chat.waiting.title')}</p>
                <p className="text-sm" style={{ color: 'var(--theme-text-muted)' }}>{t('chat.waiting.subtitle')}</p>
              </>
            )}
            {status === 'disconnected' && (
              <>
                <p className="text-white font-semibold text-lg mb-1">{t('chat.left.title')}</p>
                <p className="text-white/30 text-sm">{t('chat.left.hint', { key: 'Esc' })}</p>
              </>
            )}
          </div>
        )}

        {/* Local video — PIP bottom-right */}
        <div className="absolute bottom-5 right-5 z-20 rounded-2xl overflow-hidden shadow-2xl"
          style={{ width: 140, height: 190, border: '2px solid rgba(255,255,255,0.08)' }}>
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            style={{ transform: 'scaleX(-1)' }}
          />
          {isCameraOff && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/90">
              <CamIcon off />
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom bar ── */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-t border-white/5 z-30"
        style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)' }}>

        {/* New / Esc button */}
        <button
          onClick={handleNext}
          className="flex flex-col items-center justify-center px-8 py-3 rounded-2xl font-semibold transition-all active:scale-95 hover:brightness-90 min-w-[90px]"
          style={{ background: 'var(--theme-accent)', color: 'var(--theme-btn-fg)' }}
        >
          <span className="text-base font-bold leading-tight">{t('chat.new')}</span>
          <span className="text-xs font-medium leading-tight" style={{ opacity: 0.5 }}>Esc</span>
        </button>

        {/* Mic + Cam toggles */}
        <div className="flex items-center gap-3">
          <button
            onClick={toggleMute}
            className="flex items-center gap-2 px-4 py-3 rounded-xl font-medium text-sm transition-all active:scale-95"
            style={{
              background: isMuted ? 'var(--color-error)' : 'rgba(255,255,255,0.08)',
              color: isMuted ? '#fff' : 'rgba(255,255,255,0.6)',
            }}
          >
            <MicIcon muted={isMuted} />
          </button>

          <button
            onClick={toggleCamera}
            className="flex items-center gap-2 px-4 py-3 rounded-xl font-medium text-sm transition-all active:scale-95"
            style={{
              background: isCameraOff ? 'var(--color-error)' : 'rgba(255,255,255,0.08)',
              color: isCameraOff ? '#fff' : 'rgba(255,255,255,0.6)',
            }}
          >
            <CamIcon off={isCameraOff} />
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ChatPage() {
  return (
    <Suspense>
      <ChatContent />
    </Suspense>
  )
}
