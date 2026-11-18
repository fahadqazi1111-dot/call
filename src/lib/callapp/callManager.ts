'use client'

import { socketClient } from './socket'
import { soundKit } from './sound'
import { api } from './api'
import type { CallState, CallPhase } from './types'

const ICE_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
    {
      // Free public TURN relays (Metered openrelay) so calls also connect
      // behind strict NATs and firewalls. 100% free tier, no API keys.
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
  iceCandidatePoolSize: 4,
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
  private endReason: string | undefined
  private listeners = new Set<Listener>()
  private toastFn: ((msg: string) => void) | null = null
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

  setToast(fn: (msg: string) => void) {
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
      muted: this.muted,
      cameraOn: this.cameraOn,
      remoteCameraOn: this.remoteCameraOn,
      durationSec: this.durationSec,
      endReason: this.endReason,
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

  private toast(msg: string) {
    this.toastFn?.(msg)
  }

  // ---------- media helpers ----------

  private async getMedia(withVideo: boolean): Promise<MediaStream> {
    const constraints: MediaStreamConstraints = withVideo
      ? {
          audio: { echoCancellation: true, noiseSuppression: true },
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        }
      : { audio: { echoCancellation: true, noiseSuppression: true }, video: false }
    return navigator.mediaDevices.getUserMedia(constraints)
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
    try {
      this.localStream = await this.getMedia(this.cameraOn)
    } catch {
      this.reset()
      this.toast(type === 'video' ? 'Camera and microphone are needed for video calls' : 'Microphone permission is needed for calls')
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
      socketClient.emit('call:respond', { callId: this.callId, to: this.peerId, action: 'decline' })
      this.reset()
      this.toast('Microphone/camera permission is needed for calls')
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
    const pc = new RTCPeerConnection(ICE_CONFIG)
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
        this.finish('no-answer', 'Connection failed')
      } else if (st === 'disconnected') {
        window.setTimeout(() => {
          if (pc.connectionState === 'disconnected') {
            this.finish(this.phase === 'active' ? 'answered' : 'no-answer', 'Connection lost')
          }
        }, 4000)
      }
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
      if (this.pc && this.pc.signalingState !== 'closed') {
        await this.answerOffer(payload as RTCSessionDescriptionInit)
      } else {
        this.pendingOffer = payload as RTCSessionDescriptionInit
      }
    } else if (kind === 'answer' && this.isCaller && this.pc) {
      if (this.pc.signalingState === 'have-local-offer') {
        await this.pc.setRemoteDescription(new RTCSessionDescription(payload as RTCSessionDescriptionInit))
      }
    } else if (kind === 'ice' && this.pc && payload) {
      try {
        await this.pc.addIceCandidate(new RTCIceCandidate(payload as RTCIceCandidateInit))
      } catch {}
    }
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
      } catch {
        this.toast('Camera not available')
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
    this.localStream?.getTracks().forEach((t) => t.stop())
    try {
      this.pc?.close()
    } catch {}
    this.pc = null
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
    this.emit()
  }

  bindSocket() {
    socketClient.on('call:incoming', (p) => this.handleIncoming(p as { callId: string; from: { id: string; name: string }; type: 'voice' | 'video' }))
    socketClient.on('call:respond', (p) => void this.handleRespond(p as { callId: string; action: 'accept' | 'decline' | 'busy' }))
    socketClient.on('call:signal', (p) => void this.handleSignal(p as { callId: string; data: { kind: 'offer' | 'answer' | 'ice'; payload: unknown } }))
    socketClient.on('call:end', (p) => this.handleEnd(p as { callId: string; reason?: string }))
    socketClient.on('call:unavailable', (p) => this.handleUnavailable(p as { callId: string | null }))
  }
}

export const callManager = new CallManager()
