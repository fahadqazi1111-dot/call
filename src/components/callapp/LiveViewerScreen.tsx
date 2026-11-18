'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Send, Gift, Eye, Swords, Loader2, Check, Trophy } from 'lucide-react'
import { api } from '@/lib/callapp/api'
import { useApp } from '@/lib/callapp/store'
import { liveManager, battleManager } from '@/lib/callapp/liveManager'
import { socketClient } from '@/lib/callapp/socket'
import { soundKit } from '@/lib/callapp/sound'
import { Avatar } from './Avatar'
import { GiftPickerSheet, GiftAnimationLayer, animFromPayload, type GiftAnim } from './GiftsUI'
import { BattleVideoLayout } from './LiveHostScreen'
import type { LiveComment, LiveSessionItem, BattleParticipantInfo } from '@/lib/callapp/types'

/**
 * Live viewer: full-screen vertical video of the host (and battle
 * teams), floating comments, gift animations, viewer count, battle scores.
 */
export function LiveViewerScreen({ session, onClose }: { session: LiveSessionItem; onClose: () => void }) {
  const me = useApp((s) => s.me)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [comments, setComments] = useState<LiveComment[]>([])
  const [commentInput, setCommentInput] = useState('')
  const [viewers, setViewers] = useState(session.viewerCount)
  const [anims, setAnims] = useState<GiftAnim[]>([])
  const [giftOpen, setGiftOpen] = useState(false)
  const [battle, setBattle] = useState<{
    id: string
    phase: 'none' | 'countdown' | 'live' | 'ended'
    participants: BattleParticipantInfo[]
    endsAt: number | null
    sideScores: number[]
    winnerSide: number | null
    remaining: number | null
  }>({ id: '', phase: 'none', participants: [], endsAt: null, sideScores: [0, 0], winnerSide: null, remaining: null })
  const animKey = useRef(0)

  /* ---------- join as viewer ---------- */
  useEffect(() => {
    if (!me) return
    let unsub: (() => void) | null = null
    void liveManager.joinAsViewer(session.id, me)
    unsub = liveManager.subscribe((s) => {
      setViewers(s.viewers)
      // bind the first publisher's stream to the video element
      const first = Object.values(s.publisherStreams)[0]
      if (first && videoRef.current && videoRef.current.srcObject !== first) {
        videoRef.current.srcObject = first
        void videoRef.current.play().catch(() => {})
      }
    })
    void api
      .liveComments(session.id)
      .then((res) => setComments(res.comments))
      .catch(() => {})
    return () => {
      unsub?.()
      void liveManager.leave()
    }
     
  }, [session.id])

  /* ---------- realtime events ---------- */
  useEffect(() => {
    const seenComments = new Set<string>()
    const onComment = (p: unknown) => {
      const d = p as { liveId: string; comment: LiveComment }
      if (d.liveId !== session.id) return
      if (d.comment?.id && seenComments.has(d.comment.id)) return
      if (d.comment?.id) seenComments.add(d.comment.id)
      setComments((c) => [...c.slice(-120), d.comment])
    }
    const seenGifts = new Set<string>()
    const onGift = (p: unknown) => {
      const d = p as { liveId: string; payload: {
        sendId?: string
        gift: { name: string; emoji: string; animKind: string; sound: string; durationMs: number; priceUsd: number }
        from: { id: string; name: string; avatarKey: number; avatarUrl: string | null }
        to: { id: string; name: string; avatarKey: number; avatarUrl: string | null }
      } }
      if (d.liveId !== session.id) return
      // duplicate protection: one animation per verified transaction
      const dedupKey = d.payload.sendId || `${d.payload.gift.name}-${d.payload.from?.id}-${Date.now()}`
      if (seenGifts.has(dedupKey)) return
      seenGifts.add(dedupKey)
      // Animation is driven by the server-verified fulfillment event only,
      // with the gift's own sound effect.
      const anim = animFromPayload(d.payload)
      soundKit.giftEffect(d.payload.gift.animKind)
      setAnims((a) => [...a, anim])
      window.setTimeout(() => setAnims((a) => a.filter((x) => x.key !== anim.key)), d.payload.gift.durationMs + 400)
    }
    const onEnded = (p: unknown) => {
      const d = p as { liveId: string }
      if (d.liveId === session.id) {
        alert('The live has ended')
        onClose()
      }
    }
    /* battle events */
    const onStart = (p: unknown) => {
      const d = p as { liveId: string; battleId: string; endsAt: number; participants?: BattleParticipantInfo[] }
      if (d.liveId !== session.id) return
      soundKit.countdownTick(2)
      setBattle((b) => ({ ...b, id: d.battleId, phase: 'live', endsAt: d.endsAt, participants: d.participants ?? b.participants }))
    }
    const onScore = (p: unknown) => {
      const d = p as { liveId: string; battleId: string; side: number; added: number; total: number | null }
      if (d.liveId !== session.id || d.battleId !== battle.id) return
      setBattle((b) => ({
        ...b,
        sideScores: b.sideScores.map((s, i) => (i === d.side ? (d.total ?? s + d.added) : s)),
      }))
    }
    const onTimeup = (p: unknown) => {
      const d = p as { liveId: string; battleId: string }
      if (d.liveId !== session.id || d.battleId !== battle.id) return
      setBattle((b) => ({ ...b, phase: 'ended' }))
    }
    const onBattleEnd = (p: unknown) => {
      const d = p as { liveId: string; battleId: string; winnerSide: number | null; sideScores: number[] }
      if (d.liveId !== session.id || d.battleId !== battle.id) return
      setBattle((b) => ({ ...b, phase: 'ended', winnerSide: d.winnerSide, sideScores: d.sideScores }))
      soundKit.fanfare()
    }
    const offC = socketClient.on('live:chat', onComment)
    const offG = socketClient.on('live:gift', onGift)
    const offE = socketClient.on('live:ended', onEnded)
    const offS = socketClient.on('battle:started', onStart)
    const offSc = socketClient.on('battle:score', onScore)
    const offT = socketClient.on('battle:timeup', onTimeup)
    const offBE = socketClient.on('battle:ended', onBattleEnd)
    return () => {
      offC()
      offG()
      offE()
      offS()
      offSc()
      offT()
      offBE()
    }
  }, [session.id, battle.id, onClose])

  /* ---------- battle timer ---------- */
  useEffect(() => {
    if (battle.phase !== 'live' || !battle.endsAt) return
    const t = window.setInterval(() => {
      const remaining = Math.max(0, Math.round((battle.endsAt! - Date.now()) / 1000))
      setBattle((b) => ({ ...b, remaining }))
    }, 1000)
    return () => window.clearInterval(t)
  }, [battle.phase, battle.endsAt])

  const sendComment = async () => {
    const text = commentInput.trim()
    if (!text || !me) return
    setCommentInput('')
    try {
      const res = await api.liveSendComment(session.id, text)
      socketClient.emit('live:chat', { liveId: session.id, comment: res.comment })
      if (!comments.some((c) => c.id === res.comment.id)) {
        setComments((c) => [...c.slice(-120), res.comment])
      }
    } catch {}
  }

  const battleLive = battle.phase === 'live' || battle.phase === 'ended'
  const lmStreams = liveManager.snapshot().publisherStreams

  return (
    <div className="fixed inset-0 z-[80] bg-black text-white">
      <GiftAnimationLayer gifts={anims} />

      {/* video */}
      {battleLive ? (
        <BattleVideoLayout
          myStream={null}
          myId={me?.id ?? ''}
          participants={battle.participants}
          teamStreams={lmStreams}
          sideScores={battle.sideScores}
          phase={battle.phase}
          remaining={battle.remaining}
          countdown={null}
          winnerSide={battle.winnerSide}
        />
      ) : (
        <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover" playsInline autoPlay />
      )}
      {!battleLive && (
        <div className="absolute inset-0 -z-10 flex items-center justify-center">
          <Loader2 className="animate-spin text-white/40" size={34} />
        </div>
      )}

      {/* top bar */}
      <div className="absolute inset-x-0 top-0 z-30 flex items-center gap-3 bg-gradient-to-b from-black/70 to-transparent px-4 pb-10 pt-4">
        <Avatar name={session.host.name} avatarKey={session.host.avatarKey} size={40} src={session.host.avatarUrl} />
        <div className="flex-1">
          <p className="text-[14px] font-bold">{session.host.name}</p>
          <p className="flex items-center gap-1 text-[11px] text-white/70">
            <Eye size={12} /> {viewers} watching
          </p>
        </div>
        {session.mode === 'battle' && (
          <span className="flex items-center gap-1 rounded-full bg-[#7B3FE4]/90 px-3 py-1.5 text-[11px] font-bold">
            <Swords size={13} /> Battle live
          </span>
        )}
        <button className="rounded-full bg-black/50 p-2.5 backdrop-blur" onClick={onClose} aria-label="Close live">
          <X size={20} />
        </button>
      </div>

      {/* battle score strip */}
      {battleLive && (
        <div className="absolute inset-x-0 top-[68px] z-30 flex items-center justify-center gap-4">
          <div className={`flex items-center gap-2 rounded-2xl px-4 py-2 ${battle.winnerSide === 0 ? 'bg-[#FFD166] text-black' : 'bg-black/55 backdrop-blur'}`}>
            <div className="flex -space-x-2">
              {battle.participants.filter((p) => p.side === 0).map((p) => (
                <Avatar key={p.userId} name={p.name} avatarKey={p.avatarKey} size={22} src={p.avatarUrl} />
              ))}
            </div>
            <span className="text-[18px] font-extrabold">{battle.sideScores[0]}</span>
          </div>
          <span className="text-[12px] font-bold text-white/80">
            ⏱ {Math.floor((battle.remaining ?? 0) / 60)}:{String((battle.remaining ?? 0) % 60).padStart(2, '0')}
          </span>
          <div className={`flex items-center gap-2 rounded-2xl px-4 py-2 ${battle.winnerSide === 1 ? 'bg-[#FFD166] text-black' : 'bg-black/55 backdrop-blur'}`}>
            <span className="text-[18px] font-extrabold">{battle.sideScores[1]}</span>
            <div className="flex -space-x-2">
              {battle.participants.filter((p) => p.side === 1).map((p) => (
                <Avatar key={p.userId} name={p.name} avatarKey={p.avatarKey} size={22} src={p.avatarUrl} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* winner banner */}
      {battle.phase === 'ended' && (
        <div className="absolute inset-x-0 top-[130px] z-30 mx-auto flex w-fit items-center gap-2 rounded-full bg-[#FFD166] px-5 py-2.5 text-black">
          <Trophy size={17} />
          <span className="text-sm font-extrabold">
            {battle.winnerSide === null ? 'Draw! 🤝' : `Team ${battle.winnerSide === 0 ? 'A' : 'B'} wins ${battle.sideScores[0]}—${battle.sideScores[1]}`}
          </span>
        </div>
      )}

      {/* bottom interaction bar */}
      <div className="absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-4 pb-5 pt-16">
        <div className="mb-3 max-h-[150px] space-y-1.5 overflow-y-auto app-scroll">
          {comments.slice(-30).map((c, i) => (
            <p key={c.id ?? i} className="text-[13px] text-white/95">
              <span className="font-bold text-[#FFD166]">{c.name}</span> {c.text}
            </p>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            className="h-11 min-w-0 flex-1 rounded-full border border-white/25 bg-white/10 px-4 text-sm outline-none backdrop-blur placeholder:text-white/50"
            placeholder="Add a comment…"
            value={commentInput}
            onChange={(e) => setCommentInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void sendComment()}
          />
          <button
            className="flex h-11 flex-none items-center gap-1.5 rounded-full bg-gradient-to-r from-[#F59E0B] to-[#E1306C] px-4 text-[13px] font-bold"
            onClick={() => setGiftOpen(true)}
          >
            <Gift size={16} /> Gift
          </button>
          <button className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-white text-black" onClick={() => void sendComment()}>
            <Send size={17} />
          </button>
        </div>
        <p className="flex items-center justify-center gap-1 pt-2 text-[10px] text-white/50">
          <Check size={11} /> Gifts are direct card payments — hosts earn real money after verified checkout
        </p>
      </div>

      {/* gift picker — host/battle-team selection happens inside the sheet */}
      {giftOpen && me && (
        <GiftPickerSheet
          context={battleLive ? 'battle' : 'live'}
          extra={
            battleLive
              ? { liveId: session.id, battleId: battle.id }
              : { liveId: session.id }
          }
          onSent={() => {
            // animation + battle score arrive via the server-verified relay
          }}
          onClose={() => setGiftOpen(false)}
        />
      )}
    </div>
  )
}
