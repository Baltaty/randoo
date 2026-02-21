import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import { setupMatchmaking } from './matchmaking'

const app = express()
app.use(cors())
app.get('/health', (_req, res) => res.json({ status: 'ok', queue: 'running' }))

const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
})

setupMatchmaking(io)

const PORT = process.env.PORT || 3001
httpServer.listen(PORT, () => {
  console.log(`Randoo signaling server running on :${PORT}`)
})
