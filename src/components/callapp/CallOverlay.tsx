'use client'

import { useEffect, useMemo, useRef } from 'react'
import { Avatar } from './Avatar'
import { useApp } from '@/lib/callapp/store'
import { callManager } from '@/lib/callapp/callManager'
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
  Signal,
} from 'lucide-react'
import type { CallState } from '@/lib/callapp/types'

export function CallOverlay({ state }: { state: CallState }) {
  const chats = useApp((s) => s.chats)
  const contacts = useApp((s) => s.contacts)
  const online = useApp((s) => s.online)

  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const remoteAudioRef = useRef<HTMLAudioElement>(null)
  const localVideoRef = useRef<HTMLVideoElement>(null)

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

  /** Any tap inside the call screen unlocks audio/video playback. */
  const unlockPlayback = () => {
    ;[remoteAudioRef.current, remoteVideoRef.current, localVideoRef.current].forEach((el) => {
      if (el && el.paused) void el.play().catch(() => {})
    })
  }

  if (state.phase === 'idle') return null

  const isVideo = state.type === 'video'

  return (
    <div
      onPointerDown={unlockPlayback}
      className={`absolute inset-0 z-[60] flex flex-col overflow-hidden ${isVideo && state.phase === 'active' && state.remoteCameraOn ? 'bg-black' : 'bg-dark-grad'} text-white`}
    >
      {/* remote audio - carries voice for both voice and video calls */}
      {state.remoteStream && <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />}

      {/* ---------- video call active: fullscreen remote ---------- */}
      {isVideo && state.phase === 'active' && state.remoteCameraOn && (
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      {isVideo && (state.phase === 'active' || state.phase === 'connecting') && state.localStream && state.cameraOn && (
        <div className="absolute right-4 top-16 z-10 h-44 w-32 overflow-hidden rounded-2xl border-2 border-white/25 shadow-2xl">
          <video ref={localVideoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
        </div>
      )}

      {/* ---------- audio-only layout / video before connect ---------- */}
      {!(isVideo && state.phase === 'active' && state.remoteCameraOn) && (
        <div className="flex flex-1 flex-col items-center justify-center">
          <div className="mb-8 flex items-center gap-1.5 text-[13px] font-semibold text-[#A9B6D3]">
            <Lock size={13} /> Peer-to-peer encrypted call
          </div>
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
                <span className="text-cgreen">
                  <Signal size={16} />
                </span>
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
      )}

      {/* ---------- video active: name/duration on top ---------- */}
      {isVideo && state.phase === 'active' && (
        <div className="absolute left-0 right-0 top-0 z-10 flex flex-col items-center bg-gradient-to-b from-black/60 to-transparent pb-6 pt-12">
          <h1 className="text-xl font-bold">{peerInfo.name}</h1>
          <p className="text-sm text-white/80">{fmtDuration(state.durationSec)}</p>
        </div>
      )}

      {/* ---------- controls ---------- */}
      <div className="relative z-20 pb-10 pt-4">
        {state.phase === 'incoming' ? (
          <div className="flex items-end justify-around px-8">
            <CallBtn
              Icon={PhoneOff}
              label="Decline"
              red
              onClick={() => callManager.declineCall()}
            />
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
          <div className="flex flex-col items-center gap-7">
            <div className="flex items-center gap-6">
              <CallBtn Icon={state.muted ? MicOff : Mic} label={state.muted ? 'Unmute' : 'Mute'} onClick={() => callManager.toggleMute()} activeOff={state.muted} />
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

function CallBtn({
  Icon,
  label,
  onClick,
  red,
  green,
  activeOff,
}: {
  Icon: typeof Mic
  label: string
  onClick: () => void
  red?: boolean
  green?: boolean
  activeOff?: boolean
}) {
  const bg = red ? 'bg-cred' : green ? 'bg-cgreen shadow-[0_10px_28px_rgba(18,183,106,0.4)]' : activeOff ? 'bg-cred/80' : 'bg-white/14'
  return (
    <div className="flex flex-col items-center gap-2">
      <button
        className={`flex h-[68px] w-[68px] items-center justify-center rounded-full text-white transition-transform active:scale-95 ${bg}`}
        onClick={onClick}
        aria-label={label}
      >
        <Icon size={26} />
      </button>
      <span className="text-[13px] font-semibold text-[#C7D1E8]">{label}</span>
    </div>
  )
}
