'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Mic, MicOff, Hand, MessageSquareText, Gift, LogOut, X, Send,
  Crown, Shield, Volume2, HandMetal, Loader2, Smile, ArrowDownToLine,
  ChevronUp, ChevronDown, Radio,
} from 'lucide-react'
import { api } from '@/lib/callapp/api'
import { useApp } from '@/lib/callapp/store'
import { roomManager, type RoomManagerState } from '@/lib/callapp/roomManager'
import { socketClient } from '@/lib/callapp/socket'
import { soundKit } from '@/lib/callapp/sound'
import { Avatar } from './Avatar'
import { GiftPickerSheet, GiftAnimationLayer, animFromPayload, type GiftAnim } from './GiftsUI'
import { VOICE_FX, createFxStream } from '@/lib/callapp/voiceFx'
import type { GiftSessionStats, RoomChatMsg, RoomUserState } from '@/lib/callapp/types'

const REACTIONS = ['👍', '❤️', '😂', '🎉', '😮', '🔥']

export function RoomScreen({
  roomId,
  title,
  entryPaid,
  onClose,
}: {
  roomId: string
  title: string
  entryPaid: boolean
  onClose: () => void
}) {
  const me = useApp((s) => s.me)
  const [state, setState] = useState<RoomManagerState | null>(null)
  const [chat, setChat] = useState<RoomChatMsg[]>([])
  const [chatOpen, setChatOpen] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [giftTarget, setGiftTarget] = useState<RoomUserState | null>(null)
  const [giftOpen, setGiftOpen] = useState(false)
  const [anims, setAnims] = useState<GiftAnim[]>([])
  const [giftStats, setGiftStats] = useState<GiftSessionStats | null>(null)
  const [reacts, setReacts] = useState<{ key: number; emoji: string; x: number }[]>([])
  const [voiceFx, setVoiceFx] = useState('original')
  const [fxBusy, setFxBusy] = useState(false)
  const [confirmInvite, setConfirmInvite] = useState(false)
  const [notice, setNotice] = useState('')
  const animKey = useRef(0)
  const myRoleRef = useRef<string>('listener')

  /* ---------- join + bind ---------- */
  useEffect(() => {
    if (!me) return
    const unsub = roomManager.subscribe((s) => setState(s))
    let disposed = false
    const run = async () => {
      try {
        // my persisted role (host if I created it)
        let role = 'listener'
        try {
          const detail = await api.room(roomId)
          role = detail.membership?.role ?? 'listener'
          if (detail.room.host.id === me.id) role = 'host'
        } catch {}
        myRoleRef.current = role
        // default mic (no FX) — injected so mute controls work consistently
        try {
          const raw = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
          if (disposed) {
            raw.getTracks().forEach((t) => t.stop())
            return
          }
          roomManager.setMicStream(raw)
        } catch {}
        await roomManager.join(roomId, me, role)
        // chat history
        try {
          const res = await api.roomMessages(roomId)
          if (!disposed) setChat(res.messages)
        } catch {}
      } catch {
        if (!disposed) setNotice('Could not join the room')
      }
    }
    void run()
    return () => {
      disposed = true
      unsub()
      roomManager.scheduleLeave()
    }
  }, [roomId])

  /* ---------- realtime chat / reactions / gifts ---------- */
  useEffect(() => {
    const onChat = (p: unknown) => {
      const d = p as { roomId: string; message: RoomChatMsg }
      if (d.roomId === roomId) setChat((c) => [...c.slice(-80), d.message])
    }
    const onReact = (p: unknown) => {
      const d = p as { roomId: string; emoji: string; from: { name: string } }
      if (d.roomId !== roomId) return
      soundKit.pop(false)
      const key = ++animKey.current
      setReacts((r) => [...r, { key, emoji: d.emoji, x: 8 + Math.random() * 78 }])
      window.setTimeout(() => setReacts((r) => r.filter((x) => x.key !== key)), 2600)
    }
    const onGift = (p: unknown) => {
      const d = p as { roomId: string; payload: {
        gift: { name: string; emoji: string; animKind: string; sound: string; durationMs: number; priceUsd: number }
        from: { id: string; name: string; avatarKey: number; avatarUrl: string | null }
        to: { id: string; name: string; avatarKey: number; avatarUrl: string | null }
      } }
      if (d.roomId !== roomId) return
      // Animation + sound are driven SOLELY by the server-verified fulfillment
      // event — nothing is ever shown before the payment is confirmed.
      const anim = animFromPayload(d.payload)
      soundKit.gift(Math.min(3, Math.floor((d.payload.gift.priceUsd ?? 0) / 10)))
      setAnims((a) => [...a, anim])
      window.setTimeout(() => setAnims((a) => a.filter((x) => x.key !== anim.key)), d.payload.gift.durationMs + 300)
      void api.giftStats({ roomId }).then(setGiftStats).catch(() => {})
    }
    const onRemoved = (p: unknown) => {
      const d = p as { roomId: string; reason: string }
      if (d.roomId !== roomId) return
      setNotice(d.reason === 'block' ? 'You were blocked from this room' : 'You were removed from the room')
      window.setTimeout(() => onClose(), 1200)
    }
    const offChat = socketClient.on('room:chat', onChat)
    const offReact = socketClient.on('room:react', onReact)
    const offGift = socketClient.on('room:gift', onGift)
    const offRemoved = socketClient.on('room:removed', onRemoved)
    return () => {
      offChat()
      offReact()
      offGift()
      offRemoved()
    }
  }, [roomId, onClose])

  const st = state
  const myRole = st?.me?.role ?? myRoleRef.current
  const isHostLike = myRole === 'host' || myRole === 'cohost'
  const iAmHost = myRole === 'host'
  const speakers = (st?.participants ?? []).filter((p) => ['host', 'cohost', 'speaker'].includes(p.role))
  const listeners = (st?.participants ?? []).filter((p) => p.role === 'listener')
  const handRaised = (st?.participants ?? []).filter((p) => p.handRaised)

  /* ---------- mic + fx ---------- */
  const toggleMute = async () => {
    await roomManager.toggleMute()
  }

  const applyFx = async (effect: string) => {
    if (fxBusy) return
    setFxBusy(true)
    try {
      if (effect === 'original') {
        // restore raw mic
        const raw = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
        roomManager.setMicStream(raw)
      } else {
        const raw = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
        const fx = await createFxStream(raw, effect as never)
        roomManager.setMicStream(fx.stream)
      }
      setVoiceFx(effect)
      // re-attach to peers
      const s = roomManager.snapshot()
      for (const p of s.participants) {
        if (p.userId === me?.id) continue
        // manager re-syncs tracks on next state update; force by re-sync
      }
      await roomManager.refreshMic()
      setNotice(effect === 'original' ? 'Original voice' : `Voice FX: ${VOICE_FX.find((v) => v.id === effect)?.name}`)
      window.setTimeout(() => setNotice(''), 2200)
    } catch {
      setNotice('Could not switch voice effect')
    } finally {
      setFxBusy(false)
    }
  }

  const sendChat = async () => {
    const text = chatInput.trim()
    if (!text) return
    setChatInput('')
    try {
      const msg = await roomManager.sendChat(text)
      if (msg) setChat((c) => [...c.slice(-80), msg])
    } catch {}
  }

  const moderate = async (action: string, targetId: string) => {
    try {
      await api.roomModerate(roomId, action, targetId)
      socketClient.emit('room:moderate', { roomId, action, targetId, by: me?.id })
    } catch (e) {
      alert((e as Error).message)
    }
  }

  const raiseHand = () => {
    const raised = !st?.me?.handRaised
    // persist via REST then broadcast
    void api
      .roomModerate(roomId, raised ? 'hand_up' : 'hand_down', me?.id ?? '')
      .then(() => socketClient.emit('room:moderate', { roomId, action: raised ? 'hand_up' : 'hand_down', targetId: me?.id, by: me?.id }))
      .catch(() => {})
    if (st?.me) {
      setState({ ...st, me: { ...st.me, handRaised: raised } })
    }
    if (raised) soundKit.pop(true)
  }

  const inviteFriends = async () => {
    if (!me) return
    try {
      const { contacts } = await api.contacts()
      const registered = contacts.filter((c) => c.user)
      if (!registered.length) {
        setNotice('No registered contacts to invite yet')
        window.setTimeout(() => setNotice(''), 2500)
        return
      }
      const names = registered.map((c) => c.name).join(', ')
      const pick = prompt(`Invite who? Registered contacts: ${names}`)
      if (!pick) return
      const c = registered.find((x) => x.name.toLowerCase() === pick.toLowerCase())
      if (!c?.user) {
        setNotice('Contact not found')
        window.setTimeout(() => setNotice(''), 2500)
        return
      }
      socketClient.emit('notify:new', {
        to: c.user.id,
        payload: {
          id: `inv${Date.now()}`,
          kind: 'room_invite',
          title: `${me.name} invited you to "${title}"`,
          body: 'Open Voice Rooms to join',
          refType: 'room',
          refId: roomId,
          read: false,
          createdAt: new Date().toISOString(),
        },
      })
      setNotice(`Invite sent to ${c.name}`)
      window.setTimeout(() => setNotice(''), 2200)
    } catch {}
  }

  const sendGiftDone = () => {
    // The animation for EVERYONE (including me) arrives via the server relay
    // after payment verification — nothing is played pre-verification.
    void api.giftStats({ roomId }).then(setGiftStats).catch(() => {})
  }

  const endRoom = async () => {
    if (!confirm('End this room for everyone?')) return
    try {
      await api.roomEnd(roomId)
      socketClient.emit('room:leave', { roomId })
      socketClient.emit('room:moderate', { roomId, action: 'close', targetId: '', by: me?.id })
    } catch {}
    onClose()
  }

  if (!st) {
    return (
      <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#12141c] text-white">
        <Loader2 className="animate-spin" size={30} />
      </div>
    )
  }

  const sessionGross = giftStats?.totals.gross ?? 0

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-gradient-to-b from-[#181b26] via-[#12141c] to-[#0b0d13] text-white">
      <GiftAnimationLayer gifts={anims} />
      {/* floating reactions */}
      <div className="pointer-events-none absolute inset-0 z-40">
        {reacts.map((r) => (
          <span key={r.key} className="react-float absolute text-3xl" style={{ left: `${r.x}%`, bottom: 110 }}>
            {r.emoji}
          </span>
        ))}
      </div>

      {/* header */}
      <header className="flex items-center gap-3 px-4 pb-2 pt-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-cbrand/20 text-cbrand">
          <Radio size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[17px] font-extrabold">{title}</h2>
          <p className="text-[11px] text-white/60">
            {st.participants.length} in room · {speakers.length}/{5} speakers
            {!entryPaid && me && <span className="ml-1 text-[#FFD166]">· free room</span>}
          </p>
        </div>
        <button className="rounded-full bg-white/10 p-2 hover:bg-white/20" onClick={() => setConfirmInvite(true)} title="Invite friends">
          <ArrowDownToLine size={18} className="rotate-180" />
        </button>
        {iAmHost ? (
          <button className="rounded-full bg-red-500/20 px-3.5 py-2 text-[12px] font-bold text-red-300 hover:bg-red-500/30" onClick={() => void endRoom()}>
            End room
          </button>
        ) : (
          <button className="rounded-full bg-white/10 p-2 hover:bg-white/20" onClick={onClose} aria-label="Leave room">
            <LogOut size={18} />
          </button>
        )}
      </header>

      {/* verified gift session stats (money, host earnings) */}
      <button
        className="mx-4 flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-left text-[11.5px] font-semibold text-white/85 transition hover:bg-white/15"
        onClick={() => void api.giftStats({ roomId }).then(setGiftStats).catch(() => {})}
        title="Verified gift stats for this room"
      >
        <Gift size={13} className="text-[#FFD166]" />
        <span>${sessionGross.toFixed(2)} in gifts</span>
        {giftStats?.topGifters?.[0] && (
          <span className="truncate text-white/55">· top: {giftStats.topGifters[0].name} ${giftStats.topGifters[0].total.toFixed(2)}</span>
        )}
      </button>

      {notice && (
        <div className="mx-4 rounded-xl bg-white/10 px-4 py-2 text-center text-[13px] font-semibold text-white/90">{notice}</div>
      )}

      {/* speaker grid */}
      <div className="flex-1 overflow-y-auto px-4 pb-2 pt-3 app-scroll">
        <div className="grid grid-cols-3 gap-3">
          {speakers.slice(0, 5).map((p) => (
            <SpeakerTile
              key={p.userId}
              user={p}
              stream={st.streams[p.userId]}
              isMe={p.userId === me?.id}
              canModerate={isHostLike && p.userId !== me?.id}
              onModerate={(action) => void moderate(action, p.userId)}
              onGift={() => setGiftTarget(p)}
            />
          ))}
          {Array.from({ length: Math.max(0, 5 - speakers.length) }).map((_, i) => (
            <div key={`empty-${i}`} className="flex aspect-square flex-col items-center justify-center rounded-[18px] border border-dashed border-white/15 text-white/30">
              <Mic size={20} />
              <span className="mt-1 text-[10px]">Empty seat</span>
            </div>
          ))}
        </div>

        {/* hand raises */}
        {handRaised.length > 0 && (
          <div className="mt-4 rounded-[16px] bg-white/10 p-3">
            <p className="pb-2 text-[12px] font-bold text-[#FFD166]">✋ Raised hands</p>
            <div className="flex flex-wrap gap-2">
              {handRaised.map((p) => (
                <div key={p.userId} className="flex items-center gap-2 rounded-full bg-white/10 px-2.5 py-1.5">
                  <Avatar name={p.name} avatarKey={p.avatarKey} size={22} src={p.avatarUrl} />
                  <span className="text-[12px] font-semibold">{p.name}</span>
                  {isHostLike && (
                    <>
                      <button className="rounded-full bg-green-500/30 px-2 py-0.5 text-[10px] font-bold text-green-300" onClick={() => void moderate('hand_ok', p.userId)}>
                        Accept
                      </button>
                      <button className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-white/70" onClick={() => void moderate('hand_no', p.userId)}>
                        Reject
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* listeners */}
        <div className="mt-4">
          <p className="pb-2 text-[12px] font-bold text-white/50">Listeners ({listeners.length})</p>
          <div className="flex flex-wrap gap-2">
            {listeners.slice(0, 30).map((p) => (
              <div key={p.userId} className="flex items-center gap-1.5 rounded-full bg-white/5 py-1 pl-1 pr-2.5">
                <Avatar name={p.name} avatarKey={p.avatarKey} size={24} src={p.avatarUrl} />
                <span className="max-w-[90px] truncate text-[11px] text-white/80">{p.name}</span>
                {isHostLike && p.userId !== me?.id && (
                  <button className="text-[10px] font-bold text-red-300" onClick={() => void moderate('kick', p.userId)}>
                    ✕
                  </button>
                )}
              </div>
            ))}
            {listeners.length === 0 && <span className="text-[12px] text-white/40">No listeners yet</span>}
          </div>
        </div>
      </div>

      {/* voice fx strip */}
      <div className="flex gap-1.5 overflow-x-auto px-4 py-2 stories-scroll">
        {VOICE_FX.slice(0, 8).map((f) => (
          <button
            key={f.id}
            className={`flex-none rounded-full px-3 py-1.5 text-[11px] font-semibold transition ${
              voiceFx === f.id ? 'bg-white text-black' : 'bg-white/10 text-white/75 hover:bg-white/20'
            }`}
            disabled={fxBusy}
            onClick={() => void applyFx(f.id)}
          >
            {f.emoji} {f.name}
          </button>
        ))}
      </div>

      {/* bottom controls */}
      <div className="flex items-center justify-around px-6 pb-8 pt-2">
        <button
          className={`flex h-[54px] w-[54px] items-center justify-center rounded-full transition ${
            st.micMuted ? 'bg-red-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'
          }`}
          onClick={() => void toggleMute()}
          title={st.micMuted ? 'Unmute' : 'Mute'}
        >
          {st.micMuted ? <MicOff size={22} /> : <Mic size={22} />}
        </button>
        <button
          className={`flex h-[54px] w-[54px] items-center justify-center rounded-full transition ${
            st.me?.handRaised ? 'bg-[#FFD166] text-black' : 'bg-white/10 text-white hover:bg-white/20'
          }`}
          onClick={raiseHand}
          title="Raise hand"
        >
          <Hand size={22} />
        </button>
        <button
          className="flex h-[54px] w-[54px] items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          onClick={() => {
            const emoji = REACTIONS[Math.floor(Math.random() * REACTIONS.length)]
            roomManager.react(emoji)
            const key = ++animKey.current
            setReacts((r) => [...r, { key, emoji, x: 45 }])
            window.setTimeout(() => setReacts((r) => r.filter((x) => x.key !== key)), 2600)
          }}
          title="Send reaction"
        >
          <Smile size={22} />
        </button>
        <button
          className="flex h-[54px] w-[54px] items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          onClick={() => setChatOpen(true)}
          title="Room chat"
        >
          <MessageSquareText size={22} />
        </button>
        <button
          className="flex h-[58px] w-[58px] items-center justify-center rounded-full bg-gradient-to-r from-[#F59E0B] to-[#E1306C] text-white shadow-lg"
          onClick={() => {
            const eligible = (st.participants ?? []).filter((p) => (p.role === 'host' || p.role === 'cohost') && p.userId !== me?.id)
            if (eligible.length === 0) {
              setNotice('No eligible gift recipient — only hosts and co-hosts can receive gifts')
              window.setTimeout(() => setNotice(''), 2600)
              return
            }
            setGiftOpen(true)
          }}
          title="Send gift (direct payment)"
        >
          <Gift size={24} />
        </button>
      </div>

      {/* chat drawer */}
      {chatOpen && (
        <div className="absolute inset-x-0 bottom-0 z-50 flex h-[55%] flex-col rounded-t-[24px] bg-[#181b26] shadow-2xl">
          <div className="flex items-center justify-between px-4 py-3">
            <h3 className="font-bold">Room chat</h3>
            <button className="rounded-full bg-white/10 p-2" onClick={() => setChatOpen(false)}>
              <X size={18} />
            </button>
          </div>
          <div className="app-scroll flex-1 space-y-2 overflow-y-auto px-4 pb-2">
            {chat.length === 0 && <p className="pt-6 text-center text-sm text-white/40">No messages yet — say salam!</p>}
            {chat.map((m, i) => (
              <div key={m.id ?? i} className="flex gap-2">
                <div className="min-w-0 flex-1 rounded-xl bg-white/10 px-3 py-2">
                  <span className="text-[12px] font-bold text-cbrand">{m.name}</span>
                  <span className="ml-2 text-[13px] text-white/90">{m.text}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 px-4 pb-6 pt-2">
            <input
              className="h-11 flex-1 rounded-full bg-white/10 px-4 text-sm outline-none placeholder:text-white/40"
              placeholder="Message the room…"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void sendChat()}
            />
            <button className="flex h-11 w-11 items-center justify-center rounded-full bg-cbrand" onClick={() => void sendChat()}>
              <Send size={18} />
            </button>
          </div>
        </div>
      )}

      {/* gift picker — recipients are always eligible hosts, never me */}
      {giftOpen && me && (
        <GiftPickerSheet
          context="room"
          preselectedRecipientId={giftTarget && giftTarget.userId !== me.id ? giftTarget.userId : undefined}
          extra={{ roomId }}
          onSent={sendGiftDone}
          onClose={() => {
            setGiftOpen(false)
            setGiftTarget(null)
          }}
        />
      )}

      {/* invite sheet */}
      {confirmInvite && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 px-8" onClick={() => setConfirmInvite(false)}>
          <div className="w-full max-w-sm rounded-[22px] bg-[#181b26] p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm text-white/80">Invite friends from your contacts to this room. Registered contacts get a notification.</p>
            <button className="mt-4 w-full rounded-full bg-cbrand py-3 text-sm font-bold" onClick={() => void inviteFriends()}>
              Pick a contact to invite
            </button>
            <button className="mt-2 w-full rounded-full bg-white/10 py-3 text-sm font-semibold" onClick={() => setConfirmInvite(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function SpeakerTile({
  user,
  stream,
  isMe,
  canModerate,
  onModerate,
  onGift,
}: {
  user: RoomUserState
  stream?: MediaStream
  isMe: boolean
  canModerate: boolean
  onModerate: (action: string) => void
  onGift: () => void
}) {
  const [menu, setMenu] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    const el = audioRef.current
    if (!el || !stream) return
    el.srcObject = stream
    void el.play().catch(() => {})
  }, [stream])

  const roleBadge =
    user.role === 'host' ? <Crown size={14} className="text-[#FFD166]" /> : user.role === 'cohost' ? <Shield size={13} className="text-[#7DD3FC]" /> : null

  return (
    <div className="relative flex aspect-square flex-col items-center justify-center rounded-[18px] bg-white/10 p-2">
      <audio ref={audioRef} autoPlay playsInline className="hidden" />
      <div className={`relative rounded-full p-[3px] ${isMe ? 'bg-cbrand' : 'bg-white/20'}`}>
        <Avatar name={user.name} avatarKey={user.avatarKey} size={54} src={user.avatarUrl} />
        {user.muted && (
          <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white">
            <MicOff size={12} />
          </span>
        )}
        {user.handRaised && (
          <span className="absolute -left-1 -top-1 text-[16px]">✋</span>
        )}
      </div>
      <div className="flex max-w-full items-center gap-1 pt-1.5">
        {roleBadge}
        <span className="max-w-[70px] truncate text-[11px] font-semibold">{isMe ? 'You' : user.name}</span>
        {!user.muted && <Volume2 size={11} className="text-green-400" />}
      </div>

      {canModerate && (
        <button
          className="absolute right-1 top-1 rounded-full bg-black/40 p-1"
          onClick={() => setMenu((v) => !v)}
          aria-label={`Moderate ${user.name}`}
        >
          <ChevronUp size={13} />
        </button>
      )}
      {!isMe && (
        <button className="absolute left-1 top-1 rounded-full bg-black/40 p-1" onClick={onGift} aria-label={`Gift ${user.name}`}>
          <Gift size={13} />
        </button>
      )}
      {menu && canModerate && (
        <div className="absolute inset-x-0 bottom-1 z-20 mx-1 rounded-xl bg-[#0b0d13]/95 p-2 text-[11px] shadow-xl">
          <button className="block w-full rounded-lg px-2 py-1.5 text-left hover:bg-white/10" onClick={() => { onModerate('promote'); setMenu(false) }}>
            <HandMetal size={12} className="mr-1.5 inline" /> Make speaker
          </button>
          <button className="block w-full rounded-lg px-2 py-1.5 text-left hover:bg-white/10" onClick={() => { onModerate('cohost'); setMenu(false) }}>
            <Shield size={12} className="mr-1.5 inline" /> Make co-host
          </button>
          <button className="block w-full rounded-lg px-2 py-1.5 text-left hover:bg-white/10" onClick={() => { onModerate(user.muted ? 'unmute' : 'mute'); setMenu(false) }}>
            {user.muted ? '🔊 Unmute' : '🔇 Force mute'}
          </button>
          <button className="block w-full rounded-lg px-2 py-1.5 text-left hover:bg-white/10" onClick={() => { onModerate('demote'); setMenu(false) }}>
            <ChevronDown size={12} className="mr-1.5 inline" /> Move to listeners
          </button>
          <button className="block w-full rounded-lg px-2 py-1.5 text-left text-red-300 hover:bg-white/10" onClick={() => { onModerate('kick'); setMenu(false) }}>
            Remove from room
          </button>
          <button className="block w-full rounded-lg px-2 py-1.5 text-left text-red-400 hover:bg-white/10" onClick={() => { onModerate('block'); setMenu(false) }}>
            Block (can&apos;t rejoin)
          </button>
        </div>
      )}
    </div>
  )
}
