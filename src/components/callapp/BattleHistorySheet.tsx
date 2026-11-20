'use client'

import { useEffect, useState } from 'react'
import { X, Trophy, Loader2 } from 'lucide-react'
import { api } from '@/lib/callapp/api'
import { Avatar } from './Avatar'
import type { BattleHistoryItem } from '@/lib/callapp/types'

/** My past battles: participants, scores, winner. */
export function BattleHistorySheet({ onClose }: { onClose: () => void }) {
  const [battles, setBattles] = useState<BattleHistoryItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void api
      .battleHistory()
      .then((res) => setBattles(res.battles))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-[#12141c]/95 text-white" role="dialog" aria-label="Battle history">
      <header className="flex items-center justify-between px-5 py-4">
        <h3 className="flex items-center gap-2 text-lg font-extrabold">
          <Trophy size={20} className="text-[#FFD166]" /> Battle history
        </h3>
        <button className="rounded-full bg-white/10 p-2 hover:bg-white/20" onClick={onClose}>
          <X size={18} />
        </button>
      </header>
      <div className="app-scroll flex-1 overflow-y-auto px-4 pb-10">
        {loading && (
          <div className="flex justify-center pt-16">
            <Loader2 className="animate-spin" size={26} />
          </div>
        )}
        {!loading && battles.length === 0 && (
          <p className="pt-16 text-center text-sm text-white/50">No battles yet. Start a live and invite someone!</p>
        )}
        {battles.map((b) => (
          <div key={b.id} className="mb-3 rounded-[18px] bg-white/5 p-4">
            <div className="flex items-center justify-between pb-2">
              <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold">{b.mode}</span>
              <span
                className={`rounded-full px-3 py-1 text-[11px] font-bold ${
                  b.won ? 'bg-green-500/25 text-green-300' : b.status === 'ended' ? 'bg-red-500/25 text-red-300' : 'bg-white/10 text-white/70'
                }`}
              >
                {b.status !== 'ended' ? b.status.toUpperCase() : b.won ? 'WON' : 'LOST'}
              </span>
            </div>
            <div className="flex items-center justify-between text-center">
              {([0, 1] as const).map((side) => (
                <div key={side} className={`flex-1 rounded-xl p-2 ${b.mySide === side ? 'bg-cbrand/15' : ''}`}>
                  {b.participants
                    .filter((p) => p.side === side)
                    .map((p) => (
                      <div key={p.userId} className="flex items-center gap-2 py-0.5">
                        <Avatar name={p.name} avatarKey={p.avatarKey} size={22} src={p.avatarUrl} />
                        <span className="text-[12px] font-semibold">{p.name}</span>
                      </div>
                    ))}
                  <div className="pt-1 text-[16px] font-extrabold text-[#FFD166]">{b.sideScores[side]}</div>
                </div>
              ))}
            </div>
            {b.endedAt && (
              <p className="pt-2 text-center text-[10px] text-white/40">{new Date(b.endedAt).toLocaleString()}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
