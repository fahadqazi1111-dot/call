'use client'

import { socketClient } from './socket'
import { getIceConfig } from './ice'
import type { RoomState, RoomUserState } from './types'

function iceConfig(): RTCConfiguration {
  return getIceConfig()
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
      // re-join after reconnect — emit the SHAPE the server expects
      // ({ id, name, avatarKey, avatarUrl }). `state.me` is a RoomUserState
      // which uses `userId` (not `id`), so passing it directly made the
      // server's `p.user.id` guard fail and silently dropped the re-join —
      // the user stayed in the roomMembers map only until the disconnect
      // handler removed them, after which they received no further
      // room:state broadcasts (and never appeared in anyone's participant list).
      if (this.state.roomId && this.state.me) {
        socketClient.emit('room:join', {
          roomId: this.state.roomId,
          user: {
            id: this.state.me.userId,
            name: this.state.me.name,
            avatarKey: this.state.me.avatarKey,
            avatarUrl: this.state.me.avatarUrl,
          },
          role: this.state.me.role,
        })
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

  /** Sync WebRTC connections to match the participant state.
   * Speakers connect send+recv to everyone; listeners connect recv-only to
   * speakers. This fixes the old bug where ~half of listeners never received
   * audio because speakers never created connections toward listeners. */
  private async syncPeers() {
    const speakers = this.state.participants.filter((u) => SPEAKING_ROLES.has(u.role))
    const listeners = this.state.participants.filter((u) => u.role === 'listener')
    const iSpeak = this.isSpeaking()

    // close peers that left the room entirely
    for (const [uid, pc] of Array.from(this.peers)) {
      const stillThere = speakers.some((s) => s.userId === uid) || listeners.some((l) => l.userId === uid)
      if (!stillThere) {
        // Detach handlers BEFORE close() so the synthetic `closed` event
        // doesn't double-fire and try to mutate state mid-iteration.
        pc.ontrack = null
        pc.onicecandidate = null
        pc.onconnectionstatechange = null
        pc.oniceconnectionstatechange = null
        try {
          pc.close()
        } catch {}
        this.peers.delete(uid)
        const streams = { ...this.state.streams }
        delete streams[uid]
        this.state.streams = streams
      }
    }

    // connect to every other speaker (I may be speaker or listener)
    for (const s of speakers) {
      if (s.userId === this.myId()) continue
      await this.ensurePeer(s.userId, iSpeak, SPEAKING_ROLES.has(s.role))
    }
    // as a speaker, also push my audio DOWN to every listener
    if (iSpeak) {
      for (const l of listeners) {
        if (l.userId === this.myId()) continue
        await this.ensurePeer(l.userId, true, false)
      }
    }

    // ensure my own track is attached on every peer once I'm speaking
    if (iSpeak && this.localStream) {
      const track = this.localStream.getAudioTracks()[0]
      if (track) {
        for (const [, pc] of this.peers) {
          const sender = pc.getSenders().find((x) => (x.track?.kind === 'audio' || x.track === null) && x.track !== track)
          if (sender) {
            try {
              await sender.replaceTrack(track)
            } catch {}
          }
        }
      }
    }
    this.emit()
  }

  private async ensurePeer(otherId: string, iSpeak: boolean, otherSpeaks: boolean) {
    let pc = this.peers.get(otherId)
    if (!pc) {
      pc = new RTCPeerConnection(iceConfig())
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
        if (pc!.connectionState === 'failed' || pc!.connectionState === 'closed') {
          pc!.close()
          if (this.peers.get(otherId) === pc) this.peers.delete(otherId)
        }
      }
      // Granular ICE-layer monitoring — surfaces a per-peer "Reconnecting…"
      // log so troubleshooting a flaky mic-stage connection is easier.
      // Room audio is mostly transient (people come and go), so we don't
      // toast here — the connectionstatechange handler above already drops
      // the PC on failure and syncPeers() recreates it from room:state.
      pc.oniceconnectionstatechange = () => {
        const st = pc!.iceConnectionState
        console.info('[callapp] room ICE state for', otherId, ':', st)
      }

      if (iSpeak && this.state.me) {
        try {
          const mic = await this.getMic()
          const track = mic.getAudioTracks()[0]
          if (track) pc.addTrack(track, mic)
          else pc.addTransceiver('audio', { direction: 'recvonly' })
        } catch {
          // mic unavailable — stay recvonly
          pc.addTransceiver('audio', { direction: 'recvonly' })
        }
      } else {
        pc.addTransceiver('audio', { direction: 'recvonly' })
      }

      // Offer rules (avoid glare):
      //  - speaker → listener: the SPEAKER always initiates
      //  - speaker ↔ speaker: the lower userId initiates
      //  - listener → speaker: never initiates (waits for the speaker)
      const iInitiate = iSpeak && !otherSpeaks ? true : iSpeak && otherSpeaks ? this.myId() < otherId : false
      if (iInitiate) {
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        socketClient.emit('room:signal', {
          roomId: this.state.roomId,
          to: otherId,
          data: { kind: 'offer', payload: offer },
        })
      }
    } else if (iSpeak && this.localStream) {
      // existing peer — make sure my newest track is attached (e.g. after FX swap)
      const track = this.localStream.getAudioTracks()[0]
      const sender = pc.getSenders().find((x) => (x.track?.kind === 'audio' || x.track === null) && (!track || x.track !== track))
      if (sender && track) {
        try {
          await sender.replaceTrack(track)
        } catch {}
      }
    }
  }

  private async handleSignal(p: { roomId: string; from: string; data: { kind: string; payload: unknown } }) {
    if (p.roomId !== this.state.roomId || !p.from) return
    const other = this.state.participants.find((u) => u.userId === p.from)
    if (!other) return
    // create the peer on demand when the offer arrives first (e.g. a speaker
    // pushing audio down to me before my own sync ran)
    if (!this.peers.has(p.from)) {
      const iSpeak = this.isSpeaking()
      const otherSpeaks = SPEAKING_ROLES.has(other.role)
      await this.ensurePeerRaw(p.from, iSpeak, otherSpeaks)
    }
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

  /** Create a peer connection WITHOUT offering (used when the remote side initiates). */
  private async ensurePeerRaw(otherId: string, iSpeak: boolean, otherSpeaks: boolean) {
    const pc = new RTCPeerConnection(iceConfig())
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
    // Granular ICE-layer logging (matches ensurePeer — see comment there).
    pc.oniceconnectionstatechange = () => {
      const st = pc.iceConnectionState
      console.info('[callapp] room ICE state for', otherId, ':', st)
    }
    if (iSpeak && this.state.me) {
      try {
        const mic = await this.getMic()
        const track = mic.getAudioTracks()[0]
        if (track) pc.addTrack(track, mic)
      } catch {}
    } else if (!otherSpeaks) {
      pc.addTransceiver('audio', { direction: 'recvonly' })
    }
    // no offer — the remote side initiates
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
    // mic is captured ONLY when I actually hold a speaking role — listeners
    // never touch the microphone hardware (privacy + permission correctness)
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
    // Listeners have no microphone to mute
    if (!this.isSpeaking()) return this.state.micMuted
    const track = this.localStream?.getAudioTracks()[0]
    if (!track) return false
    track.enabled = !track.enabled
    this.state.micMuted = !track.enabled
    if (this.state.me) {
      this.state.me = { ...this.state.me, muted: this.state.micMuted }
    }
    // broadcast my mute state to the room (persisted via REST + socket mirror)
    if (this.state.roomId) {
      socketClient.emit('room:self_mute', { roomId: this.state.roomId, muted: this.state.micMuted })
      try {
        const { api } = await import('./api')
        void api.roomStage(this.state.roomId, 'mute_self', { muted: this.state.micMuted })
      } catch {}
    }
    this.emit()
    return this.state.micMuted
  }

  /** I was promoted (host invite accepted / hand approved) — open the mic now. */
  async becomeSpeaker(): Promise<void> {
    if (!this.state.roomId || !this.state.me) return
    if (!SPEAKING_ROLES.has(this.state.me.role)) return
    try {
      await this.getMic()
    } catch {}
    // re-announce with the verified role so the service + peers update
    socketClient.emit('room:join', {
      roomId: this.state.roomId,
      user: {
        id: this.state.me.userId,
        name: this.state.me.name,
        avatarKey: this.state.me.avatarKey,
        avatarUrl: this.state.me.avatarUrl,
      },
      role: this.state.me.role,
    })
    await this.syncPeers()
  }

  /** I was moved back to listeners — stop transmitting immediately. */
  async becomeListener(): Promise<void> {
    if (!this.state.me) return
    if (SPEAKING_ROLES.has(this.state.me.role)) return
    // detach my audio from every sender and release the mic
    for (const [, pc] of this.peers) {
      const sender = pc.getSenders().find((x) => x.track?.kind === 'audio')
      if (sender) {
        try {
          await sender.replaceTrack(null)
        } catch {}
      }
    }
    if (!this.preMic) {
      this.localStream?.getTracks().forEach((t) => t.stop())
    } else {
      this.localStream?.getTracks().forEach((t) => t.stop())
    }
    this.localStream = null
    this.preMic = null
    this.fxHandle?.stop()
    this.fxHandle = null
    this.state.micMuted = false
    socketClient.emit('room:join', {
      roomId: this.state.roomId,
      user: {
        id: this.state.me.userId,
        name: this.state.me.name,
        avatarKey: this.state.me.avatarKey,
        avatarUrl: this.state.me.avatarUrl,
      },
      role: 'listener',
    })
    await this.syncPeers()
  }

  /** Enforce a host-issued mute locally (the track actually stops transmitting). */
  enforceRemoteMute(muted: boolean) {
    const track = this.localStream?.getAudioTracks()[0]
    if (!track) return
    if (muted && track.enabled) {
      track.enabled = false
      this.state.micMuted = true
      this.emit()
    }
  }

  /** Raise/lower hand = microphone request (persisted via REST stage API). */
  async requestMic(requested: boolean): Promise<boolean> {
    if (!this.state.roomId) return false
    try {
      const { api } = await import('./api')
      await api.roomStage(this.state.roomId, requested ? 'request_mic' : 'cancel_request')
      if (this.state.me) {
        this.state.me = { ...this.state.me, handRaised: requested }
        this.emit()
      }
      return true
    } catch {
      return false
    }
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
    // Detach handlers BEFORE close() so the synthetic `closed` event during
    // teardown doesn't double-fire onconnectionstatechange and try to mutate
    // state we're about to wipe.
    this.peers.forEach((pc) => {
      pc.ontrack = null
      pc.onicecandidate = null
      pc.onconnectionstatechange = null
      pc.oniceconnectionstatechange = null
      try {
        pc.close()
      } catch {}
    })
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
