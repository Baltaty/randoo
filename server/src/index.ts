import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import { setupMatchmaking } from './matchmaking'

const ALLOWED_ORIGINS = [
  'https://randoo-psi.vercel.app',
  'http://localhost:3000',
]

const app = express()
app.use(cors({ origin: ALLOWED_ORIGINS }))
app.get('/health', (_req, res) => res.json({ status: 'ok', queue: 'running' }))

const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: { origin: ALLOWED_ORIGINS, methods: ['GET', 'POST'] },
})

setupMatchmaking(io)

const PORT = process.env.PORT || 3001
httpServer.listen(PORT, () => {
  console.log(`Randoo signaling server running on :${PORT}`)
})
