'use client'

import { io, type Socket } from 'socket.io-client'

type Handler = (payload: unknown) => void

class SocketClient {
  private socket: Socket | null = null
  private handlers = new Map<string, Set<Handler>>()
  private userId: string | null = null
  private userName: string | null = null
  connected = false

  private ensure(): Socket {
    if (this.socket) return this.socket
    // Production: the socket.io server runs inside the SAME Node process as
    // Next.js (deploy/production-server.js) — always connect same-origin at
    // /socket.io/. NEXT_PUBLIC_SOCKET_URL (".env", baked at build time) keeps
    // compatibility with hosts that serve the API from another origin; even
    // when it is missing we still connect same-origin so realtime works on
    // every production deploy.
    //
    // Dev sandbox: no production env vars are set, so we keep the gateway
    // form — the URL carries the XTransformPort query param and the socket.io
    // path is '/' (derived from the URI), exactly as the Caddy gateway expects.
    const production = process.env.NODE_ENV === 'production'
    const target = production ? process.env.NEXT_PUBLIC_SOCKET_URL || '/' : '/?XTransformPort=3003'
    const path = production ? process.env.NEXT_PUBLIC_SOCKET_PATH || '/socket.io/' : '/'
    const s = io(target, {
      path,
      transports: ['websocket', 'polling'],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1200,
      timeout: 10000,
    })
    s.on('connect', () => {
      this.connected = true
      if (this.userId) {
        s.emit('register', { userId: this.userId, name: this.userName })
      }
      this.dispatch('connect', null)
    })
    s.on('disconnect', () => {
      this.connected = false
      this.dispatch('disconnect', null)
    })
    for (const ev of [
      'presence',
      'presence:list',
      'call:incoming',
      'call:respond',
      'call:signal',
      'call:end',
      'call:unavailable',
      'call:blocked',
      'msg:incoming',
      'msg:read',
      'msg:delivered',
      'msg:deleted',
      'typing',
      // WhatsApp-style voice -> video upgrade prompts
      'call:video_request',
      'call:video_response',
      'notify:incoming',
      // voice rooms
      'room:state',
      'room:chat',
      'room:react',
      'room:gift',
      'room:signal',
      'room:moderate',
      'room:closed',
      'room:removed',
      'room:mic_request',
      'room:mic_invite',
      'room:self_mute',
      // group chats
      'group:msg',
      // video live + battles
      'live:viewers',
      'live:viewer:join',
      'live:viewer:leave',
      'live:signal',
      'live:chat',
      'live:react',
      'live:gift',
      'live:ended',
      'battle:invite',
      'battle:update',
      'battle:started',
      'battle:score',
      'battle:timeup',
      'battle:ended',
      // viewer → host battle requests (WhatsApp-style prompt)
      'battle:request',
      'battle:request:response',
      // conferences (multi-party mesh calls)
      'conf:state',
      'conf:incoming',
      'conf:signal',
      'conf:ended',
      'conf:full',
      'conf:declined',
      'conf:sync_state',
    ]) {
      s.on(ev, (payload: unknown) => this.dispatch(ev, payload))
    }
    this.socket = s
    if (typeof window !== 'undefined') {
      ;(window as unknown as { __callSocket?: Socket }).__callSocket = s
    }
    return s
  }

  connect(userId: string, name: string) {
    this.userId = userId
    this.userName = name
    this.ensure()
  }

  disconnectAll() {
    this.socket?.disconnect()
    this.socket = null
    this.connected = false
    this.userId = null
  }

  on(ev: string, cb: Handler) {
    let set = this.handlers.get(ev)
    if (!set) {
      set = new Set()
      this.handlers.set(ev, set)
    }
    set.add(cb)
    return () => {
      set?.delete(cb)
    }
  }

  private dispatch(ev: string, payload: unknown) {
    this.handlers.get(ev)?.forEach((h) => {
      try {
        h(payload)
      } catch (e) {
        console.error('socket handler error', ev, e)
      }
    })
  }

  emit(ev: string, payload: unknown) {
    this.ensure().emit(ev, payload)
  }
}

export const socketClient = new SocketClient()
