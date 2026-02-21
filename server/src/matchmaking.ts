import { Server, Socket } from 'socket.io'

type Gender = 'M' | 'F' | 'O'

interface UserInfo {
  socketId: string
  sessionId: string     // unique per browser tab/page-load — prevents self-match on reconnect
  gender?: Gender
  wantGender?: Gender
  countries: string[]   // empty = no filter (match anyone)
  maxWait: number       // seconds before country filter is relaxed
  joinedAt: number
}

const queue: UserInfo[] = []
const rooms = new Map<string, [string, string]>() // roomId -> [socketA, socketB]
const waitTimers = new Map<string, ReturnType<typeof setTimeout>>()

// ── Matching helpers ─────────────────────────

function genderOk(user: UserInfo, candidate: UserInfo): boolean {
  const userWants      = !user.wantGender      || user.wantGender      === candidate.gender
  const candidateWants = !candidate.wantGender || candidate.wantGender === user.gender
  return userWants && candidateWants
}

function countriesOk(a: string[], b: string[]): boolean {
  if (a.length === 0 || b.length === 0) return true        // at least one has no filter
  return a.some(c => b.includes(c))                        // share at least one country
}

function findMatch(user: UserInfo, io: Server, ignoreCountry = false): UserInfo | null {
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
    if (!ignoreCountry && !countriesOk(user.countries, candidate.countries)) continue
    return candidate
  }
  return null
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

  io.to(a.socketId).emit('matched', { roomId, initiator: true,  peerGender: b.gender })
  io.to(b.socketId).emit('matched', { roomId, initiator: false, peerGender: a.gender })
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

export function setupMatchmaking(io: Server) {
  io.on('connection', (socket: Socket) => {
    console.log(`[+] ${socket.id}`)

    socket.on('join', (data: {
      sessionId?: string
      gender?: string
      wantGender?: string
      countries?: string[]
      maxWait?: number
    }) => {
      removeFromQueue(socket.id)
      clearTimer(socket.id)

      const user: UserInfo = {
        socketId:   socket.id,
        sessionId:  typeof data.sessionId === 'string' ? data.sessionId : socket.id,
        gender:     data.gender    as Gender | undefined,
        wantGender: data.wantGender as Gender | undefined,
        countries:  Array.isArray(data.countries) ? data.countries : [],
        maxWait:    typeof data.maxWait === 'number' ? Math.max(1, data.maxWait) : 5,
        joinedAt:   Date.now(),
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
      console.log(`[queue] ${socket.id} waiting (${queue.length} in queue)`)

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
    })
  })
}
