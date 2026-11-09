import { Server, Socket } from 'socket.io'
import geoip from 'geoip-lite'
import {
  Gender, LogEntry,
  verifyBoostToken, sbInsertLog, sbUpdateDuration, sbInsertReport,
} from './supabase'

interface UserInfo {
  socketId:    string
  sessionId:   string     // unique per browser tab/page-load — prevents self-match on reconnect
  country?:    string     // ISO 3166-1 alpha-2, undefined if privacy mode or unknown IP
  gender?:     Gender
  // Hard gender filter — only set with a verified boost token, valid until boostExpiresAt
  wantGender?:     Gender
  boostExpiresAt?: number
  // Free gender preference (no boost) — respected until maxWait, then relaxed like countries
  preferGender?: Gender
  countries:   string[]  // empty = no filter (match anyone)
  interests:   string[]  // declared interests for soft-priority matching
  maxWait:     number    // seconds before country / free gender preference is relaxed
  relaxed:     boolean   // true once maxWait has elapsed in the queue
}

const GENDERS: readonly Gender[] = ['M', 'F', 'O']
const REPORT_REASONS = new Set(['nudity', 'spam', 'harassment', 'underage', 'other'])

const MAX_INTERESTS      = 5
const MAX_INTEREST_LEN   = 32
const MAX_COUNTRIES      = 50
const MAX_WAIT_SECONDS   = 60
const ONLINE_COUNT_EVERY = 2000 // ms — throttle for online-count broadcasts

const queue: UserInfo[] = []
const rooms = new Map<string, [string, string]>() // roomId -> [socketA, socketB]
const socketRoom = new Map<string, string>()      // socketId -> roomId (at most one room per socket)
const waitTimers = new Map<string, ReturnType<typeof setTimeout>>()
// Incremented on every join — lets an async join detect it was superseded
const joinSeq = new Map<string, number>()

// ── Connection log ────────────────────────────

const MAX_LOG = 100
const connectionLog: LogEntry[] = []
const socketToLog = new Map<string, LogEntry>()

function addLog(entry: LogEntry) {
  connectionLog.unshift(entry)
  if (connectionLog.length > MAX_LOG) connectionLog.pop()
}

// ── Input sanitisation ───────────────────────

function isGender(v: unknown): v is Gender {
  return typeof v === 'string' && (GENDERS as readonly string[]).includes(v)
}

function optString(v: unknown, maxLen = 512): string | undefined {
  return typeof v === 'string' && v ? v.slice(0, maxLen) : undefined
}

function sanitizeInterests(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v
    .filter((i): i is string => typeof i === 'string')
    .map(i => i.trim().slice(0, MAX_INTEREST_LEN))
    .filter(Boolean)
    .slice(0, MAX_INTERESTS)
}

function sanitizeCountries(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v
    .filter((c): c is string => typeof c === 'string' && /^[A-Za-z]{2}$/.test(c))
    .map(c => c.toUpperCase())
    .slice(0, MAX_COUNTRIES)
}

function asObject(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? v as Record<string, unknown> : {}
}

// ── IP → country ─────────────────────────────

function resolveIP(socket: Socket): string | undefined {
  const forwarded = socket.handshake.headers['x-forwarded-for']
  const rawIp = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : undefined)
    ?? socket.handshake.address
  const ip = rawIp?.replace(/^::ffff:/, '')
  if (!ip || ip === '127.0.0.1' || ip === '::1') return undefined
  return ip
}

function countryOf(ip: string | undefined): string | undefined {
  return ip ? geoip.lookup(ip)?.country ?? undefined : undefined
}

// ── Matching helpers ─────────────────────────

function hasActiveBoost(user: UserInfo, now: number): boolean {
  return !!user.wantGender && !!user.boostExpiresAt && user.boostExpiresAt > now
}

// Does `user` accept `candidate`'s gender?
function genderAccepts(user: UserInfo, candidate: UserInfo, now: number): boolean {
  if (hasActiveBoost(user, now)) return user.wantGender === candidate.gender
  if (user.preferGender && !user.relaxed) return user.preferGender === candidate.gender
  return true
}

function genderOk(user: UserInfo, candidate: UserInfo, now: number): boolean {
  return genderAccepts(user, candidate, now) && genderAccepts(candidate, user, now)
}

// Does `user`'s country filter accept `candidate`?
// Empty filter, unknown country or relaxed user (waited > maxWait) = accepted.
function countryAccepts(user: UserInfo, candidate: UserInfo): boolean {
  if (user.relaxed || user.countries.length === 0) return true
  if (!candidate.country) return true
  return user.countries.includes(candidate.country)
}

function countriesOk(user: UserInfo, candidate: UserInfo): boolean {
  return countryAccepts(user, candidate) && countryAccepts(candidate, user)
}

// Interests in common (case-insensitive), in `a`'s original casing
function commonInterests(a: UserInfo, b: UserInfo): string[] {
  if (!a.interests.length || !b.interests.length) return []
  const bLower = new Set(b.interests.map(i => i.toLowerCase()))
  return a.interests.filter(i => bLower.has(i.toLowerCase()))
}

// Soft gender preferences that are satisfied (only matters once relaxed)
function genderPrefScore(a: UserInfo, b: UserInfo): number {
  return (a.preferGender === b.gender ? 1 : 0) + (b.preferGender === a.gender ? 1 : 0)
}

function findMatch(user: UserInfo, io: Server): UserInfo | null {
  const now = Date.now()
  const stale: string[] = []
  let best: { info: UserInfo; pref: number; interests: number } | null = null

  for (const candidate of queue) {
    // Skip sockets that are no longer connected (stale due to reconnect race condition)
    if (!io.sockets.sockets.has(candidate.socketId)) { stale.push(candidate.socketId); continue }
    if (candidate.socketId === user.socketId) continue
    // Never match two sockets from the same browser tab/page-load
    if (candidate.sessionId === user.sessionId) continue
    if (!genderOk(user, candidate, now)) continue
    if (!countriesOk(user, candidate)) continue

    const pref = genderPrefScore(user, candidate)
    const interests = commonInterests(user, candidate).length
    // Prioritise satisfied gender preferences, then common interests; ties keep queue order
    if (!best || pref > best.pref || (pref === best.pref && interests > best.interests)) {
      best = { info: candidate, pref, interests }
    }
  }

  // Remove stale entries after iterating (splicing during for…of skips elements)
  for (const id of stale) { removeFromQueue(id); clearTimer(id) }

  return best?.info ?? null
}

// ── Queue helpers ────────────────────────────

function removeFromQueue(socketId: string) {
  const idx = queue.findIndex(u => u.socketId === socketId)
  if (idx !== -1) queue.splice(idx, 1)
}

function clearTimer(socketId: string) {
  const t = waitTimers.get(socketId)
  if (t) { clearTimeout(t); waitTimers.delete(socketId) }
}

// ── Room helpers ─────────────────────────────

function createRoom(a: UserInfo, b: UserInfo, io: Server) {
  removeFromQueue(a.socketId)
  removeFromQueue(b.socketId)
  clearTimer(a.socketId)
  clearTimer(b.socketId)

  const roomId = `r_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  rooms.set(roomId, [a.socketId, b.socketId])
  socketRoom.set(a.socketId, roomId)
  socketRoom.set(b.socketId, roomId)

  const common = commonInterests(a, b)

  // Only reveal a peer's country if they have a country resolved (privacy mode = no country sent)
  io.to(a.socketId).emit('matched', { roomId, initiator: true,  peerCountry: b.country, commonInterests: common })
  io.to(b.socketId).emit('matched', { roomId, initiator: false, peerCountry: a.country, commonInterests: common })

  // Track match start time in both log entries
  const matchedAt = Date.now()
  const logA = socketToLog.get(a.socketId)
  const logB = socketToLog.get(b.socketId)
  if (logA) logA.matchedAt = matchedAt
  if (logB) logB.matchedAt = matchedAt

  console.log(`[match] ${a.socketId} <-> ${b.socketId} → ${roomId} (queue=${queue.length}, rooms=${rooms.size})`)
}

// Close the socket's current room (if any) and notify the peer
function leaveRoom(socketId: string, io: Server) {
  const roomId = socketRoom.get(socketId)
  if (!roomId) return
  const room = rooms.get(roomId)
  socketRoom.delete(socketId)
  rooms.delete(roomId)
  if (!room) return

  const peerId = room[0] === socketId ? room[1] : room[0]
  if (socketRoom.get(peerId) === roomId) socketRoom.delete(peerId)
  io.to(peerId).emit('peer-disconnected', { roomId })

  // Record duration for both participants
  const endedAt = Date.now()
  for (const sid of [socketId, peerId]) {
    const log = socketToLog.get(sid)
    if (log?.matchedAt) {
      log.duration = Math.floor((endedAt - log.matchedAt) / 1000)
      log.matchedAt = undefined
      sbUpdateDuration(log).catch(() => {})
    }
  }

  console.log(`[room] ${roomId} closed — ${socketId} left`)
}

// Peer of `socketId` in `roomId`, only if `socketId` is really in that room
function getPeer(socketId: string, roomId: unknown): string | null {
  if (typeof roomId !== 'string' || socketRoom.get(socketId) !== roomId) return null
  const room = rooms.get(roomId)
  if (!room) return null
  return room[0] === socketId ? room[1] : room[0]
}

// ── Setup ────────────────────────────────────

export function getStats() {
  return { queue: queue.length, rooms: rooms.size, log: connectionLog }
}

export function setupMatchmaking(io: Server) {
  // Throttled online-count broadcast — avoids O(n²) messages under connection churn
  let countTimer: ReturnType<typeof setTimeout> | null = null
  const broadcastCount = () => {
    if (countTimer) return
    countTimer = setTimeout(() => {
      countTimer = null
      io.emit('online-count', io.engine.clientsCount)
    }, ONLINE_COUNT_EVERY)
  }

  io.on('connection', (socket: Socket) => {
    console.log(`[+] ${socket.id}`)
    socket.emit('online-count', io.engine.clientsCount)
    broadcastCount()

    const reportedRooms = new Set<string>()

    socket.on('join', async (raw: unknown) => {
      const data = asObject(raw)
      const seq = (joinSeq.get(socket.id) ?? 0) + 1
      joinSeq.set(socket.id, seq)

      // A join always ends the previous conversation — otherwise the room leaks
      // and the old peer is never told (ghost rooms)
      leaveRoom(socket.id, io)
      removeFromQueue(socket.id)
      clearTimer(socket.id)

      const gender     = isGender(data.gender) ? data.gender : undefined
      const reqGender  = isGender(data.wantGender) ? data.wantGender : undefined
      const boostToken = optString(data.boostToken, 256)

      // Boost token → verified hard gender filter. Without a valid boost, the
      // requested gender is only a soft preference relaxed after maxWait.
      const boost = boostToken ? await verifyBoostToken(boostToken) : null
      // The socket may have left or re-joined while we were awaiting Supabase
      if (!socket.connected || joinSeq.get(socket.id) !== seq) return

      const privacyMode = data.privacyMode === true
      const ip          = resolveIP(socket)
      const country     = privacyMode ? undefined : countryOf(ip)
      const interests   = sanitizeInterests(data.interests)

      if (data.isBot !== true) {
        const logEntry: LogEntry = {
          ts:          Date.now(),
          ip,
          country,
          gender,
          interests,
          referrer:    optString(data.referrer),
          device_type: optString(data.device_type, 32),
          os:          optString(data.os, 32),
          screen:      optString(data.screen, 32),
        }
        addLog(logEntry)
        socketToLog.set(socket.id, logEntry)
        sbInsertLog(logEntry).catch(() => {})
      }

      const maxWait = typeof data.maxWait === 'number' && Number.isFinite(data.maxWait)
        ? Math.min(MAX_WAIT_SECONDS, Math.max(1, data.maxWait))
        : 5

      const user: UserInfo = {
        socketId:       socket.id,
        sessionId:      optString(data.sessionId, 64) ?? socket.id,
        country,
        gender,
        wantGender:     boost?.wantGender,
        boostExpiresAt: boost?.expiresAt,
        preferGender:   boost ? undefined : reqGender,
        countries:      sanitizeCountries(data.countries),
        interests,
        maxWait,
        relaxed:        false,
      }

      // Try strict match (gender + country)
      const match = findMatch(user, io)
      if (match) {
        createRoom(user, match, io)
        return
      }

      // No match yet — add to queue
      queue.push(user)
      socket.emit('waiting')
      console.log(`[queue] ${socket.id} waiting (boost=${!!boost}, wantGender=${user.wantGender ?? user.preferGender ?? 'any'}, queue=${queue.length})`)

      // After maxWait seconds, relax country filter + free gender preference for
      // good (newcomers will see this user as relaxed too) and retry
      const timer = setTimeout(() => {
        waitTimers.delete(socket.id)
        if (!queue.includes(user)) return // already matched or re-joined
        user.relaxed = true
        const fallback = findMatch(user, io)
        if (fallback) createRoom(user, fallback, io)
        // else: user stays in queue (relaxed) until someone compatible arrives
      }, maxWait * 1000)

      waitTimers.set(socket.id, timer)
    })

    // WebRTC signaling relay — roomId is echoed so clients can drop stale messages
    socket.on('offer', (raw: unknown) => {
      const { roomId, offer } = asObject(raw)
      const peerId = getPeer(socket.id, roomId)
      if (peerId) io.to(peerId).emit('offer', { roomId, offer })
    })

    socket.on('answer', (raw: unknown) => {
      const { roomId, answer } = asObject(raw)
      const peerId = getPeer(socket.id, roomId)
      if (peerId) io.to(peerId).emit('answer', { roomId, answer })
    })

    socket.on('ice-candidate', (raw: unknown) => {
      const { roomId, candidate } = asObject(raw)
      const peerId = getPeer(socket.id, roomId)
      if (peerId) io.to(peerId).emit('ice-candidate', { roomId, candidate })
    })

    socket.on('next', (raw: unknown) => {
      const { roomId } = asObject(raw)
      // Ignore a stale "next" aimed at a room we already left
      if (typeof roomId === 'string' && socketRoom.get(socket.id) !== roomId) return
      leaveRoom(socket.id, io)
    })

    socket.on('report', (raw: unknown) => {
      const { roomId, reason } = asObject(raw)
      // Only the participants of the current room can report it, once, with a known reason
      if (typeof roomId !== 'string' || !getPeer(socket.id, roomId)) return
      if (typeof reason !== 'string' || !REPORT_REASONS.has(reason)) return
      if (reportedRooms.has(roomId)) return
      reportedRooms.add(roomId)
      console.log(`[report] ${socket.id} reported in ${roomId} — reason: ${reason}`)
      sbInsertReport(resolveIP(socket), roomId, reason).catch(() => {})
    })

    socket.on('disconnect', () => {
      removeFromQueue(socket.id)
      clearTimer(socket.id)
      leaveRoom(socket.id, io)
      socketToLog.delete(socket.id)
      joinSeq.delete(socket.id)
      console.log(`[-] ${socket.id}`)
      broadcastCount()
    })
  })
}
