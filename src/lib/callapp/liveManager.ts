'use client'

import { socketClient } from './socket'
import { getIceConfig } from './ice'
import type { BattleParticipantInfo } from './types'

function iceConfig(): RTCConfiguration {
  return getIceConfig()
}

export interface LiveManagerState {
  liveId: string | null
  /** role of ME: host | cohost (battle participant) | viewer */
  role: 'host' | 'cohost' | 'viewer' | null
  /** remote media streams keyed by publisher userId */
  publisherStreams: Record<string, MediaStream>
  /** per-viewer peer connections for the host (ids only, for debugging) */
  viewerIds: string[]
  viewers: number
  micMuted: boolean
  cameraOn: boolean
  connected: boolean
}

type Listener = (s: LiveManagerState) => void

interface SignalMsg {
  kind: 'offer' | 'answer' | 'ice'
  payload: unknown
}

/**
 * Video Live client.
 *  Host / battle participants: publish their camera to EVERY viewer
 *  (one send-only RTCPeerConnection per viewer — mesh, honest & free).
 *  Battle participants additionally receive each other's streams.
 *  Viewers: receive-only peers per publisher.
 */
class LiveManager {
  private state: LiveManagerState = {
    liveId: null,
    role: null,
    publisherStreams: {},
    viewerIds: [],
    viewers: 0,
    micMuted: false,
    cameraOn: true,
    connected: false,
  }
  private listeners = new Set<Listener>()
  /** my camera (host / participants) */
  private camStream: MediaStream | null = null
  /** viewer PCs keyed by viewerId; participant-peer PCs keyed by peerId */
  private sendPCs = new Map<string, RTCPeerConnection>()
  private recvPCs = new Map<string, RTCPeerConnection>()
  private bound = false
  private pendingViewerSignals = new Map<string, SignalMsg[]>()
  /** last viewer identity, so a reconnect can silently re-join the live room */
  private _lastViewerUser: { id: string; name: string; avatarKey: number; avatarUrl: string | null } | null = null
  /** last host identity (id required by the server's live:join handler) */
  private _lastHostUser: { id: string; name: string; avatarKey: number; avatarUrl: string | null } = { id: '', name: '', avatarKey: 0, avatarUrl: null }

  subscribe(fn: Listener) {
    this.listeners.add(fn)
    fn(this.snapshot())
    return () => {
      this.listeners.delete(fn)
    }
  }

  snapshot(): LiveManagerState {
    return {
      ...this.state,
      publisherStreams: { ...this.state.publisherStreams },
      viewerIds: [...this.state.viewerIds],
    }
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
    socketClient.on('live:viewer:join', (p) => void this.handleViewerJoin(p as { liveId: string; viewer: { userId: string } }))
    socketClient.on('live:viewer:leave', (p) => this.handleViewerLeave(p as { liveId: string; viewerId: string }))
    socketClient.on('live:signal', (p) => void this.handleSignal(p as { liveId: string; from: string; data: SignalMsg }))
    socketClient.on('live:viewers', (p) => {
      const d = p as { liveId: string; count: number }
      if (d.liveId === this.state.liveId) {
        this.state.viewers = d.count
        this.emit()
      }
    })
    socketClient.on('live:ended', (p) => {
      const d = p as { liveId: string }
      if (d.liveId === this.state.liveId) void this.leave(true)
    })
    socketClient.on('connect', () => {
      if (!this.state.liveId || !this.state.role) return
      // re-join after ANY reconnect — server-side room membership is lost
      // whenever the socket service restarts or the connection drops
      if (this.state.role === 'viewer') {
        const u = this._lastViewerUser
        if (u) socketClient.emit('live:join', { liveId: this.state.liveId, user: u, asHost: false })
      } else {
        socketClient.emit('live:join', { liveId: this.state.liveId, user: { id: this._myId, name: this._lastHostUser.name }, asHost: true })
      }
    })
  }

  private myId(): string {
    // injected at join(); stored privately
    return this._myId
  }
  private _myId = ''

  /* ---------------- host / participant ---------------- */

  /** Broadcast constraints — shared by the preflight and the real publish so
   *  the warmed stream from the "Go live" tap can be reused directly. */
  private static readonly PUB_AUDIO: MediaTrackConstraints = { echoCancellation: true, noiseSuppression: true }
  private static readonly PUB_VIDEO: MediaTrackConstraints = { width: { ideal: 720 }, height: { ideal: 1280 }, facingMode: 'user' }

  /**
   * Capture camera + mic BEFORE the session row is created (called inside the
   * "Go live" tap, while the browser can still show its permission prompt on a
   * user gesture). The stream is kept — startPublishing() reuses it, so the
   * device is never opened twice. Failure returns the real browser error so
   * the UI can explain exactly what happened (no session is created then).
   */
  async preflightCamera(): Promise<{ ok: boolean; errorName?: string }> {
    try {
      if (this.camStream && this.camStream.getVideoTracks().some((t) => t.readyState === 'live')) {
        return { ok: true }
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: LiveManager.PUB_AUDIO,
        video: LiveManager.PUB_VIDEO,
      })
      this.camStream = stream
      return { ok: true }
    } catch (e) {
      return { ok: false, errorName: e instanceof DOMException ? e.name : e instanceof Error ? e.name : 'UnknownError' }
    }
  }

  /** Release a warmed preflight stream when the user cancels the go-live
   *  sheet (so the camera indicator light turns off). Never touches an
   *  active broadcast. */
  discardPreflight() {
    if (this.state.connected || this.state.liveId) return
    if (this.camStream) {
      this.camStream.getTracks().forEach((t) => t.stop())
      this.camStream = null
    }
  }

  async startPublishing(liveId: string, withVideo: boolean, myId = '', user?: { id: string; name: string; avatarKey?: number; avatarUrl?: string | null }) {
    this.bindSocket()
    this._myId = myId || this._myId
    this._lastHostUser = { id: this._myId, name: user?.name ?? this._lastHostUser.name, avatarKey: user?.avatarKey ?? 0, avatarUrl: user?.avatarUrl ?? null }
    this.state.liveId = liveId
    this.state.role = this.state.role ?? 'host'
    this.state.connected = true
    // reuse the stream captured by preflightCamera() when its tracks are alive
    const warm = this.camStream && this.camStream.getTracks().every((t) => t.readyState === 'live')
    if (!warm) {
      this.camStream = await navigator.mediaDevices.getUserMedia({
        audio: LiveManager.PUB_AUDIO,
        video: withVideo ? LiveManager.PUB_VIDEO : false,
      })
    }
    this.state.cameraOn = withVideo
    // the server REQUIRES `user` on live:join (it keys presence by it) — a
    // missing user silently drops the join and strands every viewer on a
    // preloader forever
    socketClient.emit('live:join', { liveId, user: this._lastHostUser, asHost: true })
    this.emit()
    return this.camStream
  }

  /** Battle participants reuse this after the host flow. */
  registerAsPublisher(liveId: string, myId: string, user?: { id: string; name: string; avatarKey?: number; avatarUrl?: string | null }) {
    this.bindSocket()
    this._myId = myId
    if (user) this._lastHostUser = { id: myId, name: user.name, avatarKey: user.avatarKey ?? 0, avatarUrl: user.avatarUrl ?? null }
    this.state.liveId = liveId
    this.state.role = 'cohost'
    this.state.connected = true
    socketClient.emit('live:join', { liveId, user: { id: myId, name: this._lastHostUser.name }, asHost: true })
    this.emit()
  }

  private async handleViewerJoin(p: { liveId: string; viewer: { userId: string } }) {
    if (p.liveId !== this.state.liveId || !this.camStream) return
    const viewerId = p.viewer.userId
    if (viewerId === this.myId()) return
    // close any stale PC for this viewer and rebuild (reconnection-safe)
    const old = this.sendPCs.get(viewerId)
    if (old) {
      try {
        old.close()
      } catch {}
      this.sendPCs.delete(viewerId)
    }
    const pc = new RTCPeerConnection(iceConfig())
    this.sendPCs.set(viewerId, pc)
    this.state.viewerIds = Array.from(this.sendPCs.keys())
    this.emit()

    for (const track of this.camStream.getTracks()) {
      pc.addTrack(track, this.camStream)
    }
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socketClient.emit('live:signal', {
          liveId: this.state.liveId,
          to: viewerId,
          data: { kind: 'ice', payload: e.candidate.toJSON() },
        })
      }
    }
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        try {
          pc.close()
        } catch {}
        if (this.sendPCs.get(viewerId) === pc) this.sendPCs.delete(viewerId)
        this.state.viewerIds = Array.from(this.sendPCs.keys())
        this.emit()
      }
    }
    // Granular ICE-layer monitoring — host→viewer PC logs for troubleshooting.
    // The host has many send PCs (one per viewer); toasts would be too noisy,
    // so we just log to the console.
    pc.oniceconnectionstatechange = () => {
      const st = pc.iceConnectionState
      console.info('[callapp] live host→viewer ICE state for', viewerId, ':', st)
    }
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    socketClient.emit('live:signal', {
      liveId: this.state.liveId,
      to: viewerId,
      data: { kind: 'offer', payload: offer },
    })
  }

  private handleViewerLeave(p: { liveId: string; viewerId: string }) {
    if (p.liveId !== this.state.liveId) return
    const pc = this.sendPCs.get(p.viewerId)
    if (pc) {
      // Detach handlers BEFORE close() so the synthetic `closed` event
      // doesn't double-fire onconnectionstatechange on the dropped PC.
      pc.ontrack = null
      pc.onicecandidate = null
      pc.onconnectionstatechange = null
      pc.oniceconnectionstatechange = null
      try {
        pc.close()
      } catch {}
      this.sendPCs.delete(p.viewerId)
      this.state.viewerIds = Array.from(this.sendPCs.keys())
      this.emit()
    }
  }

  /* ---------------- viewer / participant receiving ---------------- */

  private async handleSignal(p: { liveId: string; from: string; data: SignalMsg }) {
    if (p.liveId !== this.state.liveId || !p.from || p.from === this.myId()) return
    const { kind, payload } = p.data

    if (kind === 'offer') {
      // a publisher is offering us their stream
      const old = this.recvPCs.get(p.from)
      if (old) {
        // Detach handlers BEFORE close() so the synthetic `closed` event
        // doesn't double-fire on the stale PC we're about to drop.
        old.ontrack = null
        old.onicecandidate = null
        old.onconnectionstatechange = null
        old.oniceconnectionstatechange = null
        try {
          old.close()
        } catch {}
        this.recvPCs.delete(p.from)
      }
      const pc = new RTCPeerConnection(iceConfig())
      this.recvPCs.set(p.from, pc)
      const remote = new MediaStream()
      this.state.publisherStreams = { ...this.state.publisherStreams, [p.from]: remote }
      this.emit()
      pc.ontrack = (e) => {
        if (!remote.getTracks().includes(e.track)) {
          remote.addTrack(e.track)
          this.state.publisherStreams = { ...this.state.publisherStreams, [p.from]: new MediaStream(remote.getTracks()) }
          this.emit()
        }
      }
      pc.onicecandidate = (e) => {
        if (e.candidate) {
          socketClient.emit('live:signal', {
            liveId: this.state.liveId,
            to: p.from,
            data: { kind: 'ice', payload: e.candidate.toJSON() },
          })
        }
      }
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          try {
            pc.close()
          } catch {}
          if (this.recvPCs.get(p.from) === pc) this.recvPCs.delete(p.from)
        }
      }
      // Granular ICE-layer monitoring for the viewer's recv PC. This is the
      // stream the viewer actually watches — failures here mean the player
      // freezes, so we log them prominently for debugging.
      pc.oniceconnectionstatechange = () => {
        const st = pc.iceConnectionState
        console.info('[callapp] live viewer recv ICE state for', p.from, ':', st)
      }
      await pc.setRemoteDescription(new RTCSessionDescription(payload as RTCSessionDescriptionInit))
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      socketClient.emit('live:signal', {
        liveId: this.state.liveId,
        to: p.from,
        data: { kind: 'answer', payload: answer },
      })
    } else if (kind === 'answer') {
      const pc = this.sendPCs.get(p.from)
      if (pc && pc.signalingState === 'have-local-offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(payload as RTCSessionDescriptionInit))
      }
    } else if (kind === 'ice' && payload) {
      const pc = this.sendPCs.get(p.from) ?? this.recvPCs.get(p.from)
      if (pc) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(payload as RTCIceCandidateInit))
        } catch {}
      } else {
        // buffer until the PC exists
        const arr = this.pendingViewerSignals.get(p.from) ?? []
        arr.push({ kind, payload })
        this.pendingViewerSignals.set(p.from, arr)
      }
    }
  }

  /* ---------------- controls ---------------- */

  async joinAsViewer(liveId: string, me: { id: string; name: string; avatarKey: number; avatarUrl: string | null }) {
    this.bindSocket()
    this._myId = me.id
    this._lastViewerUser = me
    this.state.liveId = liveId
    this.state.role = 'viewer'
    this.state.connected = true
    socketClient.emit('live:join', { liveId, user: me, asHost: false })
    this.emit()
  }

  toggleMic() {
    const track = this.camStream?.getAudioTracks()[0]
    if (!track) return false
    track.enabled = !track.enabled
    this.state.micMuted = !track.enabled
    this.emit()
    return this.state.micMuted
  }

  async toggleCamera() {
    const track = this.camStream?.getVideoTracks()[0]
    if (!track) return false
    track.enabled = !track.enabled
    this.state.cameraOn = track.enabled
    this.emit()
    return this.state.cameraOn
  }

  async switchCamera() {
    const current = this.camStream?.getVideoTracks()[0]
    const facing = current?.getSettings().facingMode === 'user' ? 'environment' : 'user'
    try {
      const next = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 720 }, height: { ideal: 1280 } },
        audio: false,
      })
      const newTrack = next.getVideoTracks()[0]
      this.camStream?.addTrack(newTrack)
      const oldTrack = current
      for (const [, pc] of this.sendPCs) {
        const sender = pc.getSenders().find((s) => s.track?.kind === 'video')
        if (sender) await sender.replaceTrack(newTrack)
      }
      if (oldTrack) {
        oldTrack.stop()
        this.camStream?.removeTrack(oldTrack)
      }
      this.emit()
      return true
    } catch {
      return false
    }
  }

  getLocalStream(): MediaStream | null {
    return this.camStream
  }

  async leave(silent = false) {
    const liveId = this.state.liveId
    // Detach handlers BEFORE close() so the synthetic `closed` event during
    // teardown doesn't double-fire onconnectionstatechange on every PC and
    // try to mutate state we're about to wipe.
    const detach = (pc: RTCPeerConnection) => {
      pc.ontrack = null
      pc.onicecandidate = null
      pc.onconnectionstatechange = null
      pc.oniceconnectionstatechange = null
      try {
        pc.close()
      } catch {}
    }
    this.sendPCs.forEach(detach)
    this.sendPCs.clear()
    this.recvPCs.forEach(detach)
    this.recvPCs.clear()
    if (this.state.role !== 'viewer') {
      // Stop every local track — failing to do this leaves the camera/mic
      // indicator light ON after the broadcast ends (a real bug).
      this.camStream?.getTracks().forEach((t) => t.stop())
    }
    this.camStream = null
    if (liveId && !silent) {
      socketClient.emit('live:leave', { liveId })
    }
    this.pendingViewerSignals.clear()
    this._lastViewerUser = null
    this.state = {
      liveId: null,
      role: null,
      publisherStreams: {},
      viewerIds: [],
      viewers: 0,
      micMuted: false,
      cameraOn: true,
      connected: false,
    }
    this._myId = ''
    this.emit()
  }
}

export const liveManager = new LiveManager()

/* ---------------- battle participation helpers ---------------- */

export interface BattleState {
  battleId: string | null
  mode: '1v1' | '2v2' | null
  phase: 'idle' | 'inviting' | 'countdown' | 'live' | 'ended'
  participants: BattleParticipantInfo[]
  endsAt: number | null
  sideScores: number[]
  winnerSide: number | null
  invite: { battleId: string; liveId: string; mode: '1v1' | '2v2'; from: { id: string; name: string; avatarKey: number } } | null
}

type BattleListener = (s: BattleState) => void

class BattleManager {
  private state: BattleState = {
    battleId: null,
    mode: null,
    phase: 'idle',
    participants: [],
    endsAt: null,
    sideScores: [0, 0],
    winnerSide: null,
    invite: null,
  }
  private listeners = new Set<BattleListener>()
  private tickTimer: number | null = null

  subscribe(fn: BattleListener) {
    this.listeners.add(fn)
    fn(this.snapshot())
    return () => {
      this.listeners.delete(fn)
    }
  }

  snapshot(): BattleState {
    return { ...this.state, participants: [...this.state.participants] }
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
    socketClient.on('battle:invite', (p) => {
      const d = p as { battleId: string; liveId: string; mode: '1v1' | '2v2'; from: { id: string; name: string; avatarKey: number } }
      this.state.invite = {
        battleId: d.battleId,
        liveId: d.liveId,
        mode: d.mode,
        from: d.from,
      }
      this.emit()
    })
    socketClient.on('battle:update', (p) => {
      const d = p as { battleId: string; userId: string; accepted: boolean }
      if (d.battleId !== this.state.battleId) return
      this.state.participants = this.state.participants.map((x) =>
        x.userId === d.userId ? { ...x, accepted: d.accepted } : x
      )
      this.emit()
    })
    socketClient.on('battle:started', (p) => {
      const d = p as { battleId: string; endsAt: number; participants?: BattleParticipantInfo[] }
      if (d.battleId !== this.state.battleId) return
      this.state.phase = 'live'
      this.state.endsAt = d.endsAt
      if (d.participants) this.state.participants = d.participants
      this.startTicker()
      this.emit()
    })
    socketClient.on('battle:score', (p) => {
      const d = p as { battleId: string; side: number; added: number; total: number | null }
      if (d.battleId !== this.state.battleId) return
      const scores = [...this.state.sideScores]
      scores[d.side] = d.total ?? scores[d.side] + d.added
      this.state.sideScores = scores
      this.emit()
    })
    socketClient.on('battle:timeup', (p) => {
      const d = p as { battleId: string }
      if (d.battleId !== this.state.battleId) return
      this.state.phase = 'ended'
      this.stopTicker()
      this.emit()
    })
    socketClient.on('battle:ended', (p) => {
      const d = p as { battleId: string; winnerSide: number | null; sideScores: number[] }
      if (d.battleId !== this.state.battleId) return
      this.state.phase = 'ended'
      this.state.winnerSide = d.winnerSide
      this.state.sideScores = d.sideScores
      this.stopTicker()
      this.emit()
    })
  }

  private startTicker() {
    this.stopTicker()
    this.tickTimer = window.setInterval(() => {
      if (this.state.endsAt && Date.now() >= this.state.endsAt) {
        this.state.phase = 'ended'
        this.stopTicker()
        this.emit()
      }
    }, 1000)
  }

  private stopTicker() {
    if (this.tickTimer) window.clearInterval(this.tickTimer)
    this.tickTimer = null
  }

  setInviting(battleId: string, mode: '1v1' | '2v2', participants: BattleParticipantInfo[]) {
    this.state.battleId = battleId
    this.state.mode = mode
    this.state.phase = 'inviting'
    this.state.participants = participants
    this.state.sideScores = [0, 0]
    this.state.winnerSide = null
    this.emit()
  }

  setCountdown(battleId: string, mode: '1v1' | '2v2', participants: BattleParticipantInfo[]) {
    this.state.battleId = battleId
    this.state.mode = mode
    this.state.phase = 'countdown'
    this.state.participants = participants
    this.emit()
  }

  startLive(battleId: string, endsAt: number, participants?: BattleParticipantInfo[]) {
    this.state.battleId = battleId
    this.state.phase = 'live'
    this.state.endsAt = endsAt
    if (participants) this.state.participants = participants
    this.startTicker()
    this.emit()
  }

  setScore(side: number, total: number) {
    const scores = [...this.state.sideScores]
    scores[side] = total
    this.state.sideScores = scores
    this.emit()
  }

  setEnded(winnerSide: number | null, sideScores: number[]) {
    this.state.phase = 'ended'
    this.state.winnerSide = winnerSide
    this.state.sideScores = sideScores
    this.stopTicker()
    this.emit()
  }

  clearInvite() {
    this.state.invite = null
    this.emit()
  }

  reset() {
    this.stopTicker()
    this.state = {
      battleId: null,
      mode: null,
      phase: 'idle',
      participants: [],
      endsAt: null,
      sideScores: [0, 0],
      winnerSide: null,
      invite: null,
    }
    this.emit()
  }
}

export const battleManager = new BattleManager()
