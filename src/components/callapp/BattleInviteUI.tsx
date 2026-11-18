'use client'

import { useEffect, useRef, useState } from 'react'
import { Swords, X, Trophy, Loader2 } from 'lucide-react'
import { api } from '@/lib/callapp/api'
import { useApp } from '@/lib/callapp/store'
import { liveManager } from '@/lib/callapp/liveManager'
import { socketClient } from '@/lib/callapp/socket'
import { soundKit } from '@/lib/callapp/sound'
import { Avatar } from './Avatar'
import { BattleVideoLayout } from './LiveHostScreen'
import type { BattleParticipantInfo } from '@/lib/callapp/types'

interface BattleInvite {
  battleId: string
  liveId: string
  mode: '1v1' | '2v2'
  from: { id: string; name: string; avatarKey: number }
}

/**
 * Global battle-invite handler: listens for battle:invite, shows an
 * accept/decline dialog, and on accept joins the host's live as a battle
 * participant (publishes camera, receives other participants, shows scores).
 */
export function BattleInviteBridge() {
  const [invite, setInvite] = useState<BattleInvite | null>(null)
  const [participating, setParticipating] = useState<{ liveId: string; battleId: string } | null>(null)
  const me = useApp((s) => s.me)

  useEffect(() => {
    const off = socketClient.on('battle:invite', (p) => {
      const d = p as BattleInvite
      if (me && d.from?.id !== me.id) {
        soundKit.startRingtone()
        setInvite(d)
      }
    })
    return () => {
      off()
    }
  }, [me])

  const accept = async () => {
    if (!invite) return
    soundKit.stopRing()
    try {
      const res = await api.battleRespond(invite.battleId, true)
      setInvite(null)
      if (res.status === 'declined') return
      setParticipating({ liveId: invite.liveId, battleId: invite.battleId })
    } catch (e) {
      alert((e as Error).message)
    }
  }

  const decline = async () => {
    if (!invite) return
    soundKit.stopRing()
    try {
      await api.battleRespond(invite.battleId, false)
    } catch {}
    setInvite(null)
  }

  return (
    <>
      {invite && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/70 px-6">
          <div className="w-full max-w-sm rounded-[24px] bg-white p-7 text-center shadow-2xl">
            <Swords size={38} className="mx-auto text-[#7B3FE4]" />
            <h3 className="pt-3 text-lg font-extrabold text-cink">Battle invitation</h3>
            <div className="flex items-center justify-center gap-3 py-4">
              <Avatar name={invite.from.name} avatarKey={invite.from.avatarKey} size={52} />
              <div className="text-left">
                <p className="font-bold text-cink">{invite.from.name}</p>
                <p className="text-[12px] text-cmut">{invite.mode} live battle</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button className="h-12 flex-1 rounded-[14px] bg-[#F0F3FA] font-bold text-[#4A5568]" onClick={() => void decline()}>
                Decline
              </button>
              <button className="h-12 flex-1 rounded-[14px] bg-gradient-to-r from-[#7B3FE4] to-[#E1306C] font-bold text-white" onClick={() => void accept()}>
                Accept ⚔️
              </button>
            </div>
          </div>
        </div>
      )}
      {participating && <BattleParticipantScreen liveId={participating.liveId} battleId={participating.battleId} onClose={() => setParticipating(null)} />}
    </>
  )
}

/** After accepting: publish camera to the host live and show the battle layout. */
function BattleParticipantScreen({ liveId, battleId, onClose }: { liveId: string; battleId: string; onClose: () => void }) {
  const me = useApp((s) => s.me)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [streams, setStreams] = useState<Record<string, MediaStream>>({})
  const [battle, setBattle] = useState<{
    phase: 'waiting' | 'live' | 'ended'
    participants: BattleParticipantInfo[]
    endsAt: number | null
    sideScores: number[]
    winnerSide: number | null
    remaining: number | null
  }>({ phase: 'waiting', participants: [], endsAt: null, sideScores: [0, 0], winnerSide: null, remaining: null })

  useEffect(() => {
    let unsub: (() => void) | null = null
    let disposed = false
    const run = async () => {
      try {
        const stream = await liveManager.startPublishing(liveId, true)
        if (disposed) return
        liveManager.registerAsPublisher(liveId, me?.id ?? '')
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          void videoRef.current.play().catch(() => {})
        }
        unsub = liveManager.subscribe((s) => setStreams(s.publisherStreams))
      } catch {
        alert('Camera and microphone are required for the battle')
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

  useEffect(() => {
    const onStarted = (p: unknown) => {
      const d = p as { liveId: string; battleId: string; endsAt: number; participants?: BattleParticipantInfo[] }
      if (d.liveId !== liveId || d.battleId !== battleId) return
      soundKit.countdownTick(3)
      setBattle((b) => ({ ...b, phase: 'live', endsAt: d.endsAt, participants: d.participants ?? b.participants }))
    }
    const onScore = (p: unknown) => {
      const d = p as { liveId: string; battleId: string; side: number; added: number; total: number | null }
      if (d.liveId !== liveId || d.battleId !== battleId) return
      setBattle((b) => ({ ...b, sideScores: b.sideScores.map((s, i) => (i === d.side ? (d.total ?? s + d.added) : s)) }))
    }
    const onEnded = (p: unknown) => {
      const d = p as { liveId: string; battleId: string; winnerSide: number | null; sideScores: number[] }
      if (d.liveId !== liveId || d.battleId !== battleId) return
      setBattle((b) => ({ ...b, phase: 'ended', winnerSide: d.winnerSide, sideScores: d.sideScores }))
      soundKit.fanfare()
    }
    const off1 = socketClient.on('battle:started', onStarted)
    const off2 = socketClient.on('battle:score', onScore)
    const off3 = socketClient.on('battle:ended', onEnded)
    return () => {
      off1()
      off2()
      off3()
    }
  }, [liveId, battleId])

  useEffect(() => {
    if (battle.phase !== 'live' || !battle.endsAt) return
    const t = window.setInterval(() => {
      const remaining = Math.max(0, Math.round((battle.endsAt! - Date.now()) / 1000))
      setBattle((b) => ({ ...b, remaining }))
    }, 1000)
    return () => window.clearInterval(t)
  }, [battle.phase, battle.endsAt])

  /* fetch battle participants (scores update via battle:score) */
  useEffect(() => {
    void api
      .battleDetail(battleId)
      .then((res) => setBattle((b) => ({ ...b, participants: res.battle.participants })))
      .catch(() => {})
  }, [battleId])

  const myInfo = battle.participants.find((p) => p.userId === me?.id)

  return (
    <div className="fixed inset-0 z-[85] bg-black text-white">
      {battle.phase === 'live' || battle.phase === 'ended' ? (
        <BattleVideoLayout
          myStream={liveManager.getLocalStream()}
          myId={me?.id ?? ''}
          participants={battle.participants}
          teamStreams={streams}
          sideScores={battle.sideScores}
          phase={battle.phase}
          remaining={battle.remaining}
          countdown={null}
          winnerSide={battle.winnerSide}
        />
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-4">
          <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover opacity-40" playsInline muted />
          <div className="relative z-10 rounded-3xl bg-black/60 p-8 text-center backdrop-blur">
            <Loader2 className="mx-auto animate-spin" size={30} />
            <p className="pt-3 font-bold">Waiting for the battle to start…</p>
            <p className="text-[12px] text-white/60">Your camera is publishing to the host live.</p>
            {myInfo && (
              <p className="pt-2 text-[12px] text-[#FFD166]">
                Team {myInfo.side === 0 ? 'A' : 'B'} · slot {myInfo.slot + 1}
              </p>
            )}
          </div>
        </div>
      )}

      {battle.phase === 'ended' && (
        <div className="absolute inset-x-0 top-[120px] z-30 mx-auto flex w-fit items-center gap-2 rounded-full bg-[#FFD166] px-5 py-2.5 text-black">
          <Trophy size={17} />
          <span className="text-sm font-extrabold">
            {battle.winnerSide === null
              ? 'Draw! 🤝'
              : battle.winnerSide === myInfo?.side
                ? 'You WON! 🏆'
                : 'You lost — better luck next time'}
          </span>
        </div>
      )}

      <button className="absolute right-4 top-4 z-30 rounded-full bg-black/50 p-2.5 backdrop-blur" onClick={onClose} aria-label="Leave battle">
        <X size={20} />
      </button>
    </div>
  )
}
