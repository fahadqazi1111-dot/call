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
 * 1:1 CALLS (original, unchanged):
 *  register / presence / call:invite / call:respond / call:signal / call:end
 *  msg:new / msg:read / typing
 *
 * VOICE ROOMS:
 *  room:join {roomId, user, role}      room:leave {roomId}
 *  room:chat {roomId, message}         room:react {roomId, emoji, from}
 *  room:gift {roomId, payload}         room:signal {roomId, to, data}
 *  room:moderate {roomId, action, targetId, value, by}
 * Server -> room:  room:state {roomId, participants[]}
 *                  room:chat / room:react / room:gift / room:signal / room:moderate
 *                  room:closed {roomId}
 *
 * VIDEO LIVE + BATTLES:
 *  live:join {liveId, user, asHost}    live:leave {liveId}
 *  live:signal {liveId, to, data}      live:chat {liveId, comment}
 *  live:react {liveId, emoji, from}    live:gift {liveId, payload}
 *  live:heartbeat {liveId, viewerCount}
 *  live:end {liveId}                   battle:invite {liveId, battle, from, targets}
 *  battle:respond {liveId, battleId, userId, accepted}
 *  battle:start {liveId, battleId, endsAt, mode}
 *  battle:score {liveId, battleId, side, added, total}
 *  battle:end {liveId, battleId, winnerSide, sideScores}
 * Server -> live room: live:viewers / live:viewer:join / live:viewer:leave
 *                      live:chat / live:react / live:gift / live:signal
 *                      live:ended / battle:* (relayed)
 *
 * NOTIFICATIONS:
 *  notify:new {to, payload} -> notify:incoming {payload}
 */

// userId -> Set<socketId>
const presence = new Map<string, Set<string>>()
// userId -> display name
const names = new Map<string, string>()

interface RoomUser {
  userId: string
  name: string
  avatarKey: number
  avatarUrl: string | null
  role: string
  muted: boolean
  handRaised: boolean
}
// roomId -> Map<userId, RoomUser>
const roomMembers = new Map<string, Map<string, RoomUser>>()

function socketsOf(userId: string): string[] {
  return Array.from(presence.get(userId) ?? [])
}

function roomState(roomId: string) {
  const members = roomMembers.get(roomId)
  return {
    roomId,
    participants: members ? Array.from(members.values()) : [],
  }
}

function broadcastRoomState(roomId: string) {
  io.to(`room:${roomId}`).emit('room:state', roomState(roomId))
}

interface LiveViewer {
  userId: string
  name: string
  avatarKey: number
  avatarUrl: string | null
}
// liveId -> hosts set + viewers map
const liveHosts = new Map<string, Set<string>>()
const liveViewers = new Map<string, Map<string, LiveViewer>>()

function viewerCount(liveId: string): number {
  return liveViewers.get(liveId)?.size ?? 0
}

function broadcastViewers(liveId: string) {
  io.to(`live:${liveId}`).emit('live:viewers', { liveId, count: viewerCount(liveId) })
}

// battleId -> endsAt backup timer
const battleTimers = new Map<string, ReturnType<typeof setTimeout>>()

io.on('connection', (socket: Socket) => {
  let myUserId: string | null = null
  const myRooms = new Set<string>()
  const myLives = new Set<string>()

  /* ================= presence & 1:1 calls (unchanged) ================= */

  socket.on('register', ({ userId, name }: { userId: string; name?: string }) => {
    if (!userId) return
    myUserId = userId
    if (name) names.set(userId, name)
    const set = presence.get(userId) ?? new Set<string>()
    const wasEmpty = set.size === 0
    set.add(socket.id)
    presence.set(userId, set)
    if (wasEmpty) io.emit('presence', { userId, online: true })
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
  })

  socket.on('call:respond', (p: { callId: string; to: string; action: 'accept' | 'decline' | 'busy' }) => {
    if (!p?.to) return
    for (const id of socketsOf(p.to)) io.to(id).emit('call:respond', { callId: p.callId, action: p.action })
  })

  socket.on('call:signal', (p: { to: string; callId: string; data: unknown }) => {
    if (!p?.to) return
    for (const id of socketsOf(p.to)) io.to(id).emit('call:signal', { callId: p.callId, data: p.data })
  })

  socket.on('call:end', (p: { to: string; callId: string; reason: string }) => {
    if (!p?.to) return
    for (const id of socketsOf(p.to)) io.to(id).emit('call:end', { callId: p.callId, reason: p.reason })
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

  /* ================= notifications relay ================= */

  socket.on('notify:new', (p: { to: string; payload: unknown }) => {
    if (!p?.to || !p.payload) return
    for (const id of socketsOf(p.to)) io.to(id).emit('notify:incoming', { payload: p.payload })
  })

  /* ================= voice rooms ================= */

  socket.on('room:join', (p: { roomId: string; user: { id: string; name: string; avatarKey?: number; avatarUrl?: string | null }; role?: string }) => {
    if (!p?.roomId || !p?.user?.id) return
    myUserId = myUserId || p.user.id
    const members = roomMembers.get(p.roomId) ?? new Map<string, RoomUser>()
    members.set(p.user.id, {
      userId: p.user.id,
      name: p.user.name,
      avatarKey: p.user.avatarKey ?? 0,
      avatarUrl: p.user.avatarUrl ?? null,
      role: p.role || 'listener',
      muted: false,
      handRaised: false,
    })
    roomMembers.set(p.roomId, members)
    myRooms.add(p.roomId)
    socket.join(`room:${p.roomId}`)
    broadcastRoomState(p.roomId)
  })

  socket.on('room:leave', (p: { roomId: string; userId?: string }) => {
    if (!p?.roomId) return
    const uid = p.userId || myUserId
    if (!uid) return
    const members = roomMembers.get(p.roomId)
    members?.delete(uid)
    if (members && members.size === 0) {
      roomMembers.delete(p.roomId)
      io.to(`room:${p.roomId}`).emit('room:closed', { roomId: p.roomId })
    } else {
      broadcastRoomState(p.roomId)
    }
    myRooms.delete(p.roomId)
    socket.leave(`room:${p.roomId}`)
  })

  socket.on('room:chat', (p: { roomId: string; message: unknown }) => {
    if (!p?.roomId || !p.message) return
    socket.to(`room:${p.roomId}`).emit('room:chat', { roomId: p.roomId, message: p.message })
  })

  socket.on('room:react', (p: { roomId: string; emoji: string; from: { id: string; name: string } }) => {
    if (!p?.roomId || !p.emoji) return
    socket.to(`room:${p.roomId}`).emit('room:react', { roomId: p.roomId, emoji: p.emoji, from: p.from })
  })

  socket.on('room:gift', (p: { roomId: string; payload: unknown }) => {
    if (!p?.roomId || !p.payload) return
    // broadcast to everyone INCLUDING sender so the animation is consistent
    io.to(`room:${p.roomId}`).emit('room:gift', { roomId: p.roomId, payload: p.payload })
  })

  socket.on('room:signal', (p: { roomId: string; to: string; data: unknown }) => {
    if (!p?.to) return
    for (const id of socketsOf(p.to)) io.to(id).emit('room:signal', { roomId: p.roomId, from: myUserId, data: p.data })
  })

  socket.on('room:moderate', (p: { roomId: string; action: string; targetId: string; by: string }) => {
    if (!p?.roomId || !p?.action || !p?.targetId) return
    const members = roomMembers.get(p.roomId)
    const target = members?.get(p.targetId)
    if (members && target) {
      if (p.action === 'promote') { target.role = 'speaker'; target.handRaised = false }
      else if (p.action === 'cohost') { target.role = 'cohost'; target.handRaised = false }
      else if (p.action === 'demote') { target.role = 'listener'; target.handRaised = false }
      else if (p.action === 'mute') target.muted = true
      else if (p.action === 'unmute') target.muted = false
      else if (p.action === 'hand_ok') { target.role = 'speaker'; target.handRaised = false }
      else if (p.action === 'hand_no') target.handRaised = false
      else if (p.action === 'kick' || p.action === 'block') {
        members.delete(p.targetId)
        broadcastRoomState(p.roomId)
        for (const id of socketsOf(p.targetId)) {
          io.to(id).emit('room:removed', { roomId: p.roomId, reason: p.action })
        }
        return
      }
      broadcastRoomState(p.roomId)
    }
  })

  /* ================= video live + battles ================= */

  socket.on('live:join', (p: { liveId: string; user: { id: string; name: string; avatarKey?: number; avatarUrl?: string | null }; asHost?: boolean }) => {
    if (!p?.liveId || !p?.user?.id) return
    myUserId = myUserId || p.user.id
    socket.join(`live:${p.liveId}`)
    myLives.add(p.liveId)
    if (p.asHost) {
      const hosts = liveHosts.get(p.liveId) ?? new Set<string>()
      hosts.add(p.user.id)
      liveHosts.set(p.liveId, hosts)
    } else {
      const viewers = liveViewers.get(p.liveId) ?? new Map<string, LiveViewer>()
      viewers.set(p.user.id, {
        userId: p.user.id,
        name: p.user.name,
        avatarKey: p.user.avatarKey ?? 0,
        avatarUrl: p.user.avatarUrl ?? null,
      })
      liveViewers.set(p.liveId, viewers)
      // tell the host (and battle participants) a new viewer needs a stream
      for (const hostId of liveHosts.get(p.liveId) ?? []) {
        for (const id of socketsOf(hostId)) io.to(id).emit('live:viewer:join', { liveId: p.liveId, viewer: viewers.get(p.user.id) })
      }
    }
    broadcastViewers(p.liveId)
  })

  socket.on('live:leave', (p: { liveId: string; userId?: string }) => {
    if (!p?.liveId) return
    const uid = p.userId || myUserId
    if (!uid) return
    const viewers = liveViewers.get(p.liveId)
    if (viewers?.has(uid)) {
      viewers.delete(uid)
      for (const hostId of liveHosts.get(p.liveId) ?? []) {
        for (const id of socketsOf(hostId)) io.to(id).emit('live:viewer:leave', { liveId: p.liveId, viewerId: uid })
      }
    }
    const hosts = liveHosts.get(p.liveId)
    hosts?.delete(uid)
    myLives.delete(p.liveId)
    socket.leave(`live:${p.liveId}`)
    broadcastViewers(p.liveId)
  })

  socket.on('live:signal', (p: { liveId: string; to: string; data: unknown }) => {
    if (!p?.to) return
    for (const id of socketsOf(p.to)) io.to(id).emit('live:signal', { liveId: p.liveId, from: myUserId, data: p.data })
  })

  socket.on('live:chat', (p: { liveId: string; comment: unknown }) => {
    if (!p?.liveId || !p.comment) return
    io.to(`live:${p.liveId}`).emit('live:chat', { liveId: p.liveId, comment: p.comment })
  })

  socket.on('live:react', (p: { liveId: string; emoji: string; from: { id: string; name: string } }) => {
    if (!p?.liveId || !p.emoji) return
    socket.to(`live:${p.liveId}`).emit('live:react', { liveId: p.liveId, emoji: p.emoji, from: p.from })
  })

  socket.on('live:gift', (p: { liveId: string; payload: unknown }) => {
    if (!p?.liveId || !p.payload) return
    io.to(`live:${p.liveId}`).emit('live:gift', { liveId: p.liveId, payload: p.payload })
  })

  socket.on('live:heartbeat', (p: { liveId: string; viewerCount: number }) => {
    if (!p?.liveId) return
    broadcastViewers(p.liveId)
  })

  socket.on('live:end', (p: { liveId: string }) => {
    if (!p?.liveId) return
    io.to(`live:${p.liveId}`).emit('live:ended', { liveId: p.liveId })
    liveHosts.delete(p.liveId)
    liveViewers.delete(p.liveId)
  })

  /* ---- battles ---- */

  socket.on('battle:invite', (p: { targets: string[]; payload: unknown }) => {
    if (!Array.isArray(p?.targets)) return
    for (const t of p.targets) {
      for (const id of socketsOf(t)) io.to(id).emit('battle:invite', p.payload)
    }
  })

  socket.on('battle:respond', (p: { liveId: string; battleId: string; userId: string; accepted: boolean }) => {
    if (!p?.liveId || !p?.battleId) return
    io.to(`live:${p.liveId}`).emit('battle:update', { battleId: p.battleId, userId: p.userId, accepted: !!p.accepted })
  })

  socket.on('battle:start', (p: { liveId: string; battleId: string; endsAt: number; mode: string; participants?: unknown }) => {
    if (!p?.liveId || !p?.battleId || !p?.endsAt) return
    io.to(`live:${p.liveId}`).emit('battle:started', {
      battleId: p.battleId,
      endsAt: p.endsAt,
      mode: p.mode,
      participants: p.participants,
    })
    // backup timer: if the host dies, the battle still ends on time
    const remaining = p.endsAt - Date.now()
    if (remaining > 0 && !battleTimers.has(p.battleId)) {
      const t = setTimeout(() => {
        io.to(`live:${p.liveId}`).emit('battle:timeup', { battleId: p.battleId })
        battleTimers.delete(p.battleId)
      }, remaining + 5000)
      battleTimers.set(p.battleId, t)
    }
  })

  socket.on('battle:score', (p: { liveId: string; battleId: string; side: number; added: number; total: number | null }) => {
    if (!p?.liveId || !p?.battleId) return
    io.to(`live:${p.liveId}`).emit('battle:score', {
      battleId: p.battleId,
      side: p.side,
      added: p.added,
      total: p.total,
    })
  })

  socket.on('battle:end', (p: { liveId: string; battleId: string; winnerSide: number | null; sideScores: number[] }) => {
    if (!p?.battleId) return
    io.to(`live:${p.liveId}`).emit('battle:ended', {
      battleId: p.battleId,
      winnerSide: p.winnerSide ?? null,
      sideScores: p.sideScores ?? [0, 0],
    })
    const t = battleTimers.get(p.battleId)
    if (t) clearTimeout(t)
    battleTimers.delete(p.battleId)
  })

  /* ================= disconnect cleanup ================= */

  socket.on('disconnect', () => {
    if (!myUserId) return
    // rooms
    for (const roomId of Array.from(myRooms)) {
      const members = roomMembers.get(roomId)
      members?.delete(myUserId)
      if (members && members.size === 0) {
        roomMembers.delete(roomId)
        io.to(`room:${roomId}`).emit('room:closed', { roomId })
      } else if (members) {
        broadcastRoomState(roomId)
      }
    }
    // lives
    for (const liveId of Array.from(myLives)) {
      const viewers = liveViewers.get(liveId)
      if (viewers?.has(myUserId)) {
        viewers.delete(myUserId)
        for (const hostId of liveHosts.get(liveId) ?? []) {
          for (const id of socketsOf(hostId)) io.to(id).emit('live:viewer:leave', { liveId, viewerId: myUserId })
        }
      }
      const hosts = liveHosts.get(liveId)
      hosts?.delete(myUserId)
      broadcastViewers(liveId)
    }
    // presence
    const set = presence.get(myUserId)
    if (!set) return
    set.delete(socket.id)
    if (set.size === 0) {
      presence.delete(myUserId)
      io.emit('presence', { userId: myUserId, online: false })
    }
  })

  socket.on('error', (e) => console.error('socket error', e))
})

const PORT = 3003
httpServer.listen(PORT, () => console.log(`CALL signaling service on port ${PORT}`))

process.on('SIGTERM', () => httpServer.close(() => process.exit(0)))
process.on('SIGINT', () => httpServer.close(() => process.exit(0)))
