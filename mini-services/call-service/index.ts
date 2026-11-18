import { createServer } from 'http'
import { Server, type Socket } from 'socket.io'

const httpServer = createServer()
const io = new Server(httpServer, {
  // DO NOT change the path, it is used by Caddy to forward the request to the correct port
  path: '/',
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
})

/**
 * CALL signaling + presence + realtime push service.
 *
 * Client -> Server:
 *  register            { userId, name }
 *  presence:list       {}
 *  call:invite         { callId, to, from:{id,name}, type }
 *  call:respond        { callId, to, action:'accept'|'decline'|'busy' }
 *  call:signal         { to, callId, data:{ kind:'offer'|'answer'|'ice', payload } }
 *  call:end            { to, callId, reason }
 *  msg:new             { to, message }
 *  msg:read            { to, peerId }
 *  typing              { to, peerId, isTyping }
 *
 * Server -> Client:
 *  presence            { userId, online }
 *  presence:list       { ids }
 *  call:incoming       { callId, from, type }
 *  call:respond        { callId, action }
 *  call:signal         { callId, data }
 *  call:end            { callId, reason }
 *  call:unavailable    { callId }
 *  msg:incoming        { message, from }
 *  msg:read            { peerId, at }
 *  typing              { peerId, isTyping }
 */

// userId -> Set<socketId>
const presence = new Map<string, Set<string>>()
// userId -> display name (for logs)
const names = new Map<string, string>()

function socketsOf(userId: string): string[] {
  return Array.from(presence.get(userId) ?? [])
}

function firstSocket(socket: Socket, userId: string) {
  const ids = socketsOf(userId)
  if (ids.length === 0) {
    socket.emit('call:unavailable', { callId: null, userId })
    return false
  }
  return true
}

io.on('connection', (socket) => {
  let myUserId: string | null = null

  socket.on('register', ({ userId, name }: { userId: string; name?: string }) => {
    if (!userId) return
    myUserId = userId
    if (name) names.set(userId, name)
    const set = presence.get(userId) ?? new Set<string>()
    const wasEmpty = set.size === 0
    set.add(socket.id)
    presence.set(userId, set)
    if (wasEmpty) io.emit('presence', { userId, online: true })
    // give the newcomer the current online list
    socket.emit('presence:list', { ids: Array.from(presence.keys()) })
    console.log(`registered ${name ?? ''} (${userId}) sockets=${set.size}`)
  })

  socket.on('presence:list', () => {
    socket.emit('presence:list', { ids: Array.from(presence.keys()) })
  })

  socket.on('call:invite', (p: { callId: string; to: string; from: { id: string; name: string }; type: 'voice' | 'video' }) => {
    if (!p?.to) return
    const ids = socketsOf(p.to)
    if (ids.length === 0) {
      socket.emit('call:unavailable', { callId: p.callId })
      return
    }
    for (const id of ids) io.to(id).emit('call:incoming', { callId: p.callId, from: p.from, type: p.type })
    console.log(`call:invite ${p.callId} ${p.from?.id} -> ${p.to} (${p.type}) targets=${ids.length}`)
  })

  socket.on('call:respond', (p: { callId: string; to: string; action: 'accept' | 'decline' | 'busy' }) => {
    if (!p?.to) return
    const ids = socketsOf(p.to)
    for (const id of ids) io.to(id).emit('call:respond', { callId: p.callId, action: p.action })
    console.log(`call:respond ${p.callId} action=${p.action} targets=${ids.length}`)
  })

  socket.on('call:signal', (p: { to: string; callId: string; data: unknown }) => {
    if (!p?.to) return
    for (const id of socketsOf(p.to)) io.to(id).emit('call:signal', { callId: p.callId, data: p.data })
  })

  socket.on('call:end', (p: { to: string; callId: string; reason: string }) => {
    if (!p?.to) return
    for (const id of socketsOf(p.to)) io.to(id).emit('call:end', { callId: p.callId, reason: p.reason })
    console.log(`call:end ${p.callId} reason=${p.reason}`)
  })

  socket.on('msg:new', (p: { to: string; message: unknown }) => {
    if (!p?.to || !p.message) return
    for (const id of socketsOf(p.to)) io.to(id).emit('msg:incoming', { message: p.message, from: myUserId })
  })

  socket.on('msg:read', (p: { to: string; peerId: string }) => {
    if (!p?.to) return
    for (const id of socketsOf(p.to)) io.to(id).emit('msg:read', { peerId: myUserId, at: new Date().toISOString() })
  })

  socket.on('typing', (p: { to: string; peerId: string; isTyping: boolean }) => {
    if (!p?.to) return
    for (const id of socketsOf(p.to)) io.to(id).emit('typing', { peerId: myUserId, isTyping: !!p.isTyping })
  })

  socket.on('disconnect', () => {
    if (!myUserId) return
    const set = presence.get(myUserId)
    if (!set) return
    set.delete(socket.id)
    if (set.size === 0) {
      presence.delete(myUserId)
      io.emit('presence', { userId: myUserId, online: false })
      console.log(`offline ${myUserId}`)
    }
  })

  socket.on('error', (e) => console.error('socket error', e))
})

const PORT = 3003
httpServer.listen(PORT, () => console.log(`CALL signaling service on port ${PORT}`))

process.on('SIGTERM', () => httpServer.close(() => process.exit(0)))
process.on('SIGINT', () => httpServer.close(() => process.exit(0)))
