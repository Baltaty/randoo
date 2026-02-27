'use client'

import { useEffect, useRef, useState, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getSocket, disconnectSocket } from '@/lib/socket'
import { WebRTCManager } from '@/lib/webrtc'
import { playMatchSound, playDisconnectSound } from '@/lib/sfx'
import { useI18n } from '@/contexts/I18nContext'
import { useAuth } from '@/contexts/AuthContext'

type Status = 'connecting' | 'waiting' | 'matched' | 'disconnected'

// ISO 3166-1 alpha-2 → flag emoji + display name
function countryInfo(code: string): { flag: string; name: string } {
  const flag = code.toUpperCase().split('').map(c =>
    String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)
  ).join('')
  const name = new Intl.DisplayNames(['en'], { type: 'region' }).of(code) ?? code
  return { flag, name }
}

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

function getSavedDevices(): { cameraId: string; micId: string } {
  try {
    const s = localStorage.getItem('randoo-devices')
    return s ? { cameraId: '', micId: '', ...JSON.parse(s) } : { cameraId: '', micId: '' }
  } catch {
    return { cameraId: '', micId: '' }
  }
}

function saveDevices(cameraId: string, micId: string) {
  localStorage.setItem('randoo-devices', JSON.stringify({ cameraId, micId }))
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

function SlidersIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/>
      <line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/>
      <line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/>
      <line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/>
      <line x1="17" y1="16" x2="23" y2="16"/>
    </svg>
  )
}

function MonitorIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
      <line x1="8" y1="21" x2="16" y2="21"/>
      <line x1="12" y1="17" x2="12" y2="21"/>
    </svg>
  )
}

function SpeakerIcon({ muted }: { muted: boolean }) {
  if (muted) return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
      <line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>
    </svg>
  )
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
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
  const { user } = useAuth()

  // URL params (present only when coming directly from boost/success)
  const urlBoostToken   = searchParams.get('boost')        || undefined
  const urlWantGender   = searchParams.get('wantGender')   || undefined
  const urlBoostExpires = searchParams.get('boostExpires') || undefined
  const urlInterests    = searchParams.get('interests')?.split(',').filter(Boolean) ?? []
  const interestsRef    = useRef<string[]>(urlInterests)

  // Active boost — resolved from URL params (priority) or localStorage (persists across navigation)
  type ActiveBoost = { token: string; wantGender: string; expiresAt: string }
  const [resolvedBoost, setResolvedBoost] = useState<ActiveBoost | null>(null)
  // Ref so joinQueue always reads the latest boost without being a dep
  const boostRef = useRef<ActiveBoost | null>(null)
  boostRef.current = resolvedBoost

  const localVideoRef  = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const webrtcRef          = useRef<WebRTCManager>(new WebRTCManager())
  const roomIdRef          = useRef<string | null>(null)
  const settingsRef        = useRef<ChatSettings>(CHAT_SETTINGS_DEFAULTS)
  const connectionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Unique per page-load — server uses this to prevent self-match on socket reconnect
  const sessionIdRef       = useRef<string>(crypto.randomUUID())
  // Always up-to-date user ref — avoids race condition between auth loading and socket connect
  const userRef            = useRef(user)
  userRef.current          = user

  const [status, setStatus]               = useState<Status>('connecting')
  const [isMuted, setIsMuted]             = useState(false)
  const [isCameraOff, setIsCameraOff]     = useState(false)
  const [matchToast, setMatchToast]       = useState<string | null>(null)
  const matchToastTimerRef                = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [boostSecsLeft, setBoostSecsLeft] = useState<number | null>(null)
  const [onlineCount, setOnlineCount]     = useState<number | null>(null)

  // Device controls
  const [showDeviceMenu, setShowDeviceMenu]   = useState(false)
  const [showDevicesModal, setShowDevicesModal] = useState(false)
  const [isRemoteMuted, setIsRemoteMuted]     = useState(false)
  const [cameras, setCameras]                 = useState<MediaDeviceInfo[]>([])
  const [microphones, setMicrophones]         = useState<MediaDeviceInfo[]>([])
  const [pendingCameraId, setPendingCameraId] = useState('')
  const [pendingMicId, setPendingMicId]       = useState('')
  const deviceMenuRef                         = useRef<HTMLDivElement>(null)

  // Load settings once on mount
  useEffect(() => {
    settingsRef.current = loadChatSettings()
  }, [])

  // Resolve active boost: URL params first, then localStorage
  useEffect(() => {
    if (urlBoostToken && urlWantGender && urlBoostExpires) {
      // Came directly from boost/success — URL params are authoritative
      setResolvedBoost({ token: urlBoostToken, wantGender: urlWantGender, expiresAt: urlBoostExpires })
      return
    }
    // No URL params — check localStorage (user navigated away and came back)
    try {
      const saved = localStorage.getItem('randoo-boost')
      if (!saved) return
      const b = JSON.parse(saved) as ActiveBoost
      if (new Date(b.expiresAt) > new Date()) {
        setResolvedBoost(b)
      } else {
        localStorage.removeItem('randoo-boost')
      }
    } catch {
      localStorage.removeItem('randoo-boost')
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // When user metadata loads (async), update gender in settings and re-join if still waiting
  useEffect(() => {
    const metaGender = user?.user_metadata?.gender
    if (!metaGender) return
    settingsRef.current.yourSex = metaGender
    // If socket already connected but user wasn't loaded yet, re-join with correct gender
    const socket = getSocket()
    if (socket.connected && (status === 'waiting' || status === 'connecting')) {
      joinQueue()
    }
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  // Boost countdown — driven by resolvedBoost (survives navigation)
  useEffect(() => {
    if (!resolvedBoost) return
    const expiresAt = new Date(resolvedBoost.expiresAt).getTime()

    const tick = () => {
      const secs = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000))
      setBoostSecsLeft(secs)
      if (secs === 0) {
        clearInterval(id)
        localStorage.removeItem('randoo-boost')
        setResolvedBoost(null)
      }
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [resolvedBoost?.expiresAt]) // eslint-disable-line react-hooks/exhaustive-deps

  function clearConnectionTimer() {
    if (connectionTimerRef.current) {
      clearTimeout(connectionTimerRef.current)
      connectionTimerRef.current = null
    }
  }

  const handleRemoteStream = useCallback((stream: MediaStream) => {
    clearConnectionTimer() // real peer connected — cancel the timeout
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = stream
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const joinQueue = useCallback(() => {
    const s = settingsRef.current
    const socket = getSocket()
    setStatus('waiting')
    roomIdRef.current = null

    // Supabase user_metadata.gender is source of truth — always current via userRef
    const myGender = userRef.current?.user_metadata?.gender || s.yourSex || undefined

    socket.emit('join', {
      sessionId:   sessionIdRef.current,
      privacyMode: s.privacyMode,
      gender:      s.privacyMode ? undefined : myGender,
      // Boost token (from Stripe payment) unlocks wantGender filter server-side
      boostToken:  boostRef.current?.token,
      wantGender:  boostRef.current?.wantGender ?? (s.lookingFor === 'all' ? undefined : s.lookingFor),
      countries:   s.countries,
      maxWait:     s.maxWait,
      interests:   interestsRef.current,
    })
  }, [urlWantGender, urlBoostToken])

  const handleNext = useCallback(() => {
    const socket = getSocket()
    const webrtc = webrtcRef.current
    clearConnectionTimer()
    if (roomIdRef.current) socket.emit('next', { roomId: roomIdRef.current })
    webrtc.closePeerConnection()
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null
    joinQueue()
  }, [joinQueue]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard shortcut: Esc = Next
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleNext() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleNext])

  // Close device popup on outside click
  useEffect(() => {
    if (!showDeviceMenu) return
    const handler = (e: MouseEvent) => {
      if (deviceMenuRef.current && !deviceMenuRef.current.contains(e.target as Node)) {
        setShowDeviceMenu(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showDeviceMenu])

  useEffect(() => {
    const webrtc = webrtcRef.current
    const socket = getSocket()

    async function init() {
      // Register all handlers BEFORE connecting so no event is missed
      socket.on('connect', joinQueue)
      socket.on('waiting', () => setStatus('waiting'))
      socket.on('online-count', (n: number) => setOnlineCount(n + 1998))

      socket.on('matched', async ({ roomId, initiator, peerCountry, commonInterests }: { roomId: string; initiator: boolean; peerCountry?: string; commonInterests?: string[] }) => {
        roomIdRef.current = roomId
        setStatus('matched')
        if (settingsRef.current.sfxVolume) playMatchSound()

        // Build toast: common interests (if any), then country
        if (matchToastTimerRef.current) clearTimeout(matchToastTimerRef.current)
        let toast = `You're now connected with a random stranger`
        if (peerCountry) {
          const { flag, name } = countryInfo(peerCountry)
          toast = `You're now connected with someone from ${name} ${flag}`
        }
        if (commonInterests && commonInterests.length > 0) {
          toast += ` · Both into: ${commonInterests.join(', ')}`
        }
        setMatchToast(toast)
        matchToastTimerRef.current = setTimeout(() => setMatchToast(null), 5000)

        // Safety net: if no remote stream arrives within 8s, the match failed
        // (self-match race condition, ICE stuck in 'new', peer immediately gone, etc.)
        clearConnectionTimer()
        connectionTimerRef.current = setTimeout(() => {
          console.warn('[chat] connection timeout — no video after 8s, rejoining queue')
          webrtc.closePeerConnection()
          if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null
          joinQueue()
        }, 8000)

        const onIce = (c: RTCIceCandidate) => socket.emit('ice-candidate', { roomId, candidate: c.toJSON() })
        const onConnectionFailed = () => {
          console.warn('[webrtc] ICE failed — rejoining queue')
          clearConnectionTimer()
          webrtc.closePeerConnection()
          if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null
          joinQueue()
        }
        webrtc.createPeerConnection(handleRemoteStream, onIce, onConnectionFailed)
        if (initiator) {
          const offer = await webrtc.createOffer()
          socket.emit('offer', { roomId, offer })
        }
      })

      socket.on('offer', async ({ offer }: { offer: RTCSessionDescriptionInit }) => {
        try {
          const answer = await webrtc.handleOffer(offer)
          socket.emit('answer', { roomId: roomIdRef.current, answer })
        } catch (err) {
          console.warn('[chat] offer handling failed — rejoining queue:', err)
          webrtc.closePeerConnection()
          if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null
          joinQueue()
        }
      })

      socket.on('answer', async ({ answer }: { answer: RTCSessionDescriptionInit }) => {
        await webrtc.handleAnswer(answer)
      })

      socket.on('ice-candidate', async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
        await webrtc.addIceCandidate(candidate)
      })

      // Unexpected socket disconnect (network, server restart, tab throttled in background)
      // Socket.io will auto-reconnect; 'connect' will fire again → joinQueue()
      socket.on('disconnect', (reason) => {
        console.warn('[socket] disconnected:', reason)
        if (reason !== 'io client disconnect') {
          setStatus('connecting')
          webrtc.closePeerConnection()
          if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null
        }
      })

      socket.on('peer-disconnected', () => {
        clearConnectionTimer()
        if (matchToastTimerRef.current) clearTimeout(matchToastTimerRef.current)
        setMatchToast(null)
        webrtc.closePeerConnection()
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null

        if (settingsRef.current.autoRollVideo) {
          joinQueue()
        } else {
          if (settingsRef.current.sfxVolume) playDisconnectSound()
          setStatus('disconnected')
        }
      })

      // Start camera before connecting — ensures local tracks are ready when
      // createPeerConnection is called. Fault-tolerant: socket connects even if camera fails.
      try {
        if (localVideoRef.current) {
          const saved = getSavedDevices()
          await webrtc.startLocalStreamWithDevices(
            localVideoRef.current,
            saved.cameraId || undefined,
            saved.micId || undefined,
          )
        }
      } catch (err) {
        console.warn('Camera unavailable:', err)
      }

      socket.connect()
    }

    init().catch(console.error)

    return () => {
      clearConnectionTimer()
      if (matchToastTimerRef.current) clearTimeout(matchToastTimerRef.current)
      socket.removeAllListeners()
      webrtc.destroy()
      disconnectSocket()
    }
  }, [handleRemoteStream, joinQueue])

  const toggleMute   = () => setIsMuted(webrtcRef.current.toggleMute())
  const toggleCamera = () => setIsCameraOff(webrtcRef.current.toggleCamera())

  const openDeviceMenu = async () => {
    const nextOpen = !showDeviceMenu
    setShowDeviceMenu(nextOpen)
    if (nextOpen) {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        const cams = devices.filter(d => d.kind === 'videoinput')
        const mics = devices.filter(d => d.kind === 'audioinput')
        setCameras(cams)
        setMicrophones(mics)
        setPendingCameraId(webrtcRef.current.getCurrentVideoDeviceId() ?? cams[0]?.deviceId ?? '')
        setPendingMicId(webrtcRef.current.getCurrentAudioDeviceId() ?? mics[0]?.deviceId ?? '')
      } catch {}
    }
  }

  const toggleRemoteSound = () => {
    if (remoteVideoRef.current) {
      const next = !remoteVideoRef.current.muted
      remoteVideoRef.current.muted = next
      setIsRemoteMuted(next)
    }
  }

  const handleSaveDevices = async () => {
    const webrtc = webrtcRef.current
    try {
      if (pendingCameraId && pendingCameraId !== webrtc.getCurrentVideoDeviceId() && localVideoRef.current) {
        await webrtc.switchCamera(localVideoRef.current, pendingCameraId)
      }
      if (pendingMicId && pendingMicId !== webrtc.getCurrentAudioDeviceId()) {
        await webrtc.switchMicrophone(pendingMicId)
      }
      saveDevices(pendingCameraId, pendingMicId)
    } catch (err) {
      console.warn('Failed to switch device:', err)
    }
    setShowDevicesModal(false)
  }

  function formatBoostTime(secs: number) {
    const m = Math.floor(secs / 60).toString().padStart(2, '0')
    const s = (secs % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  return (
    <>
    <div className="h-screen w-screen bg-black flex flex-col overflow-hidden">

      {/* ── Header ── */}
      <header className="flex-shrink-0 flex items-center justify-between px-6 py-3 z-30 border-b border-white/5"
        style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)' }}>

        {/* Logo */}
        <button onClick={() => router.push('/')} className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
          <svg width="22" height="26" viewBox="0 0 44 52" fill="none">
            <path d="M 10 18 C 10 8 34 8 34 18 C 34 26 24 28 22 32"
              stroke="var(--theme-accent)" strokeWidth="9" strokeLinecap="round"/>
            <circle cx="22" cy="46" r="5" fill="var(--theme-accent)"/>
          </svg>
          <span className="font-bold text-xl" style={{ letterSpacing: '-0.5px', color: 'var(--theme-text)' }}>randoo</span>
        </button>

        {/* Right controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Online count */}
          <div className="flex items-center gap-1.5 px-2.5 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-semibold border whitespace-nowrap"
            style={{ color: 'var(--theme-text)', borderColor: 'var(--theme-border)', background: 'var(--theme-surface)' }}>
            <span className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: 'var(--color-success)', boxShadow: '0 0 6px var(--color-success)' }} />
            {onlineCount === null ? '…' : t('chat.online', { n: onlineCount.toLocaleString('en-US') })}
          </div>

          {/* Boost button — hidden when boost is active (banner shown instead) */}
          {!(boostSecsLeft !== null && boostSecsLeft > 0) && (
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
          )}

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

      {/* ── Boost countdown banner ── */}
      {boostSecsLeft !== null && boostSecsLeft > 0 && (
        <div className="flex-shrink-0 flex items-center justify-center gap-2 py-1.5 text-xs font-semibold"
          style={{ background: 'var(--theme-accent)', color: 'var(--theme-btn-fg)' }}>
          <svg width="11" height="11" viewBox="0 0 44 52" fill="currentColor">
            <path d="M26 0L0 30H18L18 52L44 22H26L26 0Z"/>
          </svg>
          Boost active — {formatBoostTime(boostSecsLeft)} remaining
        </div>
      )}

      {/* ── Video area ── */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-black">

        {/* Remote video (left half) */}
        <div className="flex-1 relative overflow-hidden bg-black">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
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

          {/* Match toast */}
          {matchToast && (
            <div className="absolute top-4 left-1/2 z-30 pointer-events-none"
              style={{ transform: 'translateX(-50%)', animation: 'fadeInDown 0.3s ease' }}>
              <div className="px-4 py-2.5 rounded-2xl text-sm font-medium text-white text-center max-w-xs"
                style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.1)' }}>
                {matchToast}
              </div>
            </div>
          )}

          {/* Watermark */}
          <div className="absolute bottom-3 left-3 z-20 flex items-center gap-1.5 pointer-events-none select-none"
            style={{ opacity: 0.35 }}>
            <svg width="16" height="20" viewBox="0 0 44 52" fill="none">
              <path d="M 10 18 C 10 8 34 8 34 18 C 34 26 24 28 22 32"
                stroke="white" strokeWidth="9" strokeLinecap="round"/>
              <circle cx="22" cy="46" r="5" fill="white"/>
            </svg>
            <span className="text-white font-bold italic text-base tracking-tight" style={{ fontSize: 17 }}>
              randoo.fun
            </span>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px md:h-auto md:w-px flex-shrink-0" style={{ background: 'rgba(255,255,255,0.06)' }} />

        {/* Local video (right half) */}
        <div className="flex-1 relative overflow-hidden" style={{ background: '#0d0d0d' }}>
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            style={{ transform: 'scaleX(-1)' }}
          />
          {isCameraOff && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/90 z-10">
              <CamIcon off />
            </div>
          )}

          {/* Label */}
          <div className="absolute bottom-3 left-3 z-20 px-2.5 py-1 rounded-lg text-xs font-semibold"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', color: 'rgba(255,255,255,0.7)' }}>
            You
          </div>

          {/* Device controls — top-right of local video */}
          <div ref={deviceMenuRef} className="absolute top-3 right-3" style={{ zIndex: 25 }}>
          <button
            onClick={openDeviceMenu}
            className="w-9 h-9 rounded-full flex items-center justify-center transition-all hover:opacity-90 active:scale-95"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)', color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <SlidersIcon />
          </button>

          {showDeviceMenu && (
            <div
              className="absolute top-11 right-0 rounded-2xl p-2.5 grid grid-cols-3 gap-1"
              style={{ background: 'rgba(30,30,30,0.96)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)', minWidth: 230, boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}
            >
              <button
                onClick={() => { setShowDevicesModal(true); setShowDeviceMenu(false) }}
                className="flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl transition-all hover:bg-white/8"
                style={{ color: 'rgba(255,255,255,0.75)' }}
              >
                <MonitorIcon />
                <span className="text-[11px] font-medium">Devices</span>
              </button>

              <button
                onClick={toggleRemoteSound}
                className="flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl transition-all hover:bg-white/8"
                style={{ color: isRemoteMuted ? 'var(--color-error)' : 'rgba(255,255,255,0.75)' }}
              >
                <SpeakerIcon muted={isRemoteMuted} />
                <span className="text-[11px] font-medium">Sound ({isRemoteMuted ? 'Off' : 'On'})</span>
              </button>

              <button
                onClick={toggleCamera}
                className="flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl transition-all hover:bg-white/8"
                style={{ color: isCameraOff ? 'var(--color-error)' : 'rgba(255,255,255,0.75)' }}
              >
                <CamIcon off={isCameraOff} />
                <span className="text-[11px] font-medium">Video ({isCameraOff ? 'Off' : 'On'})</span>
              </button>

              <button
                onClick={toggleMute}
                className="flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl transition-all hover:bg-white/8"
                style={{ color: isMuted ? 'var(--color-error)' : 'rgba(255,255,255,0.75)' }}
              >
                <MicIcon muted={isMuted} />
                <span className="text-[11px] font-medium">Mic ({isMuted ? 'Off' : 'On'})</span>
              </button>
            </div>
          )}
          </div>{/* end deviceMenuRef */}
        </div>{/* end local video */}
      </div>{/* end flex video area */}

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

        {/* Mic + Cam toggles (kept for quick access) */}
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

    {/* Devices modal */}
    {showDevicesModal && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center px-4"
        style={{ background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(6px)' }}
        onMouseDown={e => { if (e.target === e.currentTarget) setShowDevicesModal(false) }}
      >
        <div className="w-full max-w-md rounded-2xl p-6" style={{ background: '#111', border: '1px solid var(--theme-border)' }}>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-white font-bold text-xl">Devices</h2>
            <button
              onClick={() => setShowDevicesModal(false)}
              className="text-white/40 hover:text-white transition-colors text-lg leading-none"
            >✕</button>
          </div>

          <p className="text-white/50 text-sm font-semibold mb-2">Audio</p>
          <select
            value={pendingMicId}
            onChange={e => setPendingMicId(e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-sm outline-none"
            style={{ background: '#1a1a1a', color: 'white', border: '1px solid var(--theme-border)' }}
          >
            {microphones.map(m => (
              <option key={m.deviceId} value={m.deviceId}>
                {m.label || `Microphone (${m.deviceId.slice(0, 8)})`}
              </option>
            ))}
          </select>

          <div className="my-4" style={{ borderTop: '1px solid var(--theme-border)' }} />

          <p className="text-white/50 text-sm font-semibold mb-2">Video</p>
          <select
            value={pendingCameraId}
            onChange={e => setPendingCameraId(e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-sm outline-none"
            style={{ background: '#1a1a1a', color: 'white', border: '1px solid var(--theme-border)' }}
          >
            {cameras.map(c => (
              <option key={c.deviceId} value={c.deviceId}>
                {c.label || `Camera (${c.deviceId.slice(0, 8)})`}
              </option>
            ))}
          </select>

          <div className="flex justify-end mt-6">
            <button
              onClick={handleSaveDevices}
              className="px-8 py-2.5 rounded-full font-bold text-sm transition-all hover:brightness-90 active:scale-95"
              style={{ background: 'white', color: '#000' }}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}

export default function ChatPage() {
  return (
    <Suspense>
      <ChatContent />
    </Suspense>
  )
}
