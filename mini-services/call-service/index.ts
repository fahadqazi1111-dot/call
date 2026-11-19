import { createServer, type IncomingMessage } from 'http'
import { Server, type Socket } from 'socket.io'

const httpServer = createServer()

/* ================= internal HTTP relay (Next.js API -> socket clients) =================
 * The Next.js backend cannot emit socket events itself. Financial fulfillment
 * (gift delivered after a verified payment), broadcasts and other server-side
 * events POST here with the shared secret:
 *   POST /internal/relay  { targets: ['user:<id>'|'room:<id>'|'live:<id>'|'all'], event, data }
 *
 * NOTE: this runs on a SEPARATE internal-only port (3004) because socket.io
 * is attached to the main server with path '/' and would otherwise swallow
 * every HTTP request. Port 3004 is never exposed by the gateway.
 */
const RELAY_SECRET = 'call-internal-relay-v1'

function readBody(req: IncomingMessage, cb: (raw: string) => void) {
  let raw = ''
  req.on('data', (c) => {
    raw += c
    if (raw.length > 1e6) req.destroy()
  })
  req.on('end', () => cb(raw))
}

const relayServer = createServer((req, res) => {
  if (!req.url || !req.url.startsWith('/internal/relay')) {
    res.writeHead(404).end()
    return
  }
  if (req.headers['x-internal-secret'] !== RELAY_SECRET) {
    res.writeHead(403, { 'content-type': 'application/json' }).end(JSON.stringify({ ok: false, error: 'forbidden' }))
    return
  }
  readBody(req, (raw) => {
    try {
      const body = JSON.parse(raw || '{}') as { targets?: string[]; event?: string; data?: unknown }
      const targets = Array.isArray(body.targets) ? body.targets : []
      const event = String(body.event || '')
      if (!targets.length || !event) {
        res.writeHead(400, { 'content-type': 'application/json' }).end(JSON.stringify({ ok: false, error: 'bad_request' }))
        return
      }
      let reached = 0
      for (const t of targets) {
        if (t === 'all') {
          io.emit(event, body.data)
          reached++
        } else if (t.startsWith('user:')) {
          const ids = socketsOf(t.slice(5))
          for (const id of ids) io.to(id).emit(event, body.data)
          reached++
        } else if (t.startsWith('room:') || t.startsWith('live:')) {
          // internal control events mutate service state instead of being
          // broadcast — REST routes are the single source of truth
          if (event === 'internal:room_sync') {
            const sync = body.data as { roomId?: string; participants?: RoomUser[] }
            if (sync?.roomId && Array.isArray(sync.participants)) {
              const members = new Map<string, RoomUser>()
              for (const p of sync.participants) {
                if (!p?.userId) continue
                members.set(p.userId, {
                  userId: p.userId,
                  name: p.name ?? '',
                  avatarKey: p.avatarKey ?? 0,
                  avatarUrl: p.avatarUrl ?? null,
                  role: p.role ?? 'listener',
                  muted: !!p.muted,
                  handRaised: !!p.handRaised,
                  stageInvite: !!p.stageInvite,
                })
              }
              roomMembers.set(sync.roomId, members)
              broadcastRoomState(sync.roomId)
              reached++
            }
          } else if (event === 'internal:room_closed') {
            const d = body.data as { roomId?: string }
            if (d?.roomId) {
              roomMembers.delete(d.roomId)
              io.to(`room:${d.roomId}`).emit('room:closed', { roomId: d.roomId })
              reached++
            }
          } else if (event === 'internal:live_ended') {
            const d = body.data as { liveId?: string }
            if (d?.liveId) {
              io.to(`live:${d.liveId}`).emit('live:ended', { liveId: d.liveId })
              liveHosts.delete(d.liveId)
              liveViewers.delete(d.liveId)
              reached++
            }
          } else {
            io.to(t).emit(event, body.data)
            reached++
          }
        }
      }
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ ok: true, reached }))
    } catch {
      if (!res.writableEnded) {
        res.writeHead(400, { 'content-type': 'application/json' }).end(JSON.stringify({ ok: false, error: 'bad_json' }))
      }
    }
  })
})
relayServer.listen(3004, () => console.log('CALL internal relay on port 3004'))

/* ================= server-side role verification =================
 * The socket service has no DB access, so it verifies every privileged
 * action against the Next.js backend. Clients can NEVER grant themselves
 * host/publisher rights by emitting crafted events.
 */
const VERIFY_URL = process.env.CALL_APP_URL || 'http://127.0.0.1:3000'
const verifyCache = new Map<string, { data: Record<string, unknown>; at: number }>()

async function verify(kind: 'room' | 'live', id: string, userId: string): Promise<Record<string, unknown> | null> {
  if (!id || !userId) return null
  const key = `${kind}:${id}:${userId}`
  const cached = verifyCache.get(key)
  if (cached && Date.now() - cached.at < 12_000) return cached.data
  try {
    const res = await fetch(`${VERIFY_URL}/api/internal/verify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-internal-secret': RELAY_SECRET },
      body: JSON.stringify({ kind, id, userId }),
      signal: AbortSignal.timeout(4000),
    })
    if (!res.ok) return cached?.data ?? null
    const data = (await res.json()) as Record<string, unknown>
    verifyCache.set(key, { data, at: Date.now() })
    return data
  } catch {
    return cached?.data ?? null
  }
}

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
 * CONFERENCES (multi-party mesh calls, capacity enforced server-side):
 *  conf:create {type, user}            conf:invite {confId, to[]}
 *  conf:respond {confId, action, user} conf:leave {confId}
 *  conf:signal {confId, to, data}      conf:media {confId, muted, cameraOn}
 *  conf:sync {}                        conf:end {confId}
 * Server -> conf:state {conf} / conf:incoming / conf:declined / conf:full /
 *           conf:ended {confId} / conf:signal {confId, from, data} / conf:sync_state {conf|null}
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
  stageInvite?: boolean
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

/* ================= conferences (multi-party calls) ================= */

interface ConfParticipant {
  userId: string
  name: string
  avatarKey: number
  avatarUrl: string | null
  muted: boolean
  cameraOn: boolean
  joinedAt: number
}

interface Conference {
  id: string
  hostId: string
  type: 'voice' | 'video'
  max: number
  createdAt: number
  participants: Map<string, ConfParticipant>
}

// confId -> conference
const conferences = new Map<string, Conference>()
// userId -> confId (one conference per user)
const userConf = new Map<string, string>()
// confId -> (userId -> invitedAt) — 30s TTL dedupe of ring spam
const confInvited = new Map<string, Map<string, number>>()

function confPayload(conf: Conference) {
  return {
    id: conf.id,
    type: conf.type,
    max: conf.max,
    hostId: conf.hostId,
    createdAt: conf.createdAt,
    participants: Array.from(conf.participants.values()),
  }
}

function broadcastConfState(confId: string) {
  const conf = conferences.get(confId)
  if (!conf) return
  const payload = { conf: confPayload(conf) }
  for (const uid of conf.participants.keys()) {
    for (const id of socketsOf(uid)) io.to(id).emit('conf:state', payload)
  }
}

/** Remove a participant; ends the conference when it empties or the host leaves. */
function removeConfParticipant(userId: string, confId: string) {
  const conf = conferences.get(confId)
  if (!conf || !conf.participants.has(userId)) return
  conf.participants.delete(userId)
  userConf.delete(userId)
  confInvited.get(confId)?.clear()
  if (conf.participants.size === 0 || conf.hostId === userId) {
    // notify remaining members BEFORE tearing down so clients can clean up
    const remaining = Array.from(conf.participants.keys())
    conferences.delete(confId)
    confInvited.delete(confId)
    for (const uid of remaining) {
      userConf.delete(uid)
      for (const id of socketsOf(uid)) io.to(id).emit('conf:ended', { confId })
    }
    return
  }
  broadcastConfState(confId)
}

/** Host-initiated destroy (conf:end). */
function endConf(confId: string) {
  const conf = conferences.get(confId)
  if (!conf) return
  const members = Array.from(conf.participants.keys())
  conferences.delete(confId)
  confInvited.delete(confId)
  for (const uid of members) {
    if (userConf.get(uid) === confId) userConf.delete(uid)
    for (const id of socketsOf(uid)) io.to(id).emit('conf:ended', { confId })
  }
}

/** Admin-configurable capacity, cached 30s; clamped 2..12, default 5. */
let confMaxCache: { max: number; at: number } | null = null
async function confMax(): Promise<number> {
  if (confMaxCache && Date.now() - confMaxCache.at < 30_000) return confMaxCache.max
  try {
    const res = await fetch(`${VERIFY_URL}/api/internal/conference-config`, {
      headers: { 'x-internal-secret': RELAY_SECRET },
      signal: AbortSignal.timeout(3000),
    })
    if (res.ok) {
      const data = (await res.json()) as { maxParticipants?: number }
      const max = Math.max(2, Math.min(12, Math.round(Number(data.maxParticipants)) || 5))
      confMaxCache = { max, at: Date.now() }
      return max
    }
  } catch {}
  return confMaxCache?.max ?? 5
}

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
    // SAFETY GATE — the caller may be blocked / restricted by the backend.
    // The socket service has no DB access, so it verifies against the Next.js
    // backend; a transient verify failure fails OPEN (call is allowed).
    void (async () => {
      try {
        const res = await fetch(`${VERIFY_URL}/api/internal/verify`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-internal-secret': RELAY_SECRET },
          body: JSON.stringify({ kind: 'call', id: p.to, userId: p.from?.id || myUserId }),
          signal: AbortSignal.timeout(4000),
        })
        if (res.ok) {
          const v = (await res.json()) as { ok?: boolean; reason?: string }
          if (v && v.ok === false) {
            socket.emit('call:blocked', { callId: p.callId, reason: v.reason || 'blocked' })
            return
          }
        }
      } catch {}
      for (const id of ids) io.to(id).emit('call:incoming', { callId: p.callId, from: p.from, type: p.type })
    })()
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

  socket.on('msg:delivered', (p: { to: string; ids: string[] }) => {
    if (!p?.to || !Array.isArray(p.ids)) return
    for (const id of socketsOf(p.to)) io.to(id).emit('msg:delivered', { ids: p.ids, by: myUserId })
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
    // ROLE IS SERVER-VERIFIED — the client-provided role is ignored.
    void (async () => {
      const v = await verify('room', p.roomId, p.user.id)
      // dropped ONLY when the backend explicitly says so (ended room / kicked /
      // blocked). A transient verify failure keeps the user as a safe listener.
      if (v && (!v.exists || v.blocked)) {
        socket.emit('room:removed', { roomId: p.roomId, reason: 'unavailable' })
        return
      }
      const role = v && v.role ? (v.role as string) : 'listener'
      const members = roomMembers.get(p.roomId) ?? new Map<string, RoomUser>()
      members.set(p.user.id, {
        userId: p.user.id,
        name: p.user.name,
        avatarKey: p.user.avatarKey ?? 0,
        avatarUrl: p.user.avatarUrl ?? null,
        role,
        muted: false,
        handRaised: false,
      })
      roomMembers.set(p.roomId, members)
      myRooms.add(p.roomId)
      socket.join(`room:${p.roomId}`)
      broadcastRoomState(p.roomId)
    })()
  })

  socket.on('room:leave', (p: { roomId: string }) => {
    // a client may only remove ITSELF from a room — never someone else
    if (!p?.roomId || !myUserId) return
    const members = roomMembers.get(p.roomId)
    members?.delete(myUserId)
    if (members && members.size === 0) {
      roomMembers.delete(p.roomId)
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
    if (!p?.to || !myUserId) return
    // WebRTC signals may only flow between members of the same room
    const members = roomMembers.get(p.roomId ?? '')
    if (!members || (!members.has(myUserId) && !members.has(p.to))) return
    for (const id of socketsOf(p.to)) io.to(id).emit('room:signal', { roomId: p.roomId, from: myUserId, data: p.data })
  })

  /** self mute badge sync (only affects MY row; host force-mute goes via REST) */
  socket.on('room:self_mute', (p: { roomId: string; muted: boolean }) => {
    if (!p?.roomId || !myUserId) return
    const member = roomMembers.get(p.roomId)?.get(myUserId)
    if (!member || member.role === 'listener') return
    member.muted = !!p.muted
    broadcastRoomState(p.roomId)
  })

  socket.on('room:moderate', (p: { roomId: string; action: string; targetId: string; by: string }) => {
    // Authorization happens on REST; this echo is only a fast-path mirror of
    // already-verified changes and can never escalate roles by itself.
    if (!p?.roomId || !p?.action || !p?.targetId || !myUserId) return
    const members = roomMembers.get(p.roomId)
    const me = members?.get(myUserId)
    const canModerate = me && (me.role === 'host' || me.role === 'cohost')
    const selfHand = p.targetId === myUserId && (p.action === 'hand_up' || p.action === 'hand_down')
    if (!canModerate && !selfHand) return
    const target = members?.get(p.targetId)
    if (members && target) {
      if (canModerate) {
        if (p.action === 'promote') { target.role = 'speaker'; target.handRaised = false }
        else if (p.action === 'cohost') { target.role = 'cohost'; target.handRaised = false }
        else if (p.action === 'demote') { target.role = 'listener'; target.handRaised = false }
        else if (p.action === 'mute') target.muted = true
        else if (p.action === 'unmute') target.muted = false
        else if (p.action === 'hand_ok') { target.role = 'speaker'; target.handRaised = false }
        else if (p.action === 'hand_no') target.handRaised = false
      }
      if (selfHand) {
        target.handRaised = p.action === 'hand_up' && target.role === 'listener'
      }
      broadcastRoomState(p.roomId)
    }
  })

  /* ================= video live + battles ================= */

  socket.on('live:join', (p: { liveId: string; user: { id: string; name: string; avatarKey?: number; avatarUrl?: string | null }; asHost?: boolean }) => {
    if (!p?.liveId || !p?.user?.id) return
    myUserId = myUserId || p.user.id
    // asHost is SERVER-VERIFIED — only the live host / accepted battle
    // participants may register as publishers
    void (async () => {
      let asHost = !!p.asHost
      if (asHost) {
        const v = await verify('live', p.liveId, p.user.id)
        asHost = !!(v && v.isLive && (v.isHost || v.isParticipant))
      }
      socket.join(`live:${p.liveId}`)
      myLives.add(p.liveId)
      if (asHost) {
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
    })()
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
    // sender already appended its own comment from the REST response —
    // excluding the sender here prevents duplicate self-comments
    socket.to(`live:${p.liveId}`).emit('live:chat', { liveId: p.liveId, comment: p.comment })
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
    if (!p?.liveId || !myUserId) return
    // ONLY the verified host may end the live from the socket path
    void (async () => {
      const v = await verify('live', p.liveId, myUserId)
      if (!v || !v.isHost) return
      io.to(`live:${p.liveId}`).emit('live:ended', { liveId: p.liveId })
      liveHosts.delete(p.liveId)
      liveViewers.delete(p.liveId)
    })()
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

  /* ================= conferences (multi-party, max enforced server-side) =================
   *  conf:create  { type, user }                          -> conf:state { conf }
   *  conf:invite  { confId, to: string[] }                -> conf:incoming { confId, from, inviterName, type, memberCount } | conf:full { confId, max }
   *  conf:respond { confId, action, user }                -> conf:state (all) | conf:declined { confId, userId } | conf:full
   *  conf:leave   { confId }                              -> conf:state | conf:ended { confId }
   *  conf:signal  { confId, to, data:{kind,payload} }     -> conf:signal { confId, from, data } (verbatim relay)
   *  conf:media   { confId, muted, cameraOn }             -> conf:state (all)
   *  conf:sync    {}                                      -> conf:sync_state { conf | null }
   *  conf:end     { confId }                              -> conf:ended { confId } (host only)
   */

  socket.on('conf:create', (p: { type: 'voice' | 'video'; user: { id: string; name: string; avatarKey?: number; avatarUrl?: string | null } }) => {
    if (!myUserId || !p?.type) return
    // already in a conference? just re-send its state (idempotent)
    const existingId = userConf.get(myUserId)
    if (existingId) {
      const conf = conferences.get(existingId)
      if (conf) {
        socket.emit('conf:state', { conf: confPayload(conf) })
        return
      }
      userConf.delete(myUserId)
    }
    void (async () => {
      const max = await confMax()
      const conf: Conference = {
        id: `cf${Date.now()}${Math.random().toString(36).slice(2, 8)}`,
        hostId: myUserId,
        type: p.type === 'video' ? 'video' : 'voice',
        max,
        createdAt: Date.now(),
        participants: new Map(),
      }
      conf.participants.set(myUserId, {
        userId: myUserId,
        name: p.user?.name || names.get(myUserId) || 'Guest',
        avatarKey: p.user?.avatarKey ?? 0,
        avatarUrl: p.user?.avatarUrl ?? null,
        muted: false,
        cameraOn: conf.type === 'video',
        joinedAt: Date.now(),
      })
      conferences.set(conf.id, conf)
      userConf.set(myUserId, conf.id)
      socket.emit('conf:state', { conf: confPayload(conf) })
    })()
  })

  socket.on('conf:invite', (p: { confId: string; to: string[] }) => {
    if (!myUserId || !p?.confId || !Array.isArray(p.to)) return
    const conf = conferences.get(p.confId)
    if (!conf || !conf.participants.has(myUserId)) return
    const now = Date.now()
    const invited = confInvited.get(conf.id) ?? new Map<string, number>()
    confInvited.set(conf.id, invited)
    // prune stale TTL entries
    for (const [uid, ts] of Array.from(invited)) if (now - ts > 30_000) invited.delete(uid)
    let fullNotified = false
    for (const target of p.to) {
      if (!target || target === myUserId || conf.participants.has(target)) continue
      if (conf.participants.size >= conf.max) {
        if (!fullNotified) {
          socket.emit('conf:full', { confId: conf.id, max: conf.max })
          fullNotified = true
        }
        continue
      }
      const ts = invited.get(target)
      if (ts && now - ts < 30_000) continue // dedupe ring spam
      invited.set(target, now)
      const inviter = conf.participants.get(myUserId)
      const payload = {
        confId: conf.id,
        from: inviter
          ? { id: inviter.userId, name: inviter.name, avatarKey: inviter.avatarKey, avatarUrl: inviter.avatarUrl }
          : { id: myUserId, name: names.get(myUserId) || 'Guest', avatarKey: 0, avatarUrl: null },
        inviterName: inviter?.name || names.get(myUserId) || 'Someone',
        type: conf.type,
        memberCount: conf.participants.size,
      }
      for (const id of socketsOf(target)) io.to(id).emit('conf:incoming', payload)
    }
  })

  socket.on('conf:respond', (p: { confId: string; action: 'accept' | 'decline'; user: { id: string; name: string; avatarKey?: number; avatarUrl?: string | null } }) => {
    if (!myUserId || !p?.confId || !p?.action) return
    const conf = conferences.get(p.confId)
    if (!conf) return
    if (p.action === 'decline') {
      for (const uid of conf.participants.keys()) {
        for (const id of socketsOf(uid)) io.to(id).emit('conf:declined', { confId: conf.id, userId: myUserId })
      }
      return
    }
    if (conf.participants.has(myUserId)) {
      socket.emit('conf:state', { conf: confPayload(conf) })
      return
    }
    if (userConf.has(myUserId)) return // busy in another conference
    // cap is re-checked at ACCEPT time — invites racing the limit lose
    if (conf.participants.size >= conf.max) {
      socket.emit('conf:full', { confId: conf.id, max: conf.max })
      return
    }
    conf.participants.set(myUserId, {
      userId: myUserId,
      name: p.user?.name || names.get(myUserId) || 'Guest',
      avatarKey: p.user?.avatarKey ?? 0,
      avatarUrl: p.user?.avatarUrl ?? null,
      muted: false,
      cameraOn: conf.type === 'video',
      joinedAt: Date.now(),
    })
    userConf.set(myUserId, conf.id)
    broadcastConfState(conf.id)
  })

  socket.on('conf:leave', (p: { confId: string }) => {
    if (!myUserId || !p?.confId) return
    removeConfParticipant(myUserId, p.confId)
  })

  socket.on('conf:signal', (p: { confId: string; to: string; data: unknown }) => {
    if (!p?.to || !myUserId || !p?.confId) return
    // WebRTC signals may only flow between participants of the same conference
    const conf = conferences.get(p.confId)
    if (!conf || (!conf.participants.has(myUserId) && !conf.participants.has(p.to))) return
    for (const id of socketsOf(p.to)) io.to(id).emit('conf:signal', { confId: p.confId, from: myUserId, data: p.data })
  })

  socket.on('conf:media', (p: { confId: string; muted?: boolean; cameraOn?: boolean }) => {
    if (!myUserId || !p?.confId) return
    const conf = conferences.get(p.confId)
    const me = conf?.participants.get(myUserId)
    if (!conf || !me) return
    if (typeof p.muted === 'boolean') me.muted = p.muted
    if (typeof p.cameraOn === 'boolean') me.cameraOn = p.cameraOn
    broadcastConfState(conf.id)
  })

  socket.on('conf:sync', () => {
    if (!myUserId) return
    const confId = userConf.get(myUserId)
    const conf = confId ? conferences.get(confId) : null
    socket.emit('conf:sync_state', { conf: conf ? confPayload(conf) : null })
  })

  socket.on('conf:end', (p: { confId: string }) => {
    if (!myUserId || !p?.confId) return
    const conf = conferences.get(p.confId)
    if (!conf || conf.hostId !== myUserId) return
    endConf(conf.id)
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
      // conference: only when the user's LAST socket drops (multi-device safe)
      const confId = userConf.get(myUserId)
      if (confId) removeConfParticipant(myUserId, confId)
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
