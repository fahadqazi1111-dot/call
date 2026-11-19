'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Avatar } from './Avatar'
import { useApp } from '@/lib/callapp/store'
import { callManager } from '@/lib/callapp/callManager'
import { conferenceManager, useConferenceState } from '@/lib/callapp/conferenceManager'
import { fmtDuration, lastSeenLabel } from '@/lib/callapp/utils'
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  MessageCircle,
  PhoneIncoming,
  Lock,
  Loader2,
  Users,
  UserPlus,
  Volume2,
  SwitchCamera,
} from 'lucide-react'
import type { CallState } from '@/lib/callapp/types'
import type { ConferenceSnapshot, ConfParticipant } from '@/lib/callapp/conferenceTypes'

type Quality = 'good' | 'fair' | 'poor'

export function CallOverlay({ state }: { state: CallState }) {
  const chats = useApp((s) => s.chats)
  const contacts = useApp((s) => s.contacts)
  const online = useApp((s) => s.online)
  const conf = useConferenceState()

  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const remoteAudioRef = useRef<HTMLAudioElement>(null)
  const localVideoRef = useRef<HTMLVideoElement>(null)

  /* --- 1:1 network quality (RTT via getStats, polled every 4s) --- */
  const [quality, setQuality] = useState<Quality>('good')

  /* --- speaker routing (setSinkId where supported) --- */
  const [canSink, setCanSink] = useState(false)
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([])
  const [sinkIdx, setSinkIdx] = useState(-1) // -1 = device default

  /* --- flip camera availability --- */
  const [multiCam, setMultiCam] = useState(false)

  const peerInfo = useMemo(() => {
    const fromChats = chats.find((c) => c.peer.id === state.peerId)?.peer
    if (fromChats)
      return { name: fromChats.name, avatarKey: fromChats.avatarKey, avatarUrl: fromChats.avatarUrl, lastSeen: fromChats.lastSeen }
    const fromContacts = contacts.find((c) => c.user?.id === state.peerId)?.user
    if (fromContacts)
      return {
        name: fromContacts.name,
        avatarKey: fromContacts.avatarKey,
        avatarUrl: fromContacts.avatarUrl,
        lastSeen: fromContacts.lastSeen,
      }
    return { name: state.peerName || 'Unknown', avatarKey: state.peerAvatarKey, avatarUrl: null, lastSeen: null }
  }, [chats, contacts, state.peerId, state.peerName, state.peerAvatarKey])

  const confActive = conf.phase === 'active' && !!conf.conf
  const isVideo = state.type === 'video'
  const fullscreenVideo = !confActive && isVideo && state.phase === 'active' && state.remoteCameraOn

  /** Robust media binding: muted autoplay, then unmute once playing (tap unlocks if blocked). */
  const bindRemoteMedia = (el: HTMLVideoElement | HTMLAudioElement | null) => {
    if (!el || !state.remoteStream) return
    if (el.srcObject !== state.remoteStream) {
      el.srcObject = state.remoteStream
      el.muted = true
    }
    const tryPlay = () => {
      if (el.paused) {
        void el
          .play()
          .catch(() => {
            el.muted = true
            return el.play().catch(() => {})
          })
          .finally(() => {})
      } else if (el.muted) {
        el.muted = false
      }
    }
    tryPlay()
    const iv = window.setInterval(tryPlay, 700)
    return () => window.clearInterval(iv)
  }

  useEffect(() => {
    const cleanup = bindRemoteMedia(remoteAudioRef.current)
    return cleanup
  }, [state.remoteStream, state.phase, state.remoteCameraOn])

  /* Fullscreen remote video element is ALWAYS mounted (no remount flapping when
     the camera toggles) — only its visibility changes. */
  useEffect(() => {
    const el = remoteVideoRef.current
    if (el && state.remoteStream) {
      if (el.srcObject !== state.remoteStream) el.srcObject = state.remoteStream
      const tryPlay = () => {
        if (el.paused) void el.play().catch(() => {})
      }
      tryPlay()
      const iv = window.setInterval(tryPlay, 700)
      return () => window.clearInterval(iv)
    }
  }, [state.remoteStream, state.phase, state.remoteCameraOn])

  /* Local PIP element is also always mounted while a local stream exists. */
  useEffect(() => {
    const el = localVideoRef.current
    if (el && state.localStream) {
      if (el.srcObject !== state.localStream) el.srcObject = state.localStream
      const tryPlay = () => {
        if (el.paused) void el.play().catch(() => {})
      }
      tryPlay()
      const iv = window.setInterval(tryPlay, 700)
      return () => window.clearInterval(iv)
    }
  }, [state.localStream, state.phase, state.cameraOn, state.remoteCameraOn])

  /* setSinkId capability probe (Chromium) — button hidden where unsupported. */
  useEffect(() => {
    setCanSink(typeof HTMLMediaElement !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype)
  }, [])

  /* Available alternate audio outputs + camera count (refresh on call start). */
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) return
    navigator.mediaDevices
      .enumerateDevices()
      .then((ds) => {
        setAudioOutputs(ds.filter((d) => d.kind === 'audiooutput' && d.deviceId && d.deviceId !== 'default' && d.deviceId !== 'communications'))
        setMultiCam(ds.filter((d) => d.kind === 'videoinput').length > 1)
      })
      .catch(() => {})
  }, [state.phase, conf.phase])

  /* RTT-based network quality for the active 1:1 call. */
  useEffect(() => {
    if (state.phase !== 'active' || confActive) {
      setQuality('good')
      return
    }
    let alive = true
    const tick = async () => {
      const pc = callManager.getActivePc()
      if (!pc) return
      try {
        const stats = await pc.getStats()
        let rttMs: number | null = null
        stats.forEach((r) => {
          const rep = r as { type?: string; state?: string; currentRoundTripTime?: number }
          if (rep.type === 'candidate-pair' && rep.state === 'succeeded' && typeof rep.currentRoundTripTime === 'number') {
            rttMs = rep.currentRoundTripTime * 1000
          }
        })
        if (!alive) return
        setQuality(rttMs == null ? 'good' : rttMs < 150 ? 'good' : rttMs < 400 ? 'fair' : 'poor')
      } catch {}
    }
    void tick()
    const iv = window.setInterval(tick, 4000)
    return () => {
      alive = false
      window.clearInterval(iv)
    }
  }, [state.phase, confActive])

  /** Any tap inside the call screen unlocks audio/video playback. */
  const unlockPlayback = () => {
    ;[remoteAudioRef.current, remoteVideoRef.current, localVideoRef.current].forEach((el) => {
      if (el && el.paused) void el.play().catch(() => {})
    })
  }

  const cycleSpeaker = async () => {
    const el = remoteAudioRef.current as (HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> }) | null
    if (!el?.setSinkId) return
    const nextIdx = sinkIdx + 1
    const deviceId = nextIdx < audioOutputs.length ? audioOutputs[nextIdx].deviceId : ''
    try {
      await el.setSinkId(deviceId)
      setSinkIdx(nextIdx < audioOutputs.length ? nextIdx : -1)
    } catch {}
  }

  if (state.phase === 'idle' && conf.phase === 'idle') return null

  /* ---------------- conference layout (replaces the 1:1 layout while active) ---------------- */
  if (confActive && conf.conf) {
    return (
      <div
        onPointerDown={unlockPlayback}
        className="absolute inset-0 z-[60] flex flex-col overflow-hidden bg-dark-grad text-white"
      >
        {/* top header */}
        <div className="relative z-20 flex flex-col items-center gap-1 bg-gradient-to-b from-black/55 to-transparent pb-4 pt-[max(env(safe-area-inset-top),12px)]">
          <h1 className="text-lg font-extrabold tracking-tight">
            Group {conf.conf.type === 'video' ? 'video' : 'voice'} call
          </h1>
          <p className="text-[13px] text-[#A9B6D3]">
            {conf.conf.participants.length}/{conf.conf.max} participants
          </p>
        </div>

        <ConferenceGrid conf={conf} meId={useApp.getState().me?.id ?? ''} />

        {/* controls — always pinned to the bottom */}
        <div className="relative z-20 mt-auto pb-[max(env(safe-area-inset-bottom),24px)] pt-4">
          <div className="flex flex-col items-center gap-6">
            <div className="flex items-center gap-6">
              <CallBtn
                Icon={conf.muted ? MicOff : Mic}
                label={conf.muted ? 'Unmute' : 'Mute'}
                onClick={() => conferenceManager.toggleMute()}
                activeOff={conf.muted}
              />
              {conf.conf.type === 'video' && (
                <CallBtn
                  Icon={conf.cameraOn ? Video : VideoOff}
                  label={conf.cameraOn ? 'Camera' : 'Camera off'}
                  onClick={() => void conferenceManager.toggleCamera()}
                  activeOff={!conf.cameraOn}
                />
              )}
              <CallBtn
                Icon={Users}
                label="Invite"
                onClick={() => useApp.getState().openConferenceComposer(conf.conf!.type)}
              />
            </div>
            <button
              className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-cred text-white shadow-[0_10px_28px_rgba(240,68,56,0.45)] transition-transform active:scale-95"
              aria-label="Leave group call"
              onClick={() => useApp.getState().conferenceLeave()}
            >
              <PhoneOff size={30} />
            </button>
          </div>
        </div>
      </div>
    )
  }

  const showPip = isVideo && (state.phase === 'active' || state.phase === 'connecting') && !!state.localStream && state.cameraOn

  return (
    <div
      onPointerDown={unlockPlayback}
      className={`absolute inset-0 z-[60] flex flex-col overflow-hidden bg-dark-grad text-white ${fullscreenVideo ? 'bg-black' : ''}`}
    >
      {/* remote audio - carries voice for both voice and video calls */}
      {state.remoteStream && <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />}

      {/* ---------- fullscreen remote video: ALWAYS in DOM, visibility toggled ---------- */}
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        muted
        aria-hidden={!fullscreenVideo}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
          fullscreenVideo ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      {/* ---------- local PIP: always in DOM, positioned under the header with safe-area ---------- */}
      {state.localStream && (
        <div
          aria-hidden={!showPip}
          className={`absolute right-4 top-[max(env(safe-area-inset-top),64px)] z-10 h-36 w-28 overflow-hidden rounded-2xl border-2 border-white/25 shadow-2xl transition-opacity duration-300 sm:h-44 sm:w-32 ${
            showPip ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
        >
          <video ref={localVideoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
        </div>
      )}

      {/* ---------- top gradient header: always rendered, safe-area aware ---------- */}
      <div className="relative z-20 flex flex-col items-center gap-1.5 bg-gradient-to-b from-black/55 to-transparent pb-5 pt-[max(env(safe-area-inset-top),12px)]">
        {fullscreenVideo && (
          <div className="flex flex-col items-center">
            <h1 className="text-xl font-bold">{peerInfo.name}</h1>
            <p className="text-sm text-white/80">{fmtDuration(state.durationSec)}</p>
          </div>
        )}
        <div className="flex items-center gap-2.5 text-[12.5px] font-semibold text-[#A9B6D3]">
          <Lock size={12} />
          <span>Peer-to-peer encrypted call</span>
          {state.phase === 'active' && <QualityBars level={quality} />}
        </div>
      </div>

      {/* ---------- audio-only info column: always in DOM, hidden in fullscreen-video mode ---------- */}
      <div
        className={`flex-1 flex-col items-center justify-center ${fullscreenVideo ? 'hidden' : 'flex'}`}
      >
        <div className="relative flex items-center justify-center">
          {(state.phase === 'incoming' || state.phase === 'outgoing' || state.phase === 'connecting') &&
            [0, 1, 2].map((i) => (
              <span
                key={i}
                className="ring-anim absolute h-[150px] w-[150px] rounded-full border-2 border-[#3D6BFF]"
                style={{ animationDelay: `${i}s` }}
              />
            ))}
          <Avatar name={peerInfo.name} avatarKey={peerInfo.avatarKey} size={160} src={peerInfo.avatarUrl} />
        </div>
        <h1 className="mt-8 text-[32px] font-extrabold tracking-tight">{peerInfo.name}</h1>
        <p className="mt-2.5 flex items-center gap-2 text-[16px] text-[#A9B6D3]">
          {state.phase === 'incoming' && (
            <>
              <PhoneIncoming size={16} /> Incoming {isVideo ? 'video' : 'voice'} call…
            </>
          )}
          {state.phase === 'outgoing' && <>Calling…</>}
          {state.phase === 'connecting' && (
            <>
              <Loader2 size={16} className="animate-spin" /> Connecting…
            </>
          )}
          {state.phase === 'active' && (
            <>
              {isVideo ? (state.remoteCameraOn ? 'Video call' : 'Video call (camera off)') : 'Voice call'} ·{' '}
              {fmtDuration(state.durationSec)}
            </>
          )}
          {state.phase === 'ended' && <>{state.endReason ?? 'Call ended'}</>}
        </p>
        {state.phase === 'incoming' && peerInfo.lastSeen && (
          <p className="mt-1 text-[13px] text-[#6F7FA6]">{lastSeenLabel(peerInfo.lastSeen, online[state.peerId])}</p>
        )}
      </div>

      {/* ---------- controls: mt-auto flow keeps them pinned to the bottom in every mode ---------- */}
      <div className="relative z-20 mt-auto pb-[max(env(safe-area-inset-bottom),24px)] pt-4">
        {state.phase === 'incoming' ? (
          <div className="flex items-end justify-around px-8">
            <CallBtn Icon={PhoneOff} label="Decline" red onClick={() => callManager.declineCall()} />
            <CallBtn
              Icon={MessageCircle}
              label="Message"
              onClick={() => {
                callManager.declineCall()
                const me = useApp.getState().me
                if (me && me.id !== state.peerId) {
                  useApp.getState().setTab('chats')
                  useApp.getState().openChat(state.peerId)
                }
              }}
            />
            <CallBtn
              Icon={isVideo ? Video : Mic}
              label="Accept"
              green
              onClick={() => void callManager.acceptCall()}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-6">
            {/* secondary feature row */}
            {(canSink || (isVideo && state.cameraOn && multiCam && state.phase === 'active') || (!isVideo && state.phase === 'active') || (state.phase === 'active' && state.isCaller)) && (
              <div className="flex flex-wrap items-center justify-center gap-5 px-6">
                {canSink && state.phase === 'active' && (
                  <CallBtn
                    Icon={Volume2}
                    label={sinkIdx >= 0 ? 'Speaker' : 'Audio'}
                    small
                    activeOff={sinkIdx >= 0}
                    onClick={() => void cycleSpeaker()}
                  />
                )}
                {isVideo && state.phase === 'active' && state.cameraOn && multiCam && (
                  <CallBtn Icon={SwitchCamera} label="Flip" small onClick={() => void callManager.flipCamera()} />
                )}
                {!isVideo && state.phase === 'active' && (
                  <CallBtn Icon={Video} label="Video" small onClick={() => void callManager.enableVideo()} />
                )}
                {state.phase === 'active' && state.isCaller && (
                  <CallBtn
                    Icon={UserPlus}
                    label="Add people"
                    small
                    onClick={() => void useApp.getState().upgradeCallToConference()}
                  />
                )}
              </div>
            )}
            <div className="flex items-center gap-6">
              <CallBtn
                Icon={state.muted ? MicOff : Mic}
                label={state.muted ? 'Unmute' : 'Mute'}
                onClick={() => callManager.toggleMute()}
                activeOff={state.muted}
              />
              {isVideo && (
                <CallBtn
                  Icon={state.cameraOn ? Video : VideoOff}
                  label={state.cameraOn ? 'Camera' : 'Camera off'}
                  onClick={() => void callManager.toggleCamera()}
                  activeOff={!state.cameraOn}
                />
              )}
            </div>
            <button
              className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-cred text-white shadow-[0_10px_28px_rgba(240,68,56,0.45)] transition-transform active:scale-95"
              aria-label="End call"
              onClick={() => callManager.hangup()}
            >
              <PhoneOff size={30} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/* ---------------- 1:1 network quality indicator ---------------- */

function QualityBars({ level }: { level: Quality }) {
  const color = level === 'good' ? 'bg-cgreen' : level === 'fair' ? 'bg-amber-400' : 'bg-cred'
  const label = level === 'good' ? 'Good connection' : level === 'fair' ? 'Fair connection' : 'Poor connection'
  return (
    <span className="flex items-end gap-[2.5px]" role="status" aria-label={label} title={label}>
      {[6, 9, 12].map((h) => (
        <span key={h} className={`w-[3px] rounded-[1px] ${color}`} style={{ height: h }} />
      ))}
    </span>
  )
}

/* ---------------- conference mesh grid ---------------- */

function ConferenceGrid({ conf, meId }: { conf: ConferenceSnapshot; meId: string }) {
  const participants = conf.conf?.participants ?? []
  const others = participants.filter((p) => p.userId !== meId)
  const me = participants.find((p) => p.userId === meId)
  const count = participants.length
  const cols = count <= 2 ? 1 : count <= 4 ? 2 : 3
  return (
    <div className="flex min-h-0 flex-1 flex-col px-3 pt-2 sm:px-5">
      <div
        className="grid min-h-0 flex-1 gap-2.5"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridAutoRows: 'minmax(0, 1fr)' }}
      >
        {me && <ConfTile participant={me} self stream={conferenceManager.getLocalStream() ?? undefined} muted />}
        {others.map((p) => (
          <ConfTile key={p.userId} participant={p} stream={conf.streams[p.userId]} />
        ))}
      </div>
    </div>
  )
}

function ConfTile({
  participant,
  stream,
  self = false,
  muted = false,
}: {
  participant: ConfParticipant
  stream?: MediaStream
  self?: boolean
  /** self tile: keep the audio element muted (I must not hear myself) */
  muted?: boolean
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const hasVideo = !!stream && stream.getVideoTracks().length > 0
  const showVideo = participant.cameraOn && hasVideo && !participant.connecting

  useEffect(() => {
    const v = videoRef.current
    if (v && stream) {
      if (v.srcObject !== stream) v.srcObject = stream
      const tryPlay = () => {
        if (v.paused) void v.play().catch(() => {})
      }
      tryPlay()
      const iv = window.setInterval(tryPlay, 700)
      return () => window.clearInterval(iv)
    }
  }, [stream, showVideo])

  useEffect(() => {
    const a = audioRef.current
    if (!a || !stream) return
    if (a.srcObject !== stream) a.srcObject = stream
    const tryPlay = () => {
      if (a.paused) void a.play().catch(() => {})
    }
    tryPlay()
    const iv = window.setInterval(tryPlay, 700)
    return () => window.clearInterval(iv)
  }, [stream])

  return (
    <div
      className={`relative min-h-0 overflow-hidden rounded-2xl border border-white/10 shadow-lg ${
        showVideo ? 'bg-black' : 'bg-[#141A2E]'
      }`}
    >
      {showVideo && (
        <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 h-full w-full object-cover" />
      )}
      {/* conference audio always rides a dedicated element (video stays muted) */}
      {stream && !muted && <audio ref={audioRef} autoPlay playsInline className="hidden" />}
      {stream && muted && <audio ref={audioRef} autoPlay playsInline muted className="hidden" />}

      {!showVideo && (
        <div className="flex h-full w-full flex-col items-center justify-center gap-3">
          {participant.connecting ? (
            <Loader2 size={26} className="animate-spin text-white/50" />
          ) : (
            <Avatar name={participant.name} avatarKey={participant.avatarKey} size={72} src={participant.avatarUrl} />
          )}
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2.5 pt-7">
        <span className="truncate text-[13px] font-bold text-white">
          {participant.name}
          {self && <span className="font-semibold text-white/60"> (You)</span>}
        </span>
        <span className="flex flex-none items-center gap-1.5">
          {participant.cameraOn && !showVideo && <Video size={13} className="text-white/60" />}
          {participant.muted && (
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-white">
              <MicOff size={13} />
            </span>
          )}
        </span>
      </div>
    </div>
  )
}

function CallBtn({
  Icon,
  label,
  onClick,
  red,
  green,
  activeOff,
  small = false,
}: {
  Icon: typeof Mic
  label: string
  onClick: () => void
  red?: boolean
  green?: boolean
  activeOff?: boolean
  small?: boolean
}) {
  const bg = red ? 'bg-cred' : green ? 'bg-cgreen shadow-[0_10px_28px_rgba(18,183,106,0.4)]' : activeOff ? 'bg-cred/80' : 'bg-white/14'
  return (
    <div className="flex flex-col items-center gap-2">
      <button
        className={`flex items-center justify-center rounded-full text-white transition-transform active:scale-95 ${bg} ${
          small ? 'h-[52px] w-[52px]' : 'h-[68px] w-[68px]'
        }`}
        onClick={onClick}
        aria-label={label}
      >
        <Icon size={small ? 20 : 26} />
      </button>
      <span className={`${small ? 'text-[11.5px]' : 'text-[13px]'} font-semibold text-[#C7D1E8]`}>{label}</span>
    </div>
  )
}
