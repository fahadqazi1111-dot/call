'use client'

import { socketClient } from './socket'
import type { RoomState, RoomUserState } from './types'

const ICE_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
    {
      urls: [
        'turn:openrelay.metered.ca:80',
        'turn:openrelay.metered.ca:443',
        'turn:openrelay.metered.ca:443?transport=tcp',
        'turn:openrelay.metered.ca:80?transport=tcp',
      ],
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
}

const SPEAKING_ROLES = new Set(['host', 'cohost', 'speaker'])

export interface RoomManagerState {
  roomId: string | null
  participants: RoomUserState[]
  me: RoomUserState | null
  /** remote audio streams keyed by userId (speakers only) */
  streams: Record<string, MediaStream>
  micMuted: boolean
  connected: boolean
}

type Listener = (s: RoomManagerState) => void

/**
 * Voice Rooms client: WebRTC mesh audio between speakers (up to ~5, fine at
 * room scale), listeners receive audio only. Moderation is authoritative on
 * the server (REST) and echoed via socket; roles come from room:state.
 */
class RoomManager {
  private state: RoomManagerState = {
    roomId: null,
    participants: [],
    me: null,
    streams: {},
    micMuted: false,
    connected: false,
  }
  private listeners = new Set<Listener>()
  private peers = new Map<string, RTCPeerConnection>()
  private localStream: MediaStream | null = null
  private preMic: MediaStream | null = null
  private fxHandle: { stop(): void; setEffect(e: string): Promise<void> } | null = null
  private bound = false

  subscribe(fn: Listener) {
    this.listeners.add(fn)
    fn(this.snapshot())
    return () => {
      this.listeners.delete(fn)
    }
  }

  snapshot(): RoomManagerState {
    return { ...this.state, streams: { ...this.state.streams } }
  }

  private emit() {
    const s = this.snapshot()
    this.listeners.forEach((l) => {
      try {
        l(s)
      } catch {}
    })
  }

  bindSocket() {
    if (this.bound) return
    this.bound = true
    socketClient.on('room:state', (p) => this.handleState(p as RoomState))
    socketClient.on('room:signal', (p) => void this.handleSignal(p as { roomId: string; from: string; data: { kind: string; payload: unknown } }))
    socketClient.on('room:closed', (p) => {
      if ((p as { roomId: string }).roomId === this.state.roomId) void this.leave(true)
    })
    socketClient.on('room:removed', (p) => {
      if ((p as { roomId: string }).roomId === this.state.roomId) void this.leave(true)
    })
    socketClient.on('connect', () => {
      // re-join after reconnect
      if (this.state.roomId && this.state.me) {
        socketClient.emit('room:join', { roomId: this.state.roomId, user: this.state.me, role: this.state.me.role })
      }
    })
  }

  private async handleState(p: RoomState) {
    if (!this.state.roomId || p.roomId !== this.state.roomId) return
    this.state.participants = p.participants
    this.state.me = p.participants.find((u) => u.userId === this.myId()) ?? null
    this.emit()
    await this.syncPeers()
  }

  private myId(): string {
    return this.state.me?.userId ?? ''
  }

  private isSpeaking(): boolean {
    return !!this.state.me && SPEAKING_ROLES.has(this.state.me.role)
  }

  private async getMic() {
    if (this.localStream) return this.localStream
    // pre-injected (voice-FX processed) mic takes priority
    if (this.preMic) {
      this.localStream = this.preMic
      return this.localStream
    }
    this.localStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
      video: false,
    })
    return this.localStream
  }

  /** Inject an (optionally FX-processed) mic stream before join(). */
  setMicStream(stream: MediaStream | null) {
    this.preMic = stream
  }

  /** Sync WebRTC connections to match the participant state. */
  private async syncPeers() {
    const speakers = this.state.participants.filter((u) => SPEAKING_ROLES.has(u.role))
    const iSpeak = this.isSpeaking()

    // close peers that are no longer speakers
    for (const [uid, pc] of Array.from(this.peers)) {
      if (!speakers.some((s) => s.userId === uid)) {
        pc.close()
        this.peers.delete(uid)
        const streams = { ...this.state.streams }
        delete streams[uid]
        this.state.streams = streams
      }
    }

    for (const s of speakers) {
      if (s.userId === this.myId()) continue
      if (!this.peers.has(s.userId)) {
        await this.ensurePeer(s.userId, iSpeak)
      } else if (this.localStream) {
        // ensure my track is attached when I become a speaker mid-room
        const pc = this.peers.get(s.userId)!
        const sender = pc.getSenders().find((x) => x.track?.kind === 'audio')
        const track = this.localStream.getAudioTracks()[0]
        if (track && sender && sender.track !== track) await sender.replaceTrack(track)
      }
    }
    this.emit()
  }

  private async ensurePeer(otherId: string, iSpeak: boolean) {
    const pc = new RTCPeerConnection(ICE_CONFIG)
    this.peers.set(otherId, pc)
    const remote = new MediaStream()
    const streams = { ...this.state.streams, [otherId]: remote }
    this.state.streams = streams

    pc.ontrack = (e) => {
      if (!remote.getTracks().includes(e.track)) {
        remote.addTrack(e.track)
        this.state.streams = { ...this.state.streams, [otherId]: new MediaStream(remote.getTracks()) }
        this.emit()
      }
    }
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socketClient.emit('room:signal', {
          roomId: this.state.roomId,
          to: otherId,
          data: { kind: 'ice', payload: e.candidate.toJSON() },
        })
      }
    }
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        pc.close()
        if (this.peers.get(otherId) === pc) this.peers.delete(otherId)
      }
    }

    if (iSpeak && this.state.me) {
      try {
        const mic = await this.getMic()
        const track = mic.getAudioTracks()[0]
        if (track) pc.addTrack(track, mic)
      } catch {
        // mic unavailable — stay recvonly
      }
    } else {
      pc.addTransceiver('audio', { direction: 'recvonly' })
    }

    // deterministic offerer to avoid glare: lower userId initiates
    if (this.myId() && this.myId() < otherId) {
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      socketClient.emit('room:signal', {
        roomId: this.state.roomId,
        to: otherId,
        data: { kind: 'offer', payload: offer },
      })
    }
  }

  private async handleSignal(p: { roomId: string; from: string; data: { kind: string; payload: unknown } }) {
    if (p.roomId !== this.state.roomId || !p.from) return
    const pc = this.peers.get(p.from)
    if (!pc) return
    const { kind, payload } = p.data
    if (kind === 'offer') {
      await pc.setRemoteDescription(new RTCSessionDescription(payload as RTCSessionDescriptionInit))
      // attach my audio if I'm speaking and no track attached yet
      if (this.isSpeaking() && this.state.me) {
        const ts = pc.getTransceivers()
        if (this.localStream) {
          const track = this.localStream.getAudioTracks()[0]
          if (track && ts[0] && !ts[0].sender.track) {
            await ts[0].sender.replaceTrack(track)
            ts[0].direction = 'sendrecv'
          }
        }
      }
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      socketClient.emit('room:signal', {
        roomId: this.state.roomId,
        to: p.from,
        data: { kind: 'answer', payload: answer },
      })
    } else if (kind === 'answer') {
      if (pc.signalingState === 'have-local-offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(payload as RTCSessionDescriptionInit))
      }
    } else if (kind === 'ice' && payload) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(payload as RTCIceCandidateInit))
      } catch {}
    }
  }

  /* ---------- public controls ---------- */

  private leaveTimer: number | null = null

  async join(roomId: string, me: { id: string; name: string; avatarKey: number; avatarUrl: string | null }, role: string) {
    this.bindSocket()
    // cancel any pending teardown (React StrictMode mounts effects twice)
    if (this.leaveTimer) {
      window.clearTimeout(this.leaveTimer)
      this.leaveTimer = null
    }
    this.state.roomId = roomId
    this.state.me = {
      userId: me.id,
      name: me.name,
      avatarKey: me.avatarKey,
      avatarUrl: me.avatarUrl,
      role: (role as RoomUserState['role']) || 'listener',
      muted: false,
      handRaised: false,
    }
    this.state.connected = true
    // grab mic if speaker-ish so first state sync attaches audio immediately
    if (SPEAKING_ROLES.has(this.state.me.role)) {
      try {
        await this.getMic()
      } catch {}
    }
    socketClient.emit('room:join', {
      roomId,
      user: { id: me.id, name: me.name, avatarKey: me.avatarKey, avatarUrl: me.avatarUrl },
      role: this.state.me.role,
    })
    this.emit()
  }

  async applyMicEffect(handle: { stop(): void; setEffect(e: string): Promise<void> } | null) {
    // swap local stream with the processed one and re-attach to all senders
    if (handle) this.fxHandle = handle
    if (!this.localStream) return
    for (const [, pc] of this.peers) {
      const sender = pc.getSenders().find((x) => x.track?.kind === 'audio' || x.track === null)
      const track = this.localStream.getAudioTracks()[0]
      if (sender && track) await sender.replaceTrack(track)
    }
  }

  /** Re-attach the current local mic track to every peer sender (after FX swap). */
  async refreshMic() {
    const track = this.localStream?.getAudioTracks()[0]
    if (!track) return
    for (const [, pc] of this.peers) {
      const sender = pc.getSenders().find((x) => x.track?.kind === 'audio')
      if (sender && sender.track !== track) {
        try {
          await sender.replaceTrack(track)
        } catch {}
      }
    }
    if (track.enabled === false && !this.state.micMuted) track.enabled = true
  }

  async toggleMute(): Promise<boolean> {
    const track = this.localStream?.getAudioTracks()[0]
    if (!track) return false
    track.enabled = !track.enabled
    this.state.micMuted = !track.enabled
    if (this.state.me) {
      this.state.me = { ...this.state.me, muted: this.state.micMuted }
    }
    this.emit()
    return this.state.micMuted
  }

  raiseHand(raised: boolean) {
    if (!this.state.roomId) return
    socketClient.emit('room:moderate', {
      roomId: this.state.roomId,
      action: raised ? 'hand_up' : 'hand_down',
      targetId: this.myId(),
      by: this.myId(),
    })
    if (this.state.me) {
      this.state.me = { ...this.state.me, handRaised: raised }
      this.emit()
    }
    // server-side persistence + broadcast happens through REST + room:state
  }

  /**
   * Leave with a short grace period: React StrictMode unmounts+remounts
   * effects immediately in dev — an instant leave would emit room:leave and
   * close the room for everyone before the remount re-joins.
   */
  scheduleLeave() {
    if (this.leaveTimer) return
    this.leaveTimer = window.setTimeout(() => {
      this.leaveTimer = null
      void this.leave()
    }, 600)
  }

  async leave(silent = false) {
    if (this.leaveTimer) {
      window.clearTimeout(this.leaveTimer)
      this.leaveTimer = null
    }
    const roomId = this.state.roomId
    this.peers.forEach((pc) => pc.close())
    this.peers.clear()
    if (!this.preMic) {
      // only stop tracks we own — an injected FX stream belongs to the caller
      this.localStream?.getTracks().forEach((t) => t.stop())
    }
    this.localStream = null
    this.preMic = null
    this.fxHandle?.stop()
    this.fxHandle = null
    if (roomId && !silent) {
      socketClient.emit('room:leave', { roomId })
      try {
        const { api } = await import('./api')
        await api.roomLeave(roomId)
      } catch {}
    }
    this.state = {
      roomId: null,
      participants: [],
      me: null,
      streams: {},
      micMuted: false,
      connected: false,
    }
    this.emit()
  }

  /** send a chat message (persisted via REST, realtime via socket) */
  async sendChat(text: string) {
    if (!this.state.roomId) return null
    const { api } = await import('./api')
    const res = await api.roomSendMsg(this.state.roomId, text)
    socketClient.emit('room:chat', { roomId: this.state.roomId, message: res.message })
    return res.message
  }

  react(emoji: string) {
    if (!this.state.roomId || !this.state.me) return
    socketClient.emit('room:react', {
      roomId: this.state.roomId,
      emoji,
      from: { id: this.state.me.userId, name: this.state.me.name },
    })
  }
}

export const roomManager = new RoomManager()
