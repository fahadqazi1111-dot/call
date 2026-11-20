'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { X, Send, Gift, Eye, Swords, Loader2, Check, Trophy, SmilePlus, Hand, WifiOff, Volume2 } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/callapp/api'
import { useApp } from '@/lib/callapp/store'
import { liveManager, battleManager } from '@/lib/callapp/liveManager'
import { socketClient } from '@/lib/callapp/socket'
import { soundKit } from '@/lib/callapp/sound'
import { preloadGiftMedia } from '@/lib/callapp/giftMedia'
import { Avatar } from './Avatar'
import { GiftPickerSheet, GiftAnimationLayer, animFromPayload, type GiftAnim } from './GiftsUI'
import { BattleVideoLayout } from './LiveHostScreen'
import type { LiveComment, LiveSessionItem, BattleParticipantInfo } from '@/lib/callapp/types'

const REACTION_EMOJIS = ['❤️', '😂', '😮', '🔥', '👏', '🎉', '💯', '😢']

interface ReactionFloat {
  key: number
  emoji: string
  x: number
}

interface HeartBurst {
  key: number
  x: number
  y: number
  emoji: string
}

/**
 * Live viewer: full-screen vertical video of the host (and battle
 * teams), floating comments, gift animations, viewer count, battle scores.
 * `embedded` renders it inside the reels feed container (absolute, no fixed
 * positioning) instead of covering the whole viewport.
 */
export function LiveViewerScreen({ session, onClose, embedded = false }: { session: LiveSessionItem; onClose: () => void; embedded?: boolean }) {
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
  /* host-offline watchdog: a ghost broadcast (host tab closed / camera dead)
   * never delivers a stream — after a grace period we stop the endless
   * preloader and tell the viewer what happened instead. */
  const [streamReady, setStreamReady] = useState(false)
  const [hostOffline, setHostOffline] = useState(false)
  /** autoplay with sound can be blocked — start muted and offer a tap-to-unmute */
  const [tapForSound, setTapForSound] = useState(false)
  /* TikTok-style floating reactions + double-tap hearts */
  const [reacts, setReacts] = useState<ReactionFloat[]>([])
  const [hearts, setHearts] = useState<HeartBurst[]>([])
  const [reactOpen, setReactOpen] = useState(false)
  const [battleReqSent, setBattleReqSent] = useState(false)
  const floatKey = useRef(0)
  const lastTapRef = useRef<{ t: number; x: number }>({ t: 0, x: 0 })

  const pushReaction = useCallback((emoji: string, mine: boolean) => {
    const key = ++floatKey.current
    const x = 6 + Math.random() * 78
    setReacts((r) => [...r.slice(-24), { key, emoji, x }])
    window.setTimeout(() => setReacts((r) => r.filter((x2) => x2.key !== key)), 2700)
    if (mine) soundKit.pop()
  }, [])

  const pushHeart = useCallback((x: number, y: number, emoji = '❤️') => {
    const key = ++floatKey.current
    setHearts((h) => [...h.slice(-10), { key, x, y, emoji }])
    window.setTimeout(() => setHearts((h) => h.filter((h2) => h2.key !== key)), 1400)
  }, [])

  /* dedupe across BOTH delivery paths (relayed echo + local send fallback) */
  const seenGiftsRef = useRef(new Set<string>())

  /** Play one gift animation exactly once per transaction. Used by the
   * relayed `live:gift` event AND by the local send fallback — so the gifter
   * always sees their own animation instantly even if the relay is slow.
   * Dedupe covers BOTH ids: sendId (gift-send row) and paymentId (card
   * checkout echo) so one transaction can never render twice. */
  const pushGiftAnim = useCallback((payload: {
    sendId?: string
    paymentId?: string
    gift: { name: string; emoji: string; animKind: string; sound?: string; durationMs: number; priceUsd?: number; imageUrl?: string | null }
    from: { id?: string; name: string }
    to: { name: string }
  }) => {
    const { sendId, paymentId } = payload
    if ((sendId && seenGiftsRef.current.has(sendId)) || (paymentId && seenGiftsRef.current.has(paymentId))) return
    if (sendId) seenGiftsRef.current.add(sendId)
    if (paymentId) seenGiftsRef.current.add(paymentId)
    const anim = animFromPayload(payload)
    soundKit.giftEffect(payload.gift.animKind, anim.delayMs)
    setAnims((a) => [...a, anim])
    window.setTimeout(() => setAnims((a) => a.filter((x) => x.key !== anim.key)), anim.durationMs + 400)
  }, [])

  /* ---------- join as viewer ---------- */
  useEffect(() => {
    if (!me) return
    // warm the gift media (SFX buffers + video clips) while the stream starts
    const warmT = window.setTimeout(() => preloadGiftMedia(), 1200)
    let unsub: (() => void) | null = null
    void liveManager.joinAsViewer(session.id, me)
    unsub = liveManager.subscribe((s) => {
      setViewers(s.viewers)
      // bind the first publisher's stream to the video element
      const first = Object.values(s.publisherStreams)[0]
      if (first && videoRef.current && videoRef.current.srcObject !== first) {
        const el = videoRef.current
        el.srcObject = first
        void el.play().catch(() => {
          // unmuted autoplay refused — fall back to muted, offer sound later
          el.muted = true
          void el.play().catch(() => {})
          setTapForSound(true)
        })
        setStreamReady(true)
      }
    })
    void api
      .liveComments(session.id)
      .then((res) => setComments(res.comments))
      .catch(() => {})
    return () => {
      window.clearTimeout(warmT)
      unsub?.()
      void liveManager.leave()
    }
     
  }, [session.id])

  /* ---------- host-offline watchdog ---------- */
  useEffect(() => {
    if (streamReady) return
    const t = window.setTimeout(() => {
      // only flag offline when STILL nothing is playing
      if (!videoRef.current?.srcObject || (videoRef.current.srcObject as MediaStream).getVideoTracks().every((tr) => tr.readyState !== 'live')) {
        setHostOffline(true)
      }
    }, 12000)
    return () => window.clearTimeout(t)
  }, [streamReady, session.id])

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
    const onGift = (p: unknown) => {
      const d = p as { liveId: string; payload: Parameters<typeof pushGiftAnim>[0] }
      if (d.liveId !== session.id) return
      // one animation per verified transaction — local send echoes dedupe here
      pushGiftAnim(d.payload)
    }
    const onEnded = (p: unknown) => {
      const d = p as { liveId: string }
      if (d.liveId === session.id) {
        toast.info('The live has ended')
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
    /* floating reactions from everyone in the room */
    const onReact = (p: unknown) => {
      const d = p as { liveId: string; emoji: string }
      if (d.liveId === session.id && d.emoji) pushReaction(d.emoji, false)
    }
    const onBattleResp = (p: unknown) => {
      const d = p as { liveId: string; accepted: boolean; host: { name: string } }
      if (d.liveId !== session.id) return
      if (d.accepted) toast.success(`${d.host.name} accepted your battle request — invite incoming!`)
      else {
        toast.info(`${d.host.name} declined the battle for now`)
        setBattleReqSent(false)
      }
    }
    const offC = socketClient.on('live:chat', onComment)
    const offG = socketClient.on('live:gift', onGift)
    const offE = socketClient.on('live:ended', onEnded)
    const offR = socketClient.on('live:react', onReact)
    const offBR = socketClient.on('battle:request:response', onBattleResp)
    const offS = socketClient.on('battle:started', onStart)
    const offSc = socketClient.on('battle:score', onScore)
    const offT = socketClient.on('battle:timeup', onTimeup)
    const offBE = socketClient.on('battle:ended', onBattleEnd)
    return () => {
      offC()
      offG()
      offE()
      offR()
      offBR()
      offS()
      offSc()
      offT()
      offBE()
    }
  }, [session.id, battle.id, onClose, pushReaction, pushGiftAnim])

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

  const sendReaction = (emoji: string) => {
    setReactOpen(false)
    socketClient.emit('live:react', { liveId: session.id, emoji, from: { id: me?.id, name: me?.name } })
    pushReaction(emoji, true)
  }

  /** TikTok double-tap: hearts always; during a live battle each tap scores a team */
  const handleVideoTap = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    const now = Date.now()
    const isDouble = now - lastTapRef.current.t < 320 && Math.abs(x - lastTapRef.current.x) < 12
    lastTapRef.current = { t: now, x }
    if (!isDouble) return
    const side = x < 50 ? 0 : 1
    pushHeart(Math.min(88, Math.max(12, x)), Math.min(80, Math.max(12, y)), battle.phase === 'live' ? (side === 0 ? '🔵' : '🔴') : '❤️')
    if (battle.phase === 'live' && battle.id) {
      void api
        .battleTap(battle.id, side)
        .then((res) => {
          setBattle((b) => ({
            ...b,
            sideScores: b.sideScores.map((s, i) => (i === res.side ? res.total : s)),
          }))
        })
        .catch(() => {})
    }
  }

  const requestBattle = () => {
    if (!me || battleReqSent) return
    socketClient.emit('battle:request', {
      liveId: session.id,
      hostId: session.host.id,
      from: { id: me.id, name: me.name, avatarKey: me.avatarKey, avatarUrl: me.avatarUrl ?? null },
    })
    setBattleReqSent(true)
    toast.success('Battle request sent to the host')
    window.setTimeout(() => setBattleReqSent(false), 30000)
  }

  const battleLive = battle.phase === 'live' || battle.phase === 'ended'
  const lmStreams = liveManager.snapshot().publisherStreams

  const unmuteLive = () => {
    // the same gesture also unlocks the WebAudio context — gift SFX must be
    // audible for this viewer from now on (never the silent/synth fallback)
    soundKit.unlock()
    const el = videoRef.current
    if (!el) return
    el.muted = false
    void el.play().catch(() => {
      // gesture too stale — revert to muted playback and keep the chip
      el.muted = true
      void el.play().catch(() => {})
      setTapForSound(true)
    })
    setTapForSound(false)
  }

  /* any tap anywhere on the live also counts as the sound gesture */
  useEffect(() => {
    if (!tapForSound) return
    const onGesture = () => unmuteLive()
    document.addEventListener('pointerdown', onGesture, { once: true })
    return () => document.removeEventListener('pointerdown', onGesture)
     
  }, [tapForSound])

  return (
    <div className={`${embedded ? 'absolute inset-0' : 'fixed inset-0 z-[80]'} bg-black text-white`}>
      <GiftAnimationLayer gifts={anims} />

      {/* floating reactions (TikTok-style rise from the bottom) */}
      <div className="pointer-events-none absolute inset-0 z-40 overflow-hidden">
        {reacts.map((r) => (
          <span key={r.key} className="react-float absolute text-3xl drop-shadow-lg" style={{ left: `${r.x}%`, bottom: 90 }}>
            {r.emoji}
          </span>
        ))}
      </div>

      {/* double-tap heart bursts */}
      <div className="pointer-events-none absolute inset-0 z-40 overflow-hidden">
        {hearts.map((h) => (
          <span
            key={h.key}
            className="tap-heart absolute -translate-x-1/2 -translate-y-1/2 text-[44px] drop-shadow-xl"
            style={{ left: `${h.x}%`, top: `${h.y}%` }}
          >
            {h.emoji}
          </span>
        ))}
      </div>

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
      {!battleLive && !streamReady && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <Loader2 className="animate-spin text-white/40" size={34} />
          <p className="text-[12.5px] font-semibold text-white/60">Connecting to the host…</p>
        </div>
      )}

      {/* host-offline panel — replaces the endless preloader for dead broadcasts */}
      {!battleLive && hostOffline && !streamReady && (
        <div className="absolute inset-0 z-[45] flex items-center justify-center bg-black/80 px-6 backdrop-blur-sm">
          <div className="w-full max-w-[360px] rounded-[22px] border border-white/15 bg-[#14121a] p-6 text-center shadow-2xl">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white/10">
              <WifiOff size={26} className="text-white/80" />
            </div>
            <h3 className="mt-4 text-[16px] font-extrabold">Broadcast unavailable</h3>
            <p className="mt-2 text-[12.5px] leading-[18px] text-white/70">
              The host seems to have disconnected — this broadcast can no longer be watched.
            </p>
            <button
              className="mt-5 h-11 w-full rounded-[14px] bg-gradient-to-r from-[#E1306C] to-[#7B3FE4] text-[13.5px] font-bold"
              onClick={onClose}
            >
              Back to the feed
            </button>
          </div>
        </div>
      )}

      {/* double-tap target — sits above the video, below the top bars */}
      <div className="absolute inset-0 z-10" onClick={handleVideoTap} aria-label="Double-tap to react" />

      {/* autoplay was blocked — TikTok-style tap-for-sound chip */}
      {tapForSound && !battleLive && (
        <button
          className="absolute left-1/2 top-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full bg-black/70 px-4 py-2.5 text-[13px] font-bold backdrop-blur"
          onClick={unmuteLive}
          aria-label="Tap for sound"
        >
          <Volume2 size={16} /> Tap for sound
        </button>
      )}

      {/* top bar — pushed below the reels feed header when embedded */}
      <div
        className={`absolute inset-x-0 top-0 z-30 flex items-center gap-3 bg-gradient-to-b from-black/70 to-transparent px-4 pb-10 ${
          embedded ? 'pt-[62px]' : 'pt-4'
        }`}
      >
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
        {!embedded && (
          <button className="rounded-full bg-black/50 p-2.5 backdrop-blur" onClick={onClose} aria-label="Close live">
            <X size={20} />
          </button>
        )}
      </div>

      {/* battle score strip */}
      {battleLive && (
        <div className={`absolute inset-x-0 z-30 flex items-center justify-center gap-4 ${embedded ? 'top-[118px]' : 'top-[68px]'}`}>
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

      {/* bottom interaction bar — the reels area already ends above the
          in-flow TabBar, so the bar sits flush at the container's bottom edge */}
      <div
        className={`absolute inset-x-0 z-30 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-4 pt-16 ${
          embedded ? 'bottom-0 pb-3' : 'bottom-0 pb-5'
        }`}
      >
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
          {/* reactions — TikTok-style floating emoji */}
          <div className="relative flex-none">
            <button
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 backdrop-blur transition hover:bg-white/25"
              onClick={() => setReactOpen((v) => !v)}
              aria-label="Send a reaction"
            >
              <SmilePlus size={19} />
            </button>
            {reactOpen && (
              <div className="absolute bottom-[52px] right-0 z-50 flex items-center gap-1 rounded-full bg-black/85 px-2 py-1.5 shadow-2xl ring-1 ring-white/20 backdrop-blur">
                {REACTION_EMOJIS.map((e) => (
                  <button
                    key={e}
                    className="rounded-full p-1 text-[20px] transition hover:scale-125"
                    onClick={() => sendReaction(e)}
                    aria-label={`React ${e}`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* audience → host battle request (WhatsApp-style accept flow on the host) */}
          {!battleLive && session.mode === 'solo' && (
            <button
              className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-[#7B3FE4]/90 backdrop-blur transition hover:bg-[#7B3FE4] disabled:opacity-50"
              onClick={requestBattle}
              disabled={battleReqSent}
              title="Request to battle the host"
              aria-label="Request to battle the host"
            >
              {battleReqSent ? <Hand size={18} /> : <Swords size={18} />}
            </button>
          )}
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
          onSent={(payload) => {
            // the gifter sees their own animation instantly; the relayed echo
            // is deduped by sendId — battle score still arrives via relay
            pushGiftAnim(payload as Parameters<typeof pushGiftAnim>[0])
          }}
          onClose={() => setGiftOpen(false)}
        />
      )}
    </div>
  )
}
