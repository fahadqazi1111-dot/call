'use client'

import { useState, useEffect } from 'react'
import { socketClient } from './socket'
import { soundKit } from './sound'
import { callManager } from './callManager'
import type { ConfIncoming, ConferenceSnapshot, ConfParticipant } from './conferenceTypes'

const ICE_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
    {
      // Free public TURN relays (same as 1:1 calls) so the mesh also connects
      // behind strict NATs and firewalls.
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

const INVITE_TIMEOUT_MS = 45000
const MAX_PEER_RETRIES = 3
const PEER_RETRY_DELAY_MS = 1500
const DISCONNECT_GRACE_MS = 6000

type Listener = (s: ConferenceSnapshot) => void

interface SignalMsg {
  kind: 'offer' | 'answer' | 'ice'
  payload: unknown
}

/**
 * Multi-party conference client (WebRTC full mesh, audio + video).
 *
 * Topology & glare rules (copied from roomManager's proven pattern):
 *  - every participant keeps ONE RTCPeerConnection per OTHER participant
 *  - anti-glare: the participant with the LOWER userId string initiates the
 *    initial offer; renegotiations (camera enable) are always initiated by the
 *    side that is adding media
 *  - ICE candidates that arrive before the remote description is set are
 *    buffered per-peer and flushed afterwards (liveManager pattern)
 *  - a failed peer is recreated automatically (up to 3 attempts, 1.5s apart)
 *
 * The conference lifecycle (membership, capacity, invites) is authoritative on
 * the socket service; conf:state is the single source of truth.
 */
class ConferenceManager {
  private state: ConferenceSnapshot = {
    conf: null,
    phase: 'idle',
    streams: {},
    muted: false,
    cameraOn: false,
    invite: null,
    maxParticipants: 5,
    composerOpen: null,
  }
  private listeners = new Set<Listener>()
  private peers = new Map<string, RTCPeerConnection>()
  /** ICE candidates buffered per-peer until the remote description is set */
  private pendingIce = new Map<string, RTCIceCandidateInit[]>()
  /** offers received while we were mid-negotiation (have-local-offer) */
  private pendingOffers = new Map<string, RTCSessionDescriptionInit>()
  /** failed-peer recreation attempt counters */
  private pcRetries = new Map<string, number>()
  private localStream: MediaStream | null = null
  private me: { id: string; name: string; avatarKey: number; avatarUrl: string | null } | null = null
  private bound = false
  private inviteTimer: number | null = null
  private createTimer: number | null = null
  private pendingInvites: { id: string }[] = []
  private toastFn: ((msg: string) => void) | null = null

  setMe(me: { id: string; name: string; avatarKey: number; avatarUrl: string | null } | null) {
    this.me = me
  }

  setToast(fn: (msg: string) => void) {
    this.toastFn = fn
  }

  subscribe(fn: Listener) {
    this.listeners.add(fn)
    fn(this.snapshot())
    return () => {
      this.listeners.delete(fn)
    }
  }

  snapshot(): ConferenceSnapshot {
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

  private toast(msg: string) {
    this.toastFn?.(msg)
  }

  private myId(): string {
    return this.me?.id ?? ''
  }

  /* ---------------- composer sheet (shared CallsTab + in-call invite) ---------------- */

  openComposer(kind: 'voice' | 'video') {
    this.state.composerOpen = kind
    this.emit()
  }

  closeComposer() {
    this.state.composerOpen = null
    this.emit()
  }

  /* ---------------- creating / joining ---------------- */

  /** Create a conference; I become a participant immediately (phase active). */
  async createConference(
    type: 'voice' | 'video',
    opts?: { adoptStream?: MediaStream; muted?: boolean; cameraOn?: boolean }
  ) {
    if (!this.me) {
      this.toast('Please log in first')
      return
    }
    if (this.state.conf) {
      this.toast('Already in a group call')
      return
    }
    if (opts?.adoptStream) {
      // handed over from a 1:1 call — ownership transfers to the conference
      this.localStream = opts.adoptStream
      this.state.muted = !!opts.muted
      this.state.cameraOn = !!opts.cameraOn
    } else {
      try {
        this.localStream = await this.getMedia(type === 'video')
        this.state.muted = false
        this.state.cameraOn = type === 'video'
      } catch {
        this.toast(type === 'video' ? 'Camera and microphone are needed for group video calls' : 'Microphone permission is needed for group calls')
        return
      }
    }
    this.state.phase = 'active'
    this.emit()
    socketClient.emit('conf:create', {
      type,
      user: { id: this.me.id, name: this.me.name, avatarKey: this.me.avatarKey, avatarUrl: this.me.avatarUrl },
    })
    // safety net: if the service never answers, unwind cleanly
    if (this.createTimer) window.clearTimeout(this.createTimer)
    this.createTimer = window.setTimeout(() => {
      if (this.state.phase === 'active' && !this.state.conf) {
        this.toast('Could not create the group call — try again')
        this.teardown(true)
      }
    }, 8000)
  }

  /** CallsTab composer path: create the conference, then invite the picked users. */
  async createAndInvite(type: 'voice' | 'video', users: { id: string }[]) {
    this.pendingInvites = users.filter((u) => u.id && u.id !== this.myId())
    await this.createConference(type)
  }

  invite(users: { id: string }[]) {
    const conf = this.state.conf
    if (!conf || !users.length) return
    socketClient.emit('conf:invite', { confId: conf.id, to: users.map((u) => u.id).filter(Boolean) })
  }

  /* ---------------- incoming invite ---------------- */

  private handleIncoming(p: ConfIncoming) {
    if (!this.me) return
    if (p.from?.id === this.me.id) return
    // already in a conference (or creating one) — ignore
    if (this.state.conf || this.state.phase === 'active') {
      socketClient.emit('conf:respond', { confId: p.confId, action: 'decline' })
      return
    }
    if (this.state.invite?.confId === p.confId) return // already ringing
    this.state.invite = {
      confId: p.confId,
      from: p.from,
      inviterName: p.inviterName,
      type: p.type,
      memberCount: p.memberCount,
    }
    this.state.phase = 'invited'
    this.emit()
    soundKit.startRingtone()
    if (this.inviteTimer) window.clearTimeout(this.inviteTimer)
    this.inviteTimer = window.setTimeout(() => {
      if (this.state.invite?.confId === p.confId) {
        socketClient.emit('conf:respond', { confId: p.confId, action: 'decline' })
        this.clearInvite()
      }
    }, INVITE_TIMEOUT_MS)
  }

  private clearInvite() {
    if (this.inviteTimer) window.clearTimeout(this.inviteTimer)
    this.inviteTimer = null
    this.state.invite = null
    if (this.state.phase === 'invited') this.state.phase = 'idle'
    this.emit()
  }

  async acceptInvite() {
    const invite = this.state.invite
    if (!invite || !this.me) return
    soundKit.stopRing()
    this.clearInvite()
    try {
      this.localStream = await this.getMedia(invite.type === 'video')
      this.state.muted = false
      this.state.cameraOn = invite.type === 'video'
    } catch {
      socketClient.emit('conf:respond', { confId: invite.confId, action: 'decline' })
      this.toast('Microphone/camera permission is needed for group calls')
      return
    }
    this.state.phase = 'active'
    this.emit()
    socketClient.emit('conf:respond', {
      confId: invite.confId,
      action: 'accept',
      user: { id: this.me.id, name: this.me.name, avatarKey: this.me.avatarKey, avatarUrl: this.me.avatarUrl },
    })
  }

  declineInvite() {
    const invite = this.state.invite
    if (!invite) return
    soundKit.stopRing()
    socketClient.emit('conf:respond', { confId: invite.confId, action: 'decline' })
    this.clearInvite()
  }

  /* ---------------- server state -> mesh sync ---------------- */

  private async handleState(p: { conf: ConferenceSnapshot['conf'] }) {
    if (!p?.conf) return
    if (this.createTimer) {
      window.clearTimeout(this.createTimer)
      this.createTimer = null
    }
    const isNew = !this.state.conf || this.state.conf.id !== p.conf.id
    this.state.conf = {
      id: p.conf.id,
      type: p.conf.type,
      max: p.conf.max,
      hostId: p.conf.hostId,
      createdAt: p.conf.createdAt,
      participants: (p.conf.participants ?? []).map((u) => ({
        userId: u.userId,
        name: u.name,
        avatarKey: u.avatarKey ?? 0,
        avatarUrl: u.avatarUrl ?? null,
        muted: !!u.muted,
        cameraOn: !!u.cameraOn,
        connecting: u.userId === this.myId() ? false : (this.peers.get(u.userId)?.connectionState !== 'connected'),
      })),
    }
    this.state.maxParticipants = p.conf.max || this.state.maxParticipants
    this.emit()
    await this.syncPeers()
    // composer-created conference: flush queued invites once the conf id is known
    if (isNew && this.pendingInvites.length) {
      const ids = this.pendingInvites
      this.pendingInvites = []
      this.invite(ids)
    }
  }

  /** Create/close peer connections so the mesh matches conf:state membership. */
  private async syncPeers() {
    const conf = this.state.conf
    if (!conf) return
    const others = conf.participants.filter((u) => u.userId !== this.myId())

    // close peers that left the conference
    for (const [uid, pc] of Array.from(this.peers)) {
      if (!others.some((o) => o.userId === uid)) {
        this.closePeer(uid, pc)
      }
    }

    for (const o of others) {
      await this.ensurePeer(o.userId)
      // reflect live connection state on the participant tile
      const pc = this.peers.get(o.userId)
      const participant = conf.participants.find((x) => x.userId === o.userId)
      if (participant) participant.connecting = !pc || pc.connectionState !== 'connected'
    }
    this.emit()
  }

  private closePeer(uid: string, pc: RTCPeerConnection) {
    try {
      pc.close()
    } catch {}
    if (this.peers.get(uid) === pc) this.peers.delete(uid)
    this.pendingIce.delete(uid)
    this.pendingOffers.delete(uid)
    this.pcRetries.delete(uid)
    const streams = { ...this.state.streams }
    delete streams[uid]
    this.state.streams = streams
    const participant = this.state.conf?.participants.find((x) => x.userId === uid)
    if (participant) participant.connecting = false
  }

  /** Create a peer for `otherId`; offers only when I am the initiator (lower userId). */
  private async ensurePeer(otherId: string) {
    if (this.peers.has(otherId)) return
    const pc = await this.ensurePeerRaw(otherId)
    // ANTI-GLARE: in a peer-to-peer pair the LOWER userId string initiates.
    if (this.myId() < otherId) {
      await this.sendOffer(pc, otherId)
    }
  }

  /** Create a peer connection WITHOUT offering (remote side initiates). */
  private async ensurePeerRaw(otherId: string): Promise<RTCPeerConnection> {
    const existing = this.peers.get(otherId)
    if (existing) return existing
    const pc = new RTCPeerConnection(ICE_CONFIG)
    this.peers.set(otherId, pc)
    const remote = new MediaStream()
    this.state.streams = { ...this.state.streams, [otherId]: remote }
    this.emit()

    pc.ontrack = (e) => {
      if (!remote.getTracks().includes(e.track)) {
        remote.addTrack(e.track)
        // Fresh MediaStream object so React effects re-bind the element.
        this.state.streams = { ...this.state.streams, [otherId]: new MediaStream(remote.getTracks()) }
        this.emit()
      }
    }

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socketClient.emit('conf:signal', {
          confId: this.state.conf?.id,
          to: otherId,
          data: { kind: 'ice', payload: e.candidate.toJSON() },
        })
      }
    }

    pc.onconnectionstatechange = () => {
      this.onPeerState(otherId, pc)
    }

    // Symmetric pre-negotiated transceivers so m-lines match on both sides.
    const audioTrack = this.localStream?.getAudioTracks()[0]
    const videoTrack = this.localStream?.getVideoTracks()[0]
    const wantVideo = this.state.conf?.type === 'video' || this.state.cameraOn
    const tAudio = pc.addTransceiver('audio', { direction: 'sendrecv' })
    const tVideo = pc.addTransceiver('video', { direction: wantVideo ? 'sendrecv' : 'recvonly' })
    if (audioTrack) await tAudio.sender.replaceTrack(audioTrack).catch(() => {})
    if (videoTrack && wantVideo) await tVideo.sender.replaceTrack(videoTrack).catch(() => {})

    return pc
  }

  private onPeerState(otherId: string, pc: RTCPeerConnection) {
    const st = pc.connectionState
    const participant = this.state.conf?.participants.find((x) => x.userId === otherId)
    if (participant && this.peers.get(otherId) === pc) {
      const connected = st === 'connected'
      if (participant.connecting === connected) {
        participant.connecting = !connected
        this.emit()
      } else if (!connected) {
        participant.connecting = true
        this.emit()
      }
    }
    if (st === 'failed') {
      this.recreatePeer(otherId)
    } else if (st === 'disconnected') {
      // grace period: transient Wi-Fi blips recover on their own
      window.setTimeout(() => {
        if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          this.recreatePeer(otherId)
        }
      }, DISCONNECT_GRACE_MS)
    }
  }

  /** Failed peer: recreate after a short delay, bounded retries (max 3). */
  private recreatePeer(otherId: string) {
    if (!this.state.conf?.participants.some((x) => x.userId === otherId)) return
    const attempts = (this.pcRetries.get(otherId) ?? 0) + 1
    this.pcRetries.set(otherId, attempts)
    const old = this.peers.get(otherId)
    if (old) this.closePeer(otherId, old)
    if (attempts > MAX_PEER_RETRIES) {
      this.toast('Lost connection to a participant')
      return
    }
    window.setTimeout(() => {
      if (!this.state.conf?.participants.some((x) => x.userId === otherId)) return
      void (async () => {
        await this.ensurePeer(otherId)
      })()
    }, PEER_RETRY_DELAY_MS)
  }

  /* ---------------- signaling ---------------- */

  private async sendOffer(pc: RTCPeerConnection, to: string) {
    try {
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      socketClient.emit('conf:signal', {
        confId: this.state.conf?.id,
        to,
        data: { kind: 'offer', payload: offer },
      })
    } catch {}
  }

  /** Attach my local tracks to the negotiated transceivers (answer path). */
  private async attachMyTracks(pc: RTCPeerConnection) {
    const audioTrack = this.localStream?.getAudioTracks()[0]
    const videoTrack = this.localStream?.getVideoTracks()[0]
    const wantVideo = this.state.conf?.type === 'video' || this.state.cameraOn
    for (const t of pc.getTransceivers()) {
      const kind = t.receiver.track?.kind ?? t.sender.track?.kind
      if (kind === 'audio') {
        if (audioTrack && !t.sender.track) await t.sender.replaceTrack(audioTrack).catch(() => {})
        t.direction = audioTrack ? 'sendrecv' : 'recvonly'
      } else if (kind === 'video') {
        if (videoTrack && wantVideo && !t.sender.track) await t.sender.replaceTrack(videoTrack).catch(() => {})
        t.direction = videoTrack && wantVideo ? 'sendrecv' : 'recvonly'
      }
    }
  }

  private flushPendingIce(otherId: string, pc: RTCPeerConnection) {
    const queued = this.pendingIce.get(otherId)
    if (!queued?.length) return
    this.pendingIce.delete(otherId)
    void (async () => {
      for (const c of queued) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(c))
        } catch {}
      }
    })()
  }

  private async handleSignal(p: { confId: string; from: string; data: SignalMsg }) {
    if (!p?.from || p.from === this.myId()) return
    if (p.confId !== this.state.conf?.id) return
    if (!this.state.conf.participants.some((x) => x.userId === p.from)) return
    const { kind, payload } = p.data
    // create the peer on demand when the offer arrives first
    const pc = await this.ensurePeerRaw(p.from)

    if (kind === 'offer' && payload) {
      if (pc.signalingState === 'stable') {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(payload as RTCSessionDescriptionInit))
          this.flushPendingIce(p.from, pc)
          await this.attachMyTracks(pc)
          const answer = await pc.createAnswer()
          await pc.setLocalDescription(answer)
          socketClient.emit('conf:signal', {
            confId: this.state.conf?.id,
            to: p.from,
            data: { kind: 'answer', payload: answer },
          })
          this.pcRetries.set(p.from, 0)
        } catch {}
      } else {
        // glare guard: queue the offer, process it after our negotiation ends
        this.pendingOffers.set(p.from, payload as RTCSessionDescriptionInit)
      }
    } else if (kind === 'answer' && payload) {
      if (pc.signalingState === 'have-local-offer') {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(payload as RTCSessionDescriptionInit))
          this.flushPendingIce(p.from, pc)
          this.pcRetries.set(p.from, 0)
          const queued = this.pendingOffers.get(p.from)
          if (queued) {
            this.pendingOffers.delete(p.from)
            if ((pc.signalingState as RTCSignalingState) === 'stable') {
              await pc.setRemoteDescription(new RTCSessionDescription(queued))
              this.flushPendingIce(p.from, pc)
              await this.attachMyTracks(pc)
              const answer = await pc.createAnswer()
              await pc.setLocalDescription(answer)
              socketClient.emit('conf:signal', {
                confId: this.state.conf?.id,
                to: p.from,
                data: { kind: 'answer', payload: answer },
              })
            }
          }
        } catch {}
      }
    } else if (kind === 'ice' && payload) {
      if (pc.remoteDescription) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(payload as RTCIceCandidateInit))
        } catch {}
      } else {
        // arrived before the remote description — buffer per-peer (liveManager pattern)
        const arr = this.pendingIce.get(p.from) ?? []
        arr.push(payload as RTCIceCandidateInit)
        this.pendingIce.set(p.from, arr)
      }
    }
  }

  /* ---------------- controls ---------------- */

  toggleMute() {
    const track = this.localStream?.getAudioTracks()[0]
    if (!track) return
    track.enabled = !track.enabled
    this.state.muted = !track.enabled
    if (this.state.conf) {
      socketClient.emit('conf:media', { confId: this.state.conf.id, muted: this.state.muted, cameraOn: this.state.cameraOn })
    }
    this.emit()
  }

  async toggleCamera() {
    const conf = this.state.conf
    if (!conf) return
    let videoTrack = this.localStream?.getVideoTracks()[0]
    const wasCameraOn = this.state.cameraOn

    if (videoTrack && this.state.cameraOn) {
      videoTrack.enabled = false
      this.state.cameraOn = false
      this.pushMedia()
      this.emit()
      return
    }
    if (videoTrack && !this.state.cameraOn) {
      videoTrack.enabled = true
      this.state.cameraOn = true
      await this.renegotiateVideoIfRecvOnly()
      this.pushMedia()
      this.emit()
      return
    }
    // no camera track yet — acquire one
    try {
      const cam = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
      videoTrack = cam.getVideoTracks()[0]
      this.localStream?.addTrack(videoTrack)
    } catch {
      this.toast('Camera not available')
      return
    }
    this.state.cameraOn = true
    for (const [uid, pc] of this.peers) {
      void uid
      const tVideo = pc.getTransceivers().find((t) => t.receiver.track?.kind === 'video' || t.sender.track?.kind === 'video')
      if (tVideo) {
        tVideo.direction = 'sendrecv'
        await tVideo.sender.replaceTrack(videoTrack!).catch(() => {})
      }
    }
    // in voice conferences the video m-line may be recvonly — renegotiate
    if (!wasCameraOn && conf.type === 'voice') await this.renegotiateVideoIfRecvOnly()
    this.pushMedia()
    this.emit()
  }

  /** The side ADDING video always initiates the renegotiation offer. */
  private async renegotiateVideoIfRecvOnly() {
    for (const [uid, pc] of this.peers) {
      const tVideo = pc.getTransceivers().find((t) => t.receiver.track?.kind === 'video' || t.sender.track?.kind === 'video')
      if (tVideo && tVideo.direction === 'recvonly' && pc.signalingState === 'stable') {
        tVideo.direction = 'sendrecv'
        await this.sendOffer(pc, uid)
      }
    }
  }

  private pushMedia() {
    if (!this.state.conf) return
    socketClient.emit('conf:media', {
      confId: this.state.conf.id,
      muted: this.state.muted,
      cameraOn: this.state.cameraOn,
    })
  }

  getLocalStream(): MediaStream | null {
    return this.localStream
  }

  /* ---------------- 1:1 -> conference handoff ---------------- */

  /**
   * Upgrade the active 1:1 call: create a conference, adopt the call's local
   * stream (no second getUserMedia), end the 1:1 and ring the peer with a
   * "group call" invite. Caller-only (button is hidden for callees).
   */
  async upgradeFromCall() {
    const call = callManager.snapshot()
    if (call.phase !== 'active' || !call.peerId) {
      this.toast('You can add people once the call connects')
      return
    }
    if (this.state.conf) {
      this.toast('Already in a group call')
      return
    }
    const type = call.type === 'video' ? 'video' : 'voice'
    const adopted = callManager.detachLocalStream()
    await this.createConference(type, {
      adoptStream: adopted ?? undefined,
      muted: call.muted,
      cameraOn: call.cameraOn,
    })
    callManager.hangup()
    // ring the 1:1 peer (ConferenceInviteUI shows "wants to add you to a group call")
    this.invite([{ id: call.peerId }])
  }

  /* ---------------- leaving ---------------- */

  leave() {
    const conf = this.state.conf
    if (conf) socketClient.emit('conf:leave', { confId: conf.id })
    this.teardown(true)
  }

  /** Host ends the call for everyone (service enforces host-only). */
  endConf() {
    const conf = this.state.conf
    if (!conf) return
    socketClient.emit('conf:end', { confId: conf.id })
    this.teardown(true)
  }

  isHost(): boolean {
    return !!this.state.conf && this.state.conf.hostId === this.myId()
  }

  private teardown(silent = false) {
    if (this.createTimer) {
      window.clearTimeout(this.createTimer)
      this.createTimer = null
    }
    if (this.inviteTimer) {
      window.clearTimeout(this.inviteTimer)
      this.inviteTimer = null
    }
    this.peers.forEach((pc) => {
      try {
        pc.close()
      } catch {}
    })
    this.peers.clear()
    this.pendingIce.clear()
    this.pendingOffers.clear()
    this.pcRetries.clear()
    this.localStream?.getTracks().forEach((t) => t.stop())
    this.localStream = null
    this.pendingInvites = []
    this.state = {
      conf: null,
      phase: 'idle',
      streams: {},
      muted: false,
      cameraOn: false,
      invite: null,
      maxParticipants: this.state.maxParticipants,
      composerOpen: null,
    }
    if (!silent) this.emit()
    else this.emit()
  }

  /* ---------------- socket binding ---------------- */

  bindSocket() {
    if (this.bound) return
    this.bound = true
    socketClient.on('conf:state', (p) => void this.handleState(p as { conf: ConferenceSnapshot['conf'] }))
    socketClient.on('conf:incoming', (p) => this.handleIncoming(p as ConfIncoming))
    socketClient.on('conf:signal', (p) => void this.handleSignal(p as { confId: string; from: string; data: SignalMsg }))
    socketClient.on('conf:ended', (p) => {
      const confId = (p as { confId?: string })?.confId
      if (confId && this.state.conf && confId !== this.state.conf.id) return
      const wasActive = this.state.phase === 'active'
      this.teardown(true)
      if (wasActive) this.toast('Group call ended')
    })
    socketClient.on('conf:full', (p) => {
      const d = p as { confId: string; max: number }
      this.toast(`Conference is full (max ${d?.max ?? this.state.maxParticipants})`)
      if (this.state.invite?.confId === d?.confId) this.clearInvite()
    })
    socketClient.on('conf:declined', (p) => {
      const d = p as { confId: string; userId: string }
      const name = this.state.conf?.participants.find((x) => x.userId === d?.userId)?.name
      if (name) this.toast(`${name} declined the invite`)
    })
    socketClient.on('conf:sync_state', (p) => {
      const conf = (p as { conf: ConferenceSnapshot['conf'] })?.conf
      if (conf && this.state.phase === 'active') {
        void this.handleState({ conf })
      } else if (!conf && this.state.phase === 'active') {
        // service lost our conference (restart) — end locally
        this.teardown(true)
        this.toast('Group call ended')
      } else if (conf && this.state.phase === 'invited') {
        // stale invite — the conference already moved on
        this.clearInvite()
      }
    })
    socketClient.on('connect', () => {
      // reconnect recovery: rebuild membership from the service
      if (this.state.phase === 'active') {
        socketClient.emit('conf:sync', {})
      }
    })
  }

  private async getMedia(withVideo: boolean): Promise<MediaStream> {
    const constraints: MediaStreamConstraints = withVideo
      ? {
          audio: { echoCancellation: true, noiseSuppression: true },
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        }
      : { audio: { echoCancellation: true, noiseSuppression: true }, video: false }
    return navigator.mediaDevices.getUserMedia(constraints)
  }
}

export const conferenceManager = new ConferenceManager()

/** React binding for components that render the conference UI. */
export function useConferenceState(): ConferenceSnapshot {
  const [s, setS] = useState<ConferenceSnapshot>(() => conferenceManager.snapshot())
  useEffect(() => conferenceManager.subscribe(setS), [])
  return s
}

export type { ConfParticipant, ConferenceSnapshot, ConfIncoming, ConfInviteUser } from './conferenceTypes'
