'use client'

import { socketClient } from './socket'
import { soundKit } from './sound'
import { api } from './api'
import { getIceConfig, describeMediaError } from './ice'
import type { CallState, CallPhase } from './types'

/** Toast severity — the AppRoot/store binding maps each to a Sonner variant. */
export type ToastKind = 'info' | 'error' | 'warning'

/**
 * ICE servers are resolved lazily through `getIceConfig()` so env var changes
 * (NEXT_PUBLIC_CALL_ICE_SERVERS) are picked up at module load without each
 * call site needing to know about the cache.
 */
function iceConfig(): RTCConfiguration {
  return getIceConfig()
}

type Listener = (s: CallState) => void

const INCOMING_TIMEOUT_MS = 45000

class CallManager {
  private pc: RTCPeerConnection | null = null
  private callId: string | null = null
  private peerId: string | null = null
  private peerName = ''
  private peerAvatarKey = 0
  private type: 'voice' | 'video' = 'voice'
  private phase: CallPhase = 'idle'
  private muted = false
  private cameraOn = false
  private remoteCameraOn = false
  private videoRequest: 'none' | 'sent' | 'incoming' = 'none'
  private videoRespTimer: number | null = null
  private isCaller = false
  private startedAt: number | null = null
  private durationSec = 0
  private durationTimer: number | null = null
  private timeoutTimer: number | null = null
  private resetTimer: number | null = null
  private localStream: MediaStream | null = null
  private remoteStream: MediaStream | null = null
  private me: { id: string; name: string } | null = null
  private pendingOffer: RTCSessionDescriptionInit | null = null
  /** ICE candidates that arrived before a peer/remote-description existed — flushed after SRD */
  private pendingIce: RTCIceCandidateInit[] = []
  /** one ICE-restart recovery attempt per call (caller side) */
  private restartAttempted = false
  private endReason: string | undefined
  private listeners = new Set<Listener>()
  private toastFn: ((msg: string, opts?: { kind?: ToastKind; description?: string }) => void) | null = null
  private refreshFn: (() => void) | null = null
  private msgFn: ((peerId: string, message: unknown) => void) | null = null

  setMe(me: { id: string; name: string } | null) {
    this.me = me
  }

  subscribe(fn: Listener) {
    this.listeners.add(fn)
    fn(this.snapshot())
    return () => {
      this.listeners.delete(fn)
    }
  }

  setToast(fn: (msg: string, opts?: { kind?: ToastKind; description?: string }) => void) {
    this.toastFn = fn
  }

  setRefresh(fn: () => void) {
    this.refreshFn = fn
  }

  /** Called with the persisted call-summary message so it can be shown in chat + pushed to peer. */
  setCallMessageHandler(fn: (peerId: string, message: unknown) => void) {
    this.msgFn = fn
  }

  get isActive() {
    return this.phase !== 'idle'
  }

  snapshot(): CallState {
    return {
      callId: this.callId ?? '',
      phase: this.phase,
      type: this.type,
      peerId: this.peerId ?? '',
      peerName: this.peerName,
      peerAvatarKey: this.peerAvatarKey,
      isCaller: this.isCaller,
      muted: this.muted,
      cameraOn: this.cameraOn,
      remoteCameraOn: this.remoteCameraOn,
      durationSec: this.durationSec,
      endReason: this.endReason,
      videoRequest: this.videoRequest,
      localStream: this.localStream ?? undefined,
      remoteStream: this.remoteStream ?? undefined,
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

  private toast(msg: string, opts?: { kind?: ToastKind; description?: string }) {
    this.toastFn?.(msg, opts)
  }

  // ---------- media helpers ----------

  private async getMedia(withVideo: boolean): Promise<MediaStream> {
    const constraints: MediaStreamConstraints = withVideo
      ? {
          audio: { echoCancellation: true, noiseSuppression: true },
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        }
      : { audio: { echoCancellation: true, noiseSuppression: true }, video: false }
    try {
      return await navigator.mediaDevices.getUserMedia(constraints)
    } catch (e) {
      // Surface a clear, actionable error toast — never a silent fail. The
      // caller decides whether to roll back the call (startCall) or to
      // decline the incoming call (acceptCall).
      const kind = withVideo ? 'video' : 'audio'
      const described = describeMediaError(e, kind)
      if (described) {
        this.toast(described.title, { kind: 'error', description: described.hint })
      } else {
        this.toast(
          withVideo ? 'Camera and microphone are needed for video calls' : 'Microphone permission is needed for calls',
          {
            kind: 'error',
            description: 'Tap the padlock icon in the address bar to grant access, then try again.',
          },
        )
      }
      throw e
    }
  }

  // ---------- starting an outgoing call ----------

  async startCall(peer: { id: string; name: string; avatarKey: number }, type: 'voice' | 'video') {
    if (!this.me) {
      this.toast('Please log in first')
      return
    }
    if (this.phase !== 'idle') {
      this.toast('Already in a call')
      return
    }
    this.callId = `c${Date.now()}${Math.random().toString(36).slice(2, 8)}`
    this.peerId = peer.id
    this.peerName = peer.name
    this.peerAvatarKey = peer.avatarKey
    this.type = type
    this.isCaller = true
    this.muted = false
    this.cameraOn = type === 'video'
    this.remoteCameraOn = false
    this.durationSec = 0
    this.startedAt = null
    this.endReason = undefined
    this.pendingOffer = null
    this.pendingIce = []
    this.restartAttempted = false
    try {
      this.localStream = await this.getMedia(this.cameraOn)
    } catch {
      // getMedia() already surfaced a clear, actionable toast — just unwind.
      this.reset()
      return
    }
    this.phase = 'outgoing'
    this.emit()
    soundKit.startRingback()
    socketClient.emit('call:invite', {
      callId: this.callId,
      to: peer.id,
      from: { id: this.me.id, name: this.me.name },
      type,
    })
    this.timeoutTimer = window.setTimeout(() => {
      if (this.phase === 'outgoing') {
        this.hangup('timeout')
      }
    }, INCOMING_TIMEOUT_MS)
  }

  // ---------- callee ----------

  private handleIncoming(p: { callId: string; from: { id: string; name: string }; type: 'voice' | 'video' }) {
    if (!this.me || this.phase !== 'idle') {
      if (this.phase !== 'idle' && p.callId) {
        socketClient.emit('call:respond', { callId: p.callId, to: p.from.id, action: 'busy' })
      }
      return
    }
    this.callId = p.callId
    this.peerId = p.from.id
    this.peerName = p.from.name
    this.peerAvatarKey = this.peerAvatarKey // avatarKey looked up by UI from contacts/chats
    this.type = p.type
    this.isCaller = false
    this.muted = false
    this.cameraOn = false
    this.remoteCameraOn = p.type === 'video'
    this.durationSec = 0
    this.startedAt = null
    this.endReason = undefined
    this.pendingOffer = null
    this.pendingIce = []
    this.restartAttempted = false
    this.phase = 'incoming'
    this.emit()
    soundKit.startRingtone()
  }

  async acceptCall() {
    if (this.phase !== 'incoming' || !this.callId || !this.peerId) return
    try {
      this.localStream = await this.getMedia(this.type === 'video')
      this.cameraOn = this.type === 'video'
    } catch {
      // getMedia() already surfaced a clear, actionable toast — politely
      // decline the incoming call so the caller isn't left ringing forever.
      socketClient.emit('call:respond', { callId: this.callId, to: this.peerId, action: 'decline' })
      this.reset()
      return
    }
    soundKit.stopRing()
    socketClient.emit('call:respond', { callId: this.callId, to: this.peerId, action: 'accept' })
    this.phase = 'connecting'
    this.emit()
    await this.setupPeer()
    if (this.pendingOffer) {
      await this.answerOffer(this.pendingOffer)
      this.pendingOffer = null
    }
  }

  declineCall() {
    if (this.phase !== 'incoming' || !this.callId || !this.peerId) return
    soundKit.stopRing()
    socketClient.emit('call:respond', { callId: this.callId, to: this.peerId, action: 'decline' })
    this.reset()
    this.emit()
  }

  // ---------- peer connection ----------

  private async setupPeer() {
    if (!this.peerId || this.pc) return
    const pc = new RTCPeerConnection(iceConfig())
    this.pc = pc
    this.remoteStream = new MediaStream()
    this.emit()
    if (typeof window !== 'undefined') {
      ;(window as unknown as { __callPC?: RTCPeerConnection }).__callPC = pc
    }

    pc.onicecandidate = (e) => {
      if (e.candidate && this.peerId) {
        socketClient.emit('call:signal', {
          to: this.peerId,
          callId: this.callId,
          data: { kind: 'ice', payload: e.candidate.toJSON() },
        })
      }
    }

    pc.ontrack = (e) => {
      if (e.track.kind === 'video') {
        e.track.addEventListener('mute', () => {
          this.remoteCameraOn = false
          this.emit()
        })
        e.track.addEventListener('unmute', () => {
          this.remoteCameraOn = true
          this.emit()
        })
        this.remoteCameraOn = true
      }
      if (this.remoteStream && !this.remoteStream.getTracks().includes(e.track)) {
        this.remoteStream.addTrack(e.track)
        // Fresh object so React effects re-run and re-bind the video element.
        this.remoteStream = new MediaStream(this.remoteStream.getTracks())
      }
      this.emit()
    }

    pc.onconnectionstatechange = () => {
      const st = pc.connectionState
      if (st === 'connected') {
        if (this.phase !== 'active') {
          this.phase = 'active'
          this.startedAt = Date.now()
          soundKit.stopRing()
          this.startDuration()
          this.emit()
        }
      } else if (st === 'failed') {
        this.handleConnectionFailed()
      } else if (st === 'disconnected') {
        // extended grace: transient network blips usually self-heal
        window.setTimeout(() => {
          if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
            this.handleConnectionFailed('Connection lost')
          }
        }, 8000)
      }
    }

    // Granular ICE-layer monitoring (orthogonal to the aggregate state above).
    // Fires on every ICE agent transition — surfaces the now-standard
    // "Reconnecting…" / "Call failed" UX that users expect from WhatsApp/Meet.
    pc.oniceconnectionstatechange = () => {
      const st = pc.iceConnectionState
      console.info('[callapp] 1:1 ICE state:', st)
      if (st === 'disconnected') {
        // Don't fire-and-forget the toast on every transient blip — only
        // surface it once the state actually lands on disconnected. The
        // 8s grace in onconnectionstatechange handles actual recovery.
        this.toast('Reconnecting…', { kind: 'warning' })
      } else if (st === 'failed') {
        this.toast('Call failed', { kind: 'error', description: 'The peer-to-peer connection could not be re-established. The call will end.' })
        // handleConnectionFailed() in onconnectionstatechange owns the actual hang-up;
        // we only surface the user-visible message here so we don't double-finish.
      }
      // 'closed' is expected when we tear the PC down in reset() — nothing to do.
    }

    // Tracks on transceivers.
    // Caller: creates audio+video transceivers up-front (so camera can join mid-call).
    // Callee: transceivers come from the remote offer - attach to those instead.
    const audioTrack = this.localStream?.getAudioTracks()[0]
    const videoTrack = this.localStream?.getVideoTracks()[0]
    if (this.isCaller) {
      const audioT = pc.addTransceiver('audio', { direction: 'sendrecv' })
      const videoT = pc.addTransceiver('video', { direction: 'sendrecv' })
      if (audioTrack) await audioT.sender.replaceTrack(audioTrack)
      if (videoTrack && this.cameraOn) await videoT.sender.replaceTrack(videoTrack)
    } else {
      // Callee tracks are attached in answerOffer() once the offer's m-lines exist.
      void audioTrack
      void videoTrack
    }
  }

  private async answerOffer(offer: RTCSessionDescriptionInit) {
    if (!this.pc || !this.peerId) return
    await this.pc.setRemoteDescription(new RTCSessionDescription(offer))
    this.flushPendingIce()
    const ts = this.pc.getTransceivers()
    const audioTrack = this.localStream?.getAudioTracks()[0]
    const videoTrack = this.localStream?.getVideoTracks()[0]
    // SRD flips directions to recvonly by default - opt in to sending explicitly.
    if (ts[0]) {
      if (audioTrack && !ts[0].sender.track) await ts[0].sender.replaceTrack(audioTrack)
      ts[0].direction = audioTrack ? 'sendrecv' : 'recvonly'
    }
    if (ts[1]) {
      if (videoTrack && this.cameraOn && !ts[1].sender.track) await ts[1].sender.replaceTrack(videoTrack)
      ts[1].direction = videoTrack && this.cameraOn ? 'sendrecv' : 'recvonly'
    }
    const answer = await this.pc.createAnswer()
    await this.pc.setLocalDescription(answer)
    socketClient.emit('call:signal', {
      to: this.peerId,
      callId: this.callId,
      data: { kind: 'answer', payload: answer },
    })
  }

  // ---------- socket events ----------

  async handleRespond(p: { callId: string; action: 'accept' | 'decline' | 'busy' }) {
    if (p.callId !== this.callId || !this.isCaller) return
    this.clearTimeoutTimer()
    if (p.action === 'accept') {
      soundKit.stopRing()
      this.phase = 'connecting'
      this.emit()
      await this.setupPeer()
      if (!this.pc || !this.peerId) return
      const offer = await this.pc.createOffer()
      await this.pc.setLocalDescription(offer)
      socketClient.emit('call:signal', {
        to: this.peerId,
        callId: this.callId,
        data: { kind: 'offer', payload: offer },
      })
    } else if (p.action === 'decline') {
      this.finish('declined', `${this.peerName || 'They'} declined the call`)
    } else {
      this.finish('declined', `${this.peerName || 'They'} is on another call`)
    }
  }

  async handleSignal(p: { callId: string; data: { kind: 'offer' | 'answer' | 'ice'; payload: unknown } }) {
    if (p.callId !== this.callId) return
    const { kind, payload } = p.data
    if (kind === 'offer') {
      if (this.pc && this.pc.signalingState === 'stable') {
        await this.answerOffer(payload as RTCSessionDescriptionInit)
      } else if (this.pc && this.pc.signalingState === 'have-local-offer') {
        // glare guard (renegotiation collision): queue, process after our answer lands
        this.pendingOffer = payload as RTCSessionDescriptionInit
      } else {
        this.pendingOffer = payload as RTCSessionDescriptionInit
      }
    } else if (kind === 'answer' && this.isCaller && this.pc) {
      if (this.pc.signalingState === 'have-local-offer') {
        await this.pc.setRemoteDescription(new RTCSessionDescription(payload as RTCSessionDescriptionInit))
        this.flushPendingIce()
        // a queued renegotiation offer (e.g. callee upgraded to video mid-answer) — answer it now
        const queued = this.pendingOffer
        if (queued) {
          this.pendingOffer = null
          if ((this.pc.signalingState as RTCSignalingState) === 'stable') {
            await this.answerOffer(queued)
          }
        }
      }
    } else if (kind === 'ice' && payload) {
      if (this.pc && this.pc.remoteDescription) {
        try {
          await this.pc.addIceCandidate(new RTCIceCandidate(payload as RTCIceCandidateInit))
        } catch {}
      } else {
        // arrived before setupPeer / before the remote description — buffer (liveManager pattern)
        this.pendingIce.push(payload as RTCIceCandidateInit)
      }
    }
  }

  /** Flush ICE candidates buffered before the remote description was set. */
  private flushPendingIce() {
    if (!this.pc || !this.pendingIce.length) return
    const queued = this.pendingIce
    this.pendingIce = []
    void (async () => {
      for (const c of queued) {
        try {
          await this.pc?.addIceCandidate(new RTCIceCandidate(c))
        } catch {}
      }
    })()
  }

  /**
   * Recovery path for failed/disconnected peers: the CALLER attempts ONE
   * ICE restart (fresh offer with iceRestart); the callee waits for that
   * offer and answers it. If recovery does not land in time the call ends.
   */
  private handleConnectionFailed(reason = 'Connection failed') {
    const attemptRestart = this.isCaller && !this.restartAttempted && !!this.pc
    if (attemptRestart) {
      this.restartAttempted = true
      void this.iceRestart()
    }
    window.setTimeout(() => {
      const st = this.pc?.connectionState
      if (st === 'failed' || st === 'disconnected') {
        this.finish(this.phase === 'active' ? 'answered' : 'no-answer', reason)
      }
    }, attemptRestart ? 9000 : 6000)
  }

  private async iceRestart() {
    if (!this.pc || !this.peerId || !this.callId) return
    try {
      const offer = await this.pc.createOffer({ iceRestart: true })
      await this.pc.setLocalDescription(offer)
      socketClient.emit('call:signal', {
        to: this.peerId,
        callId: this.callId,
        data: { kind: 'offer', payload: offer },
      })
    } catch {}
  }

  handleEnd(p: { callId: string; reason?: string }) {
    if (p.callId !== this.callId) return
    const answered = this.phase === 'active'
    soundKit.stopRing()
    if (!answered) {
      // incoming call cancelled by caller before accept
      this.reset()
      this.emit()
      return
    }
    this.finish('answered', p.reason === 'hangup' ? 'Call ended' : 'Call ended')
  }

  handleUnavailable(p: { callId: string | null }) {
    if (p.callId && p.callId !== this.callId) return
    if (this.phase === 'outgoing') {
      this.finish('no-answer', `${this.peerName || 'They'} is offline right now`)
    }
  }

  // ---------- user controls ----------

  hangup(reason = 'hangup') {
    if (this.phase === 'incoming') {
      this.declineCall()
      return
    }
    if (!this.callId || !this.peerId) return
    socketClient.emit('call:end', { to: this.peerId, callId: this.callId, reason })
    const status = this.phase === 'active' ? 'answered' : this.isCaller ? 'no-answer' : 'answered'
    this.finish(status as 'answered' | 'no-answer', 'Call ended')
  }

  toggleMute() {
    const track = this.localStream?.getAudioTracks()[0]
    if (!track) return
    track.enabled = !track.enabled
    this.muted = !track.enabled
    this.emit()
  }

  async toggleCamera() {
    if (!this.pc) return
    let videoTrack = this.localStream?.getVideoTracks()[0]
    if (videoTrack && this.cameraOn) {
      videoTrack.enabled = false
      this.cameraOn = false
      this.emit()
      return
    }
    if (!videoTrack) {
      try {
        const cam = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
        videoTrack = cam.getVideoTracks()[0]
        this.localStream?.addTrack(videoTrack)
      } catch (e) {
        const d = describeMediaError(e, 'video') ?? { title: 'Camera not available', hint: undefined }
        this.toast(d.title, { kind: 'error', description: d.hint })
        return
      }
    } else {
      videoTrack.enabled = true
    }
    const ts = this.pc.getTransceivers()
    let sender = this.pc.getSenders().find((s) => s.track?.kind === 'video')
    if (!sender) {
      const videoT = ts.find((t) => t.receiver.track?.kind === 'video') ?? ts[1]
      sender = videoT?.sender
    }
    if (sender) await sender.replaceTrack(videoTrack!)
    this.cameraOn = true
    this.emit()
  }

  /** Flip to the other camera (front/back) mid-call and hot-swap the track. */
  async flipCamera() {
    if (!this.pc || !this.cameraOn) return
    const current = this.localStream?.getVideoTracks()[0]
    const facing = current?.getSettings().facingMode === 'environment' ? 'user' : 'environment'
    try {
      const next = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      const track = next.getVideoTracks()[0]
      this.localStream?.addTrack(track)
      const sender = this.pc.getSenders().find((s) => s.track?.kind === 'video')
      if (sender) await sender.replaceTrack(track)
      if (current) {
        current.stop()
        this.localStream?.removeTrack(current)
      }
      this.emit()
    } catch (e) {
      const d = describeMediaError(e, 'video') ?? { title: 'Could not switch camera', hint: undefined }
      this.toast(d.title, { kind: 'error', description: d.hint })
    }
  }

  /**
   * Switch a voice call to video mid-call. The caller's pre-negotiated
   * sendrecv video m-line just needs a track; a callee must renegotiate
   * (the side ADDING video always initiates the renegotiation offer).
   */
  async enableVideo() {
    if (!this.pc || this.cameraOn) return
    let videoTrack: MediaStreamTrack | null = null
    try {
      const cam = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      videoTrack = cam.getVideoTracks()[0]
      this.localStream?.addTrack(videoTrack)
    } catch (e) {
      const d = describeMediaError(e, 'video') ?? { title: 'Camera not available', hint: undefined }
      this.toast(d.title, { kind: 'error', description: d.hint })
      return
    }
    const sender = this.pc.getSenders().find((s) => s.track?.kind === 'video')
    const vt = this.pc.getTransceivers().find((t) => t.receiver.track?.kind === 'video' || t.sender.track?.kind === 'video')
    if (sender) await sender.replaceTrack(videoTrack)
    else if (vt) await vt.sender.replaceTrack(videoTrack)
    if (vt && !this.isCaller) {
      // callee answered recvonly — bump direction and offer a renegotiation
      vt.direction = 'sendrecv'
      if (this.pc.signalingState === 'stable' && this.peerId && this.callId) {
        try {
          const offer = await this.pc.createOffer()
          await this.pc.setLocalDescription(offer)
          socketClient.emit('call:signal', {
            to: this.peerId,
            callId: this.callId,
            data: { kind: 'offer', payload: offer },
          })
        } catch {}
      }
    }
    this.type = 'video'
    this.cameraOn = true
    this.emit()
  }

  /**
   * WhatsApp-style voice→video upgrade — step 1 (caller side):
   * ASK the peer first. Video only starts after they accept.
   */
  requestVideo() {
    if (!this.pc || this.phase !== 'active' || this.cameraOn || this.videoRequest !== 'none') return
    if (!this.peerId || !this.callId) return
    socketClient.emit('call:video_request', { to: this.peerId, callId: this.callId })
    this.videoRequest = 'sent'
    this.emit()
    if (this.videoRespTimer) window.clearTimeout(this.videoRespTimer)
    this.videoRespTimer = window.setTimeout(() => {
      if (this.videoRequest === 'sent') {
        this.videoRequest = 'none'
        this.toast('No response to the video request')
        this.emit()
      }
    }, 15000)
  }

  /** step 2 (callee side): accept or decline the incoming video request */
  respondVideoRequest(accept: boolean) {
    if (this.videoRequest !== 'incoming' || !this.peerId || !this.callId) return
    socketClient.emit('call:video_response', { to: this.peerId, callId: this.callId, accept })
    this.videoRequest = 'none'
    this.emit()
    if (accept) {
      // both cameras come on: mine now, the requester's on their side
      void this.enableVideo()
    }
  }

  private handleVideoRequest(callId: string) {
    if (callId !== this.callId || this.phase !== 'active' || this.cameraOn) return
    this.videoRequest = 'incoming'
    soundKit.pop(false)
    this.emit()
  }

  private handleVideoResponse(callId: string, accept: boolean) {
    if (callId !== this.callId) return
    if (this.videoRespTimer) {
      window.clearTimeout(this.videoRespTimer)
      this.videoRespTimer = null
    }
    if (this.videoRequest !== 'sent') return
    this.videoRequest = 'none'
    if (accept) {
      void this.enableVideo()
    } else {
      this.toast(`${this.peerName} declined your video request`)
    }
    this.emit()
  }

  /** Live peer connection (CallOverlay polls getStats() from it). */
  getActivePc(): RTCPeerConnection | null {
    return this.pc
  }

  /**
   * Hand my local stream to the conference manager during a 1:1 -> group
   * upgrade. Clears ownership so the post-call reset() will NOT stop the
   * tracks that now belong to the conference.
   */
  detachLocalStream(): MediaStream | null {
    const s = this.localStream
    this.localStream = null
    return s
  }

  getLocalStream(): MediaStream | null {
    return this.localStream
  }

  // ---------- lifecycle ----------

  private startDuration() {
    this.stopDuration()
    this.durationTimer = window.setInterval(() => {
      if (this.startedAt) {
        this.durationSec = Math.floor((Date.now() - this.startedAt) / 1000)
        this.emit()
      }
    }, 1000)
  }

  private stopDuration() {
    if (this.durationTimer) window.clearInterval(this.durationTimer)
    this.durationTimer = null
  }

  private clearTimeoutTimer() {
    if (this.timeoutTimer) window.clearTimeout(this.timeoutTimer)
    this.timeoutTimer = null
  }

  private finish(status: 'answered' | 'declined' | 'no-answer', reason: string) {
    const wasActive = this.phase === 'active'
    this.clearTimeoutTimer()
    this.stopDuration()
    soundKit.stopRing()
    soundKit.callEnded()
    this.endReason = reason
    this.phase = 'ended'
    this.emit()

    if (this.isCaller && this.peerId) {
      void api
        .logCall({
          peerId: this.peerId,
          type: this.type,
          status,
          durationSec: wasActive ? this.durationSec : 0,
          addMessage: true,
        })
        .then((res) => {
          if (res.message && this.peerId) {
            this.msgFn?.(this.peerId, res.message)
          }
          this.refreshFn?.()
        })
        .catch(() => {})
    }
    if (this.resetTimer) window.clearTimeout(this.resetTimer)
    this.resetTimer = window.setTimeout(() => this.reset(), 2200)
  }

  private reset() {
    this.clearTimeoutTimer()
    this.stopDuration()
    if (this.resetTimer) window.clearTimeout(this.resetTimer)
    this.resetTimer = null
    // Tear down the peer connection BEFORE stopping local tracks — closing
    // the PC fires `iceconnectionstatechange` -> `closed` (which we ignore)
    // and cleanly drops the SRTP / DTLS / ICE layers in one go.
    if (this.pc) {
      // Detach handlers so the synthetic `closed` event during teardown does
      // not double-fire toasts or trigger another handleConnectionFailed().
      this.pc.ontrack = null
      this.pc.onicecandidate = null
      this.pc.onconnectionstatechange = null
      this.pc.oniceconnectionstatechange = null
      try {
        this.pc.close()
      } catch {}
      this.pc = null
    }
    // Stop every local track — failing to do this leaves the camera/mic
    // indicator light ON after the call ends (a real bug the task calls out).
    this.localStream?.getTracks().forEach((t) => t.stop())
    this.localStream = null
    this.remoteStream = null
    this.callId = null
    this.peerId = null
    this.peerName = ''
    this.type = 'voice'
    this.phase = 'idle'
    this.muted = false
    this.cameraOn = false
    this.remoteCameraOn = false
    this.durationSec = 0
    this.startedAt = null
    this.endReason = undefined
    this.pendingOffer = null
    this.pendingIce = []
    this.restartAttempted = false
    if (this.videoRespTimer) {
      window.clearTimeout(this.videoRespTimer)
      this.videoRespTimer = null
    }
    this.videoRequest = 'none'
    this.emit()
  }

  bindSocket() {
    socketClient.on('call:incoming', (p) => this.handleIncoming(p as { callId: string; from: { id: string; name: string }; type: 'voice' | 'video' }))
    socketClient.on('call:respond', (p) => void this.handleRespond(p as { callId: string; action: 'accept' | 'decline' | 'busy' }))
    socketClient.on('call:signal', (p) => void this.handleSignal(p as { callId: string; data: { kind: 'offer' | 'answer' | 'ice'; payload: unknown } }))
    socketClient.on('call:end', (p) => this.handleEnd(p as { callId: string; reason?: string }))
    socketClient.on('call:unavailable', (p) => this.handleUnavailable(p as { callId: string | null }))
    socketClient.on('call:video_request', (p) => this.handleVideoRequest((p as { callId: string }).callId))
    socketClient.on('call:video_response', (p) => {
      const d = p as { callId: string; accept: boolean }
      this.handleVideoResponse(d.callId, !!d.accept)
    })
  }
}

export const callManager = new CallManager()
