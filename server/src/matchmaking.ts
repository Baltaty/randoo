import { Server, Socket } from 'socket.io'
import geoip from 'geoip-lite'

type Gender = 'M' | 'F' | 'O'

interface UserInfo {
  socketId:    string
  sessionId:   string     // unique per browser tab/page-load — prevents self-match on reconnect
  country?:    string     // ISO 3166-1 alpha-2, undefined if privacy mode or unknown IP
  gender?:     Gender
  wantGender?: Gender     // only set if boost token is valid
  boostActive: boolean
  countries:   string[]  // empty = no filter (match anyone)
  interests:   string[]  // declared interests for soft-priority matching
  maxWait:     number    // seconds before country filter is relaxed
  joinedAt:    number
}

// ── Boost token verification ──────────────

async function verifyBoostToken(token: string): Promise<{ wantGender: Gender } | null> {
  const url  = process.env.SUPABASE_URL
  const key  = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key || !token) return null

  try {
    const res = await fetch(
      `${url}/rest/v1/boost_sessions?session_token=eq.${encodeURIComponent(token)}&select=want_gender,expires_at&limit=1`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } }
    )
    if (!res.ok) return null
    const rows = await res.json() as Array<{ want_gender: string; expires_at: string }>
    if (!rows.length) return null
    const row = rows[0]
    if (new Date(row.expires_at) < new Date()) return null
    return { wantGender: row.want_gender as Gender }
  } catch {
    return null
  }
}

const queue: UserInfo[] = []
const rooms = new Map<string, [string, string]>() // roomId -> [socketA, socketB]
const waitTimers = new Map<string, ReturnType<typeof setTimeout>>()

// ── Connection log ────────────────────────────

interface LogEntry {
  ts:        number
  ip?:       string
  country?:  string
  gender?:   string
  interests: string[]
}

const MAX_LOG = 100
const connectionLog: LogEntry[] = []

function addLog(entry: LogEntry) {
  connectionLog.unshift(entry)
  if (connectionLog.length > MAX_LOG) connectionLog.pop()
}

// ── IP → country ─────────────────────────────

function resolveIP(socket: Socket): string | undefined {
  const forwarded = socket.handshake.headers['x-forwarded-for']
  const rawIp = (typeof forwarded === 'string' ? forwarded.split(',')[0] : undefined)
    ?? socket.handshake.address
  const ip = rawIp?.replace(/^::ffff:/, '')
  if (!ip || ip === '127.0.0.1' || ip === '::1') return undefined
  return ip
}

function resolveCountry(socket: Socket): string | undefined {
  const ip = resolveIP(socket)
  if (!ip) return undefined
  return geoip.lookup(ip)?.country ?? undefined
}

// ── Matching helpers ─────────────────────────

function genderOk(user: UserInfo, candidate: UserInfo): boolean {
  const userWants      = !user.wantGender      || user.wantGender      === candidate.gender
  const candidateWants = !candidate.wantGender || candidate.wantGender === user.gender
  return userWants && candidateWants
}

// Does `filter` (list of wanted countries) accept `actualCountry`?
// Empty filter = no preference = accepts anyone.
// Unknown actual country = benefit of the doubt = accepted.
function filterAccepts(filter: string[], actualCountry: string | undefined): boolean {
  if (filter.length === 0) return true          // no preference
  if (!actualCountry)      return true          // can't determine country → don't block
  return filter.includes(actualCountry)
}

function countriesOk(user: UserInfo, candidate: UserInfo): boolean {
  // Both sides must accept each other
  return filterAccepts(user.countries, candidate.country) &&
         filterAccepts(candidate.countries, user.country)
}

// Returns the number of interests in common (case-insensitive)
function interestScore(a: UserInfo, b: UserInfo): number {
  if (!a.interests.length || !b.interests.length) return 0
  const bLower = b.interests.map(i => i.toLowerCase())
  return a.interests.filter(i => bLower.includes(i.toLowerCase())).length
}

function findMatch(user: UserInfo, io: Server, ignoreCountry = false): UserInfo | null {
  const candidates: Array<{ info: UserInfo; score: number }> = []

  for (const candidate of queue) {
    // Skip sockets that are no longer connected (stale due to reconnect race condition)
    if (!io.sockets.sockets.has(candidate.socketId)) {
      removeFromQueue(candidate.socketId)
      clearTimer(candidate.socketId)
      continue
    }
    // Never match two sockets from the same browser tab/page-load
    if (candidate.sessionId === user.sessionId) continue
    if (!genderOk(user, candidate)) continue
    if (!ignoreCountry && !countriesOk(user, candidate)) continue
    candidates.push({ info: candidate, score: interestScore(user, candidate) })
  }

  if (!candidates.length) return null
  // Prioritise candidates with most common interests; ties keep queue order
  candidates.sort((a, b) => b.score - a.score)
  return candidates[0].info
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

  const bLower = b.interests.map(i => i.toLowerCase())
  const commonInterests = a.interests.filter(i => bLower.includes(i.toLowerCase()))

  // Only reveal a peer's country if they have a country resolved (privacy mode = no country sent)
  io.to(a.socketId).emit('matched', { roomId, initiator: true,  peerGender: b.gender, peerCountry: b.country, commonInterests })
  io.to(b.socketId).emit('matched', { roomId, initiator: false, peerGender: a.gender, peerCountry: a.country, commonInterests })
  console.log(`[match] ${a.socketId} <-> ${b.socketId} → ${roomId}`)
}

function leaveRoom(socketId: string, io: Server) {
  for (const [roomId, [a, b]] of rooms.entries()) {
    if (a === socketId || b === socketId) {
      const peerId = a === socketId ? b : a
      rooms.delete(roomId)
      io.to(peerId).emit('peer-disconnected')
      console.log(`[room] ${roomId} closed — ${socketId} left`)
      break
    }
  }
}

function getPeer(socketId: string, roomId: string): string | null {
  const room = rooms.get(roomId)
  if (!room) return null
  return room[0] === socketId ? room[1] : room[0]
}

// ── Setup ────────────────────────────────────

export function getStats() {
  return { queue: queue.length, rooms: rooms.size, log: connectionLog }
}

export function setupMatchmaking(io: Server) {
  const broadcastCount = () => io.emit('online-count', io.engine.clientsCount)

  io.on('connection', (socket: Socket) => {
    console.log(`[+] ${socket.id}`)
    broadcastCount()

    socket.on('join', async (data: {
      sessionId?:  string
      gender?:     string
      wantGender?: string
      boostToken?: string
      countries?:  string[]
      interests?:  string[]
      maxWait?:    number
      privacyMode?: boolean
    }) => {
      removeFromQueue(socket.id)
      clearTimer(socket.id)

      // Boost token → verified wantGender (priority) + boostActive flag
      // No token → accept wantGender freely from client (soft preference)
      let boostActive = false
      let wantGender: Gender | undefined
      if (data.boostToken) {
        const boost = await verifyBoostToken(data.boostToken)
        if (boost) {
          boostActive = true
          wantGender  = boost.wantGender
        }
      } else if (data.wantGender && (['M', 'F', 'O'] as string[]).includes(data.wantGender)) {
        wantGender = data.wantGender as Gender
      }

      const ip = resolveIP(socket)
      addLog({
        ts:        Date.now(),
        ip,
        country:   data.privacyMode ? undefined : geoip.lookup(ip ?? '')?.country ?? undefined,
        gender:    data.gender,
        interests: Array.isArray(data.interests) ? data.interests.slice(0, 5) : [],
      })

      const user: UserInfo = {
        socketId:    socket.id,
        sessionId:   typeof data.sessionId === 'string' ? data.sessionId : socket.id,
        country:     data.privacyMode ? undefined : resolveCountry(socket),
        gender:      data.gender as Gender | undefined,
        wantGender,
        boostActive,
        countries:   Array.isArray(data.countries) ? data.countries : [],
        interests:   Array.isArray(data.interests)  ? data.interests.slice(0, 5) : [],
        maxWait:     typeof data.maxWait === 'number' ? Math.max(1, data.maxWait) : 5,
        joinedAt:    Date.now(),
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
      console.log(`[queue] ${socket.id} waiting (boost=${boostActive}, wantGender=${wantGender ?? 'any'}, queue=${queue.length})`)

      // After maxWait seconds, relax country filter and retry
      const timer = setTimeout(() => {
        waitTimers.delete(socket.id)
        if (!queue.find(u => u.socketId === socket.id)) return // already matched

        const fallback = findMatch(user, io, true /* ignoreCountry */)
        if (fallback) {
          createRoom(user, fallback, io)
        }
        // else: user stays in queue indefinitely
      }, user.maxWait * 1000)

      waitTimers.set(socket.id, timer)
    })

    socket.on('offer', ({ roomId, offer }: { roomId: string; offer: unknown }) => {
      const peerId = getPeer(socket.id, roomId)
      if (peerId) io.to(peerId).emit('offer', { offer })
    })

    socket.on('answer', ({ roomId, answer }: { roomId: string; answer: unknown }) => {
      const peerId = getPeer(socket.id, roomId)
      if (peerId) io.to(peerId).emit('answer', { answer })
    })

    socket.on('ice-candidate', ({ roomId, candidate }: { roomId: string; candidate: unknown }) => {
      const peerId = getPeer(socket.id, roomId)
      if (peerId) io.to(peerId).emit('ice-candidate', { candidate })
    })

    socket.on('next', ({ roomId }: { roomId: string }) => {
      leaveRoom(socket.id, io)
    })

    socket.on('disconnect', () => {
      removeFromQueue(socket.id)
      clearTimer(socket.id)
      leaveRoom(socket.id, io)
      console.log(`[-] ${socket.id}`)
      broadcastCount()
    })
  })
}
