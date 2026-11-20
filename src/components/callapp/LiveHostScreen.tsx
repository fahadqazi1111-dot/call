'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  X, Mic, MicOff, Video, VideoOff, Send, Gift, Swords, Loader2, Eye,
  RefreshCw, Trophy, Crown, Timer, Users, SmilePlus,
} from 'lucide-react'
import { api } from '@/lib/callapp/api'
import { useApp } from '@/lib/callapp/store'
import { liveManager, battleManager, type LiveManagerState } from '@/lib/callapp/liveManager'
import { socketClient } from '@/lib/callapp/socket'
import { soundKit } from '@/lib/callapp/sound'
import { Avatar } from './Avatar'
import { GiftPickerSheet, GiftAnimationLayer, animFromPayload, type GiftAnim } from './GiftsUI'
import { BattleInviteSheet, type Person } from './BattleInviteSheet'
import type { GiftSessionStats, LiveComment, BattleParticipantInfo } from '@/lib/callapp/types'

const COUNTDOWN_MS = 8000
const REACTION_EMOJIS = ['❤️', '😂', '😮', '🔥', '👏', '🎉', '💯', '😢']

interface ReactionFloat {
  key: number
  emoji: string
  x: number
}

/**
 * Host screen: full vertical broadcast + live comments + gifts + battles.
 * Battles: invite (1v1/2v2) → countdown → side-by-side layout → gift scoring
 * → timer → winner announcement (persisted via REST).
 */
export function LiveHostScreen({
  liveId,
  title,
  mode,
  onClose,
}: {
  liveId: string
  title: string
  mode: string
  onClose: () => void
}) {
  const me = useApp((s) => s.me)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [lm, setLm] = useState<LiveManagerState | null>(null)
  const [comments, setComments] = useState<LiveComment[]>([])
  const [commentInput, setCommentInput] = useState('')
  const [anims, setAnims] = useState<GiftAnim[]>([])
  const [giftStats, setGiftStats] = useState<GiftSessionStats | null>(null)
  const [giftOpen, setGiftOpen] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [preselected, setPreselected] = useState<Person | null>(null)
  /** viewer → host battle request (WhatsApp-style prompt) */
  const [battleRequest, setBattleRequest] = useState<Person | null>(null)
  const [battle, setBattle] = useState<{
    id: string
    mode: '1v1' | '2v2'
    phase: 'inviting' | 'countdown' | 'live' | 'ended'
    participants: BattleParticipantInfo[]
    endsAt: number | null
    sideScores: number[]
    winnerSide: number | null
    remaining: number | null
  } | null>(null)
  const [countdown, setCountdown] = useState<number | null>(null)
  const animKey = useRef(0)
  const finishedRef = useRef(false)
  /* TikTok-style floating reactions (sent by the audience) */
  const [reacts, setReacts] = useState<ReactionFloat[]>([])
  const [reactOpen, setReactOpen] = useState(false)
  const floatKey = useRef(0)

  const pushReaction = useCallback((emoji: string) => {
    const key = ++floatKey.current
    const x = 6 + Math.random() * 78
    setReacts((r) => [...r.slice(-24), { key, emoji, x }])
    window.setTimeout(() => setReacts((r) => r.filter((x2) => x2.key !== key)), 2700)
  }, [])

  /* dedupe across BOTH delivery paths (relayed echo + local send fallback) */
  const seenGiftsRef = useRef(new Set<string>())

  /** Play one gift animation exactly once per transaction. Used by the
   * relayed `live:gift` event AND by the local send fallback — so the gifter
   * always sees their own animation instantly even if the relay is slow. */
  const pushGiftAnim = useCallback((payload: {
    sendId?: string
    gift: { name: string; emoji: string; animKind: string; sound?: string; durationMs: number; priceUsd?: number; imageUrl?: string | null }
    from: { id?: string; name: string }
    to: { name: string }
  }) => {
    const dedupKey = payload.sendId || `${payload.gift.name}-${payload.from?.id ?? payload.from?.name}-${Date.now()}`
    if (seenGiftsRef.current.has(dedupKey)) return
    seenGiftsRef.current.add(dedupKey)
    const anim = animFromPayload(payload)
    soundKit.giftEffect(payload.gift.animKind, anim.delayMs)
    setAnims((a) => [...a, anim])
    window.setTimeout(() => setAnims((a) => a.filter((x) => x.key !== anim.key)), anim.durationMs + 400)
  }, [])

  /* ---------- start broadcasting ---------- */
  useEffect(() => {
    let unsub: (() => void) | null = null
    let disposed = false
    const run = async () => {
      try {
        const stream = await liveManager.startPublishing(liveId, true, me?.id ?? '')
        if (disposed) return
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          void videoRef.current.play().catch(() => {})
        }
        unsub = liveManager.subscribe((s) => setLm(s))
        // comments history
        try {
          const res = await api.liveComments(liveId)
          setComments(res.comments)
        } catch {}
        // announce to contacts via notification relay (viewers see "live started")
        try {
          const { contacts } = await api.contacts()
          for (const c of contacts.filter((x) => x.user).slice(0, 50)) {
            socketClient.emit('notify:new', {
              to: c.user!.id,
              payload: {
                id: `live${Date.now()}${c.id}`,
                kind: 'live_started',
                title: `${me?.name ?? 'Someone'} is live: ${title}`,
                refType: 'live',
                refId: liveId,
                read: false,
                createdAt: new Date().toISOString(),
              },
            })
          }
        } catch {}
      } catch {
        alert('Camera and microphone are required to go live')
        onClose()
      }
    }
    void run()
    return () => {
      disposed = true
      unsub?.()
      void liveManager.leave()
    }
     
  }, [liveId])

  /* ---------- elapsed timer ---------- */
  useEffect(() => {
    const started = Date.now()
    const t = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000)
    return () => window.clearInterval(t)
  }, [])

  /* ---------- viewer heartbeat (persist viewer count) ---------- */
  useEffect(() => {
    const t = window.setInterval(() => {
      void api.liveHeartbeat(liveId, liveManager.snapshot().viewers).catch(() => {})
    }, 15000)
    return () => window.clearInterval(t)
  }, [liveId])

  /* ---------- my verified earnings for this session ---------- */
  useEffect(() => {
    void api.giftStats({ liveId }).then(setGiftStats).catch(() => {})
  }, [liveId])

  /* ---------- realtime events ---------- */
  useEffect(() => {
    const seenComments = new Set<string>()
    const onComment = (p: unknown) => {
      const d = p as { liveId: string; comment: LiveComment }
      if (d.liveId !== liveId) return
      if (d.comment?.id && seenComments.has(d.comment.id)) return
      if (d.comment?.id) seenComments.add(d.comment.id)
      setComments((c) => [...c.slice(-120), d.comment])
    }
    const onGift = (p: unknown) => {
      const d = p as { liveId: string; payload: Parameters<typeof pushGiftAnim>[0] }
      if (d.liveId !== liveId) return
      // one animation per verified transaction — local send echoes dedupe here
      pushGiftAnim(d.payload)
      void api.giftStats({ liveId }).then(setGiftStats).catch(() => {})
      // battle score updates also arrive via the relayed battle:score event
    }
    const onBattleScore = (p: unknown) => {
      const d = p as { liveId: string; battleId: string; side: number; added: number; total: number | null }
      if (d.liveId !== liveId || !battle || d.battleId !== battle.id) return
      setBattle((b) =>
        b
          ? {
              ...b,
              sideScores: b.sideScores.map((s, i) => (i === d.side ? (d.total ?? s + d.added) : s)),
            }
          : b
      )
    }
    // the host UI also closes when the live ends (e.g. ended from another device)
    const onEnded = (p: unknown) => {
      const d = p as { liveId: string }
      if (d.liveId === liveId) onClose()
    }
    const offComment = socketClient.on('live:chat', onComment)
    const offGift = socketClient.on('live:gift', onGift)
    const offScore = socketClient.on('battle:score', onBattleScore)
    const offEnded = socketClient.on('live:ended', onEnded)
    const offReact = socketClient.on('live:react', (p: unknown) => {
      const d = p as { liveId: string; emoji: string }
      if (d.liveId === liveId && d.emoji) pushReaction(d.emoji)
    })
    return () => {
      offComment()
      offGift()
      offScore()
      offEnded()
      offReact()
    }
  }, [liveId, battle, onClose, pushReaction, pushGiftAnim])

  /* ---------- battle invite flow (proper popup with search + audience) ---------- */
  const invited = (battleId: string, mode: '1v1' | '2v2', parts: BattleParticipantInfo[]) => {
    battleManager.setInviting(battleId, mode, parts)
    setBattle({
      id: battleId,
      mode,
      phase: 'inviting',
      participants: parts,
      endsAt: null,
      sideScores: [0, 0],
      winnerSide: null,
      remaining: null,
    })
    setInviteOpen(false)
    setPreselected(null)
  }

  /* ---------- viewer battle requests (realtime prompt) ---------- */
  useEffect(() => {
    const onRequest = (p: unknown) => {
      const d = p as { liveId: string; from: Person }
      if (d.liveId !== liveId) return
      setBattleRequest(d.from)
      soundKit.pop()
    }
    const off = socketClient.on('battle:request', onRequest)
    return () => {
      off()
    }
  }, [liveId])

  const respondBattleRequest = (accepted: boolean) => {
    if (!battleRequest || !me) return
    socketClient.emit('battle:request:respond', {
      to: battleRequest.id,
      liveId,
      accepted,
      host: { id: me.id, name: me.name },
    })
    if (accepted) {
      // open the invite sheet with that viewer preselected (1v1)
      setPreselected(battleRequest)
      setInviteOpen(true)
    }
    setBattleRequest(null)
  }

  /* ---------- battle countdown + finish (declared before the effects use them) ---------- */
  const beginCountdown = (battleId: string, mode: '1v1' | '2v2', participants: BattleParticipantInfo[]) => {
    setBattle((b) => (b ? { ...b, phase: 'countdown' } : b))
    let left = Math.round(COUNTDOWN_MS / 1000)
    setCountdown(left)
    const tick = window.setInterval(() => {
      left -= 1
      soundKit.countdownTick(Math.min(4, Math.abs(left)))
      setCountdown(left)
      if (left <= 0) {
        window.clearInterval(tick)
        setCountdown(null)
        const endsAt = Date.now() + 120_000
        battleManager.startLive(battleId, endsAt, participants)
        socketClient.emit('battle:start', {
          liveId,
          battleId,
          endsAt,
          mode,
          participants,
        })
        setBattle((b) => (b ? { ...b, phase: 'live', endsAt } : b))
      }
    }, 1000)
  }

  const finishBattle = async () => {
    try {
      const res = await api.battleFinish(battle!.id)
      battleManager.setEnded(res.winnerSide, res.sideScores)
      setBattle((b) => (b ? { ...b, phase: 'ended', winnerSide: res.winnerSide, sideScores: res.sideScores } : b))
      socketClient.emit('battle:end', {
        liveId,
        battleId: battle!.id,
        winnerSide: res.winnerSide,
        sideScores: res.sideScores,
      })
      soundKit.fanfare()
    } catch {}
  }

  /* ---------- battle acceptance + countdown (host drives) ---------- */
  useEffect(() => {
    if (battle?.phase !== 'inviting') return
    const t = window.setInterval(async () => {
      try {
        const res = await api.battleDetail(battle.id)
        const allAccepted = res.battle.participants.every((p) => p.accepted)
        setBattle((b) => (b ? { ...b, participants: res.battle.participants } : b))
        if (allAccepted && battle.phase === 'inviting') {
          beginCountdown(battle.id, battle.mode, res.battle.participants)
        }
      } catch {}
    }, 2000)
    return () => window.clearInterval(t)
     
  }, [battle?.id, battle?.phase])

  /* ---------- battle timer + finish ---------- */
  useEffect(() => {
    if (battle?.phase !== 'live' || !battle.endsAt) return
    const t = window.setInterval(() => {
      const remaining = Math.max(0, Math.round((battle.endsAt! - Date.now()) / 1000))
      setBattle((b) => (b ? { ...b, remaining } : b))
      if (remaining <= 0 && !finishedRef.current) {
        finishedRef.current = true
        void finishBattle()
      }
    }, 1000)
    return () => window.clearInterval(t)
     
  }, [battle?.phase, battle?.endsAt])

  const endLive = async () => {
    if (battle && battle.phase === 'live' && !finishedRef.current) {
      finishedRef.current = true
      await finishBattle()
    }
    try {
      // REST DELETE is the only way to end a live — the server broadcasts
      // live:ended to every viewer itself (clients can never fake an end)
      await api.liveEnd(liveId)
    } catch {}
    onClose()
  }

  const sendComment = async () => {
    const text = commentInput.trim()
    if (!text || !me) return
    setCommentInput('')
    try {
      const res = await api.liveSendComment(liveId, text)
      socketClient.emit('live:chat', { liveId, comment: res.comment })
      if (!comments.some((c) => c.id === res.comment.id)) {
        setComments((c) => [...c.slice(-120), res.comment])
      }
    } catch {}
  }

  const battleParticipants = battle?.participants ?? []
  const teamStreams = lm?.publisherStreams ?? {}

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-black text-white">
      <GiftAnimationLayer gifts={anims} />

      {/* floating reactions from the audience */}
      <div className="pointer-events-none absolute inset-0 z-40 overflow-hidden">
        {reacts.map((r) => (
          <span key={r.key} className="react-float absolute text-3xl drop-shadow-lg" style={{ left: `${r.x}%`, bottom: 90 }}>
            {r.emoji}
          </span>
        ))}
      </div>

      {/* ===== video layer ===== */}
      {battle && (battle.phase === 'live' || battle.phase === 'ended' || battle.phase === 'countdown') ? (
        <BattleVideoLayout
          myStream={liveManager.getLocalStream()}
          myId={me?.id ?? ''}
          participants={battleParticipants}
          teamStreams={teamStreams}
          sideScores={battle.sideScores}
          phase={battle.phase}
          remaining={battle.remaining}
          countdown={countdown}
          winnerSide={battle.winnerSide}
        />
      ) : (
        <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover" playsInline muted />
      )}

      {/* ===== top bar ===== */}
      <div className="absolute inset-x-0 top-0 z-30 flex items-start gap-3 bg-gradient-to-b from-black/70 to-transparent px-4 pb-8 pt-4">
        <div className="flex items-center gap-2.5">
          <Avatar name={me?.name ?? ''} avatarKey={me?.avatarKey ?? 0} size={40} src={me?.avatarUrl} />
          <div>
            <p className="text-[14px] font-bold">{me?.name}</p>
            <p className="flex items-center gap-1 text-[11px] text-white/70">
              <Eye size={12} /> {lm?.viewers ?? 0} watching · {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}
            </p>
          </div>
        </div>
        <span className="rounded-full bg-red-500 px-2.5 py-1 text-[10px] font-bold">● LIVE</span>
        <div className="ml-auto flex gap-2">
          {!battle && (
            <button
              className="flex items-center gap-1.5 rounded-full bg-[#7B3FE4]/90 px-3.5 py-2 text-[12px] font-bold backdrop-blur"
              onClick={() => setInviteOpen(true)}
            >
              <Swords size={14} /> Battle
            </button>
          )}
          <button className="rounded-full bg-black/50 p-2.5 backdrop-blur" onClick={() => void endLive()} title="End live">
            <X size={18} />
          </button>
        </div>
      </div>

      {/* ===== my session earnings (verified money) ===== */}
      <div className="absolute left-4 top-[76px] z-30 flex items-center gap-2">
        <div className="rounded-2xl bg-black/55 px-3.5 py-2 backdrop-blur">
          <div className="text-[9.5px] font-bold uppercase tracking-wide text-white/60">My earnings</div>
          <div className="text-[15px] font-extrabold text-[#FFD166]">
            ${(giftStats?.totals.net ?? 0).toFixed(2)}
            <span className="ml-1 text-[10px] font-semibold text-white/55">of ${(giftStats?.totals.gross ?? 0).toFixed(2)} gross</span>
          </div>
        </div>
        {giftStats?.topGifters?.[0] && (
          <div className="rounded-2xl bg-black/55 px-3 py-2 backdrop-blur">
            <div className="text-[9.5px] font-bold uppercase tracking-wide text-white/60">Top gifter</div>
            <div className="max-w-[120px] truncate text-[12px] font-bold">
              {giftStats.topGifters[0].name} <span className="text-[#FFD166]">${giftStats.topGifters[0].total.toFixed(2)}</span>
            </div>
          </div>
        )}
      </div>

      {/* ===== battle score strip ===== */}
      {battle && battle.phase !== 'inviting' && (
        <div className="absolute inset-x-0 top-[68px] z-30 flex items-center justify-center gap-4 px-4">
          <div className={`flex items-center gap-2 rounded-2xl px-4 py-2 ${battle.winnerSide === 0 ? 'bg-[#FFD166] text-black' : 'bg-black/55 backdrop-blur'}`}>
            <TeamAvatars participants={battleParticipants.filter((p) => p.side === 0)} size={24} />
            <span className="text-[18px] font-extrabold">{battle.sideScores[0]}</span>
          </div>
          <span className="text-[12px] font-bold text-white/80">
            {battle.phase === 'countdown' ? 'VS' : `⏱ ${Math.floor((battle.remaining ?? 0) / 60)}:${String((battle.remaining ?? 0) % 60).padStart(2, '0')}`}
          </span>
          <div className={`flex items-center gap-2 rounded-2xl px-4 py-2 ${battle.winnerSide === 1 ? 'bg-[#FFD166] text-black' : 'bg-black/55 backdrop-blur'}`}>
            <span className="text-[18px] font-extrabold">{battle.sideScores[1]}</span>
            <TeamAvatars participants={battleParticipants.filter((p) => p.side === 1)} size={24} />
          </div>
        </div>
      )}

      {/* ===== invite status ===== */}
      {battle?.phase === 'inviting' && (
        <div className="absolute inset-x-6 top-[130px] z-30 rounded-2xl bg-black/70 p-4 backdrop-blur">
          <p className="flex items-center gap-2 text-sm font-bold">
            <Loader2 size={15} className="animate-spin" /> Waiting for opponents to accept…
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            {battleParticipants.map((p) => (
              <span
                key={p.userId}
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  p.accepted ? 'bg-green-500/30 text-green-200' : 'bg-white/10 text-white/70'
                }`}
              >
                <Avatar name={p.name} avatarKey={p.avatarKey} size={18} src={p.avatarUrl} />
                {p.name} {p.accepted ? '✓' : '…'}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ===== winner modal ===== */}
      {battle?.phase === 'ended' && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60">
          <div className="w-[86%] max-w-sm rounded-[24px] bg-[#181b26] p-7 text-center">
            <Trophy size={44} className="mx-auto text-[#FFD166]" />
            <h3 className="pt-3 text-xl font-extrabold">
              {battle.winnerSide === null ? "It's a draw! 🤝" : `Team ${battle.winnerSide === 0 ? 'A' : 'B'} WINS! 🏆`}
            </h3>
            <p className="pt-1 text-sm text-white/70">
              Final score {battle.sideScores[0]} — {battle.sideScores[1]}
            </p>
            <div className="flex justify-center gap-2 pt-4">
              {battleParticipants.map((p) => (
                <div key={p.userId} className={`rounded-xl px-3 py-2 ${p.side === battle.winnerSide ? 'bg-[#FFD166]/20' : 'bg-white/5'}`}>
                  <Avatar name={p.name} avatarKey={p.avatarKey} size={34} src={p.avatarUrl} />
                  <p className="pt-1 text-[10px] font-semibold">{p.name.split(' ')[0]}</p>
                  <p className="text-[10px] text-[#FFD166]">{p.score}</p>
                </div>
              ))}
            </div>
            <button className="mt-5 w-full rounded-full bg-white py-3 text-sm font-bold text-black" onClick={() => setBattle(null)}>
              Continue live
            </button>
          </div>
        </div>
      )}

      {/* ===== comments + controls ===== */}
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
            placeholder="Say something to your audience…"
            value={commentInput}
            onChange={(e) => setCommentInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void sendComment()}
          />
          {/* host reactions too */}
          <div className="relative flex-none">
            <button
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 backdrop-blur"
              onClick={() => setReactOpen((v) => !v)}
              title="Send a reaction"
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
                    onClick={() => {
                      setReactOpen(false)
                      socketClient.emit('live:react', { liveId, emoji: e, from: { id: me?.id, name: me?.name } })
                      pushReaction(e)
                    }}
                    aria-label={`React ${e}`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-white/10 backdrop-blur"
            onClick={() => void liveManager.toggleMic()}
            title="Mute mic"
          >
            {lm?.micMuted ? <MicOff size={18} /> : <Mic size={18} />}
          </button>
          <button
            className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-white/10 backdrop-blur"
            onClick={() => void liveManager.toggleCamera()}
            title="Toggle camera"
          >
            {lm?.cameraOn ? <Video size={18} /> : <VideoOff size={18} />}
          </button>
          <button
            className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-white/10 backdrop-blur"
            onClick={() => void liveManager.switchCamera()}
            title="Switch camera"
          >
            <RefreshCw size={18} />
          </button>
          {/* SELF-GIFTING PREVENTION: a host can never gift their own stream.
              In a battle the host may only gift the OPPOSING team. */}
          {battle?.phase === 'live' && (
            <button
              className="flex h-11 flex-none items-center gap-1.5 rounded-full bg-gradient-to-r from-[#F59E0B] to-[#E1306C] px-4 text-[13px] font-bold"
              onClick={() => setGiftOpen(true)}
            >
              <Gift size={16} /> Gift team
            </button>
          )}
          <button className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-white text-black" onClick={() => void sendComment()}>
            <Send size={17} />
          </button>
        </div>
      </div>

      {/* gift picker — battle only, opposing team, never my own side */}
      {giftOpen && me && battle && battle.phase === 'live' && (
        <GiftPickerSheet
          context="battle"
          extra={{
            liveId,
            battleId: battle.id,
            battleSide: battle.participants.some((p) => p.userId === me.id && p.side === 0) ? 1 : 0,
          }}
          onSent={(payload) => {
            // the gifter sees their own animation instantly; the relayed echo
            // is deduped by sendId — score still arrives via relay
            pushGiftAnim(payload as Parameters<typeof pushGiftAnim>[0])
            void api.giftStats({ liveId }).then(setGiftStats).catch(() => {})
          }}
          onClose={() => setGiftOpen(false)}
        />
      )}

      {/* viewer battle request prompt (WhatsApp-style) */}
      {battleRequest && (
        <div className="absolute inset-x-0 top-[120px] z-[60] flex justify-center px-4">
          <div className="w-full max-w-sm rounded-[22px] bg-[#181b26] p-4 shadow-2xl ring-1 ring-white/15">
            <div className="flex items-center gap-3">
              <Avatar name={battleRequest.name} avatarKey={battleRequest.avatarKey} size={44} src={battleRequest.avatarUrl} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14.5px] font-extrabold">{battleRequest.name}</p>
                <p className="text-[12px] text-white/60">wants to battle you in this live</p>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                className="h-11 flex-1 rounded-[14px] bg-white/10 text-[13.5px] font-bold text-white/80"
                onClick={() => respondBattleRequest(false)}
              >
                Decline
              </button>
              <button
                className="h-11 flex-1 rounded-[14px] bg-gradient-to-r from-[#7B3FE4] to-[#E1306C] text-[13.5px] font-bold"
                onClick={() => respondBattleRequest(true)}
              >
                <span className="flex items-center justify-center gap-1.5">
                  <Swords size={15} /> Accept
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* battle invite popup — search every user or pick from the live audience */}
      {inviteOpen && (
        <BattleInviteSheet liveId={liveId} preselected={preselected} onClose={() => {
          setInviteOpen(false)
          setPreselected(null)
        }} onInvited={invited} />
      )}
    </div>
  )
}

export function TeamAvatars({ participants, size = 26 }: { participants: BattleParticipantInfo[]; size?: number }) {
  return (
    <div className="flex -space-x-2">
      {participants.map((p) => (
        <Avatar key={p.userId} name={p.name} avatarKey={p.avatarKey} size={size} src={p.avatarUrl} />
      ))}
    </div>
  )
}

/** Side-by-side (1v1) / stacked-teams (2v2) battle video layout. */
export function BattleVideoLayout({
  myStream,
  myId,
  participants,
  teamStreams,
  sideScores,
  phase,
  remaining,
  countdown,
  winnerSide,
}: {
  myStream: MediaStream | null
  myId: string
  participants: BattleParticipantInfo[]
  teamStreams: Record<string, MediaStream>
  sideScores: number[]
  phase: string
  remaining: number | null
  countdown: number | null
  winnerSide: number | null
}) {
  const is2v2 = participants.filter((p) => p.side === 0).length > 1
  return (
    <div className="absolute inset-0">
      {is2v2 ? (
        <div className="grid h-full grid-rows-2 gap-0">
          {[0, 1].map((side) => (
            <div key={side} className="relative grid grid-cols-2 gap-0">
              {participants
                .filter((p) => p.side === side)
                .map((p) => (
                  <BattleVideoFeed
                    key={p.userId}
                    participant={p}
                    stream={p.userId === myId ? myStream : teamStreams[p.userId]}
                    mirrored={p.userId === myId}
                  />
                ))}
            </div>
          ))}
          {/* TikTok battle divider: glowing line between the two rows */}
          <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 -translate-y-1/2">
            <div className="h-[3px] w-full bg-gradient-to-r from-transparent via-[#FFD166] to-transparent shadow-[0_0_14px_rgba(255,209,102,0.8)]" />
          </div>
        </div>
      ) : (
        <div className="relative grid h-full grid-cols-2 gap-0">
          {[0, 1].map((side) => (
            <div key={side} className="relative">
              {participants
                .filter((p) => p.side === side)
                .slice(0, 1)
                .map((p) => (
                  <BattleVideoFeed
                    key={p.userId}
                    participant={p}
                    stream={p.userId === myId ? myStream : teamStreams[p.userId]}
                    mirrored={p.userId === myId}
                  />
                ))}
            </div>
          ))}
          {/* TikTok battle divider: glowing middle line between the two fighters */}
          <div className="pointer-events-none absolute inset-y-0 left-1/2 z-10 -translate-x-1/2">
            <div className="h-full w-[3px] bg-gradient-to-b from-transparent via-[#FFD166] to-transparent shadow-[0_0_14px_rgba(255,209,102,0.8)]" />
          </div>
        </div>
      )}
      {countdown !== null && countdown > 0 && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/70">
          <Crown size={40} className="text-[#FFD166]" />
          <p className="pt-2 text-[15px] font-bold">Get ready!</p>
          <p className="text-[64px] font-extrabold text-[#FFD166]">{countdown}</p>
        </div>
      )}
      {phase === 'ended' && winnerSide !== null && (
        <div className={`absolute inset-x-0 top-0 z-30 flex items-center justify-center gap-2 py-3 ${winnerSide === 0 ? 'bg-blue-600/85' : 'bg-pink-600/85'}`}>
          <Trophy size={17} /> Team {winnerSide === 0 ? 'A' : 'B'} wins! {sideScores[0]}—{sideScores[1]}
        </div>
      )}
      {phase === 'live' && remaining !== null && remaining < 10 && (
        <div className="absolute inset-x-0 top-2 z-30 flex justify-center">
          <span className="flex items-center gap-1.5 rounded-full bg-red-500/90 px-4 py-2 text-sm font-extrabold">
            <Timer size={15} /> {remaining}s
          </span>
        </div>
      )}
    </div>
  )
}

function BattleVideoFeed({
  participant,
  stream,
  mirrored,
}: {
  participant: BattleParticipantInfo
  stream?: MediaStream | null
  mirrored: boolean
}) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || !stream) return
    el.srcObject = stream
    void el.play().catch(() => {})
  }, [stream])
  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      <video ref={ref} autoPlay playsInline className={`h-full w-full object-cover ${mirrored ? 'scale-x-[-1]' : ''}`} muted={mirrored} />
      <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 backdrop-blur">
        <Avatar name={participant.name} avatarKey={participant.avatarKey} size={18} src={participant.avatarUrl} />
        <span className="text-[11px] font-bold">{participant.name.split(' ')[0]}</span>
        <span className="text-[11px] font-extrabold text-[#FFD166]">{participant.score}</span>
      </div>
    </div>
  )
}
