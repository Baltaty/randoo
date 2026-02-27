import 'dotenv/config'
import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import { setupMatchmaking, getStats } from './matchmaking'

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
  : [
      'https://randoo.fun',
      'https://www.randoo.fun',
      'https://randoo-psi.vercel.app',
      'http://localhost:3000',
    ]

const app = express()
app.use(cors({ origin: ALLOWED_ORIGINS }))

const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: { origin: ALLOWED_ORIGINS, methods: ['GET', 'POST'] },
})

// Health endpoint — exposes live online count
app.get('/health', (_req, res) => res.json({
  status: 'ok',
  onlineCount: io.engine.clientsCount,
}))

// Stats endpoint — used by /cockpit (protected by STATS_SECRET)
app.get('/stats', (req, res) => {
  const secret = process.env.STATS_SECRET
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    res.status(401).json({ error: 'Unauthorized' }); return
  }
  const { queue, rooms } = getStats()
  res.json({ status: 'ok', clients: io.engine.clientsCount, queue, rooms })
})

setupMatchmaking(io)

const PORT = process.env.PORT || 3001
httpServer.listen(PORT, () => {
  console.log(`Randoo signaling server running on :${PORT}`)
})
