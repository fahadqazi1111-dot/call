'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, Users, Loader2, X, Check, Swords, Radio } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/callapp/api'
import { useApp } from '@/lib/callapp/store'
import { socketClient } from '@/lib/callapp/socket'
import { Avatar } from './Avatar'
import type { BattleParticipantInfo } from '@/lib/callapp/types'

export interface Person {
  id: string
  name: string
  username?: string
  avatarKey: number
  avatarUrl: string | null
  online?: boolean // true when from the live audience
}

/**
 * Proper battle invite popup (replaces the old prompt/alert flow):
 *   - tab 1: search EVERY registered user by name / @username
 *   - tab 2: pick directly from the CURRENT live audience (realtime viewers)
 *   - mode selector (1v1 / 2v2) with slot limits and live slot counter
 */
export function BattleInviteSheet({
  liveId,
  preselected,
  onClose,
  onInvited,
}: {
  liveId: string
  /** prefilled selection (e.g. a viewer who requested the battle) */
  preselected?: Person | null
  onClose: () => void
  onInvited: (battleId: string, mode: '1v1' | '2v2', participants: BattleParticipantInfo[], host: { id: string; name: string; avatarKey: number; avatarUrl: string | null }) => void
}) {
  const [mode, setMode] = useState<'1v1' | '2v2'>(preselected ? '1v1' : '1v1')
  const [tab, setTab] = useState<'search' | 'audience'>('search')
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Person[]>([])
  const [searching, setSearching] = useState(false)
  const [audience, setAudience] = useState<Person[]>([])
  const [loadingAudience, setLoadingAudience] = useState(false)
  const [picked, setPicked] = useState<Person[]>(preselected ? [preselected] : [])
  const [sending, setSending] = useState(false)
  const me = useApp((s) => s.me)
  const searchSeq = useRef(0)

  const need = mode === '1v1' ? 1 : 3

  /* ---- user search (debounced) ---- */
  useEffect(() => {
    const needle = q.trim()
    if (!needle) {
      setResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    const t = window.setTimeout(async () => {
      const seq = ++searchSeq.current
      try {
        const res = await api.searchUsers(needle)
        if (seq !== searchSeq.current) return
        setResults(res.users.map((u) => ({ id: u.id, name: u.name, username: u.username, avatarKey: u.avatarKey, avatarUrl: u.avatarUrl })))
      } catch {
        if (seq === searchSeq.current) setResults([])
      } finally {
        if (seq === searchSeq.current) setSearching(false)
      }
    }, 280)
    return () => window.clearTimeout(t)
  }, [q])

  /* ---- audience list (poll while open) ---- */
  useEffect(() => {
    if (tab !== 'audience') return
    let alive = true
    const load = async () => {
      setLoadingAudience(true)
      try {
        const res = await api.liveViewers(liveId)
        if (alive) setAudience(res.viewers.map((v) => ({ id: v.userId, name: v.name, avatarKey: v.avatarKey, avatarUrl: v.avatarUrl, online: true })))
      } catch {}
      if (alive) setLoadingAudience(false)
    }
    void load()
    const t = window.setInterval(() => void load(), 4000)
    return () => {
      alive = false
      window.clearInterval(t)
    }
  }, [tab, liveId])

  const list = tab === 'search' ? results : audience
  const filtered = useMemo(() => {
    if (tab !== 'audience') return list
    const needle = q.trim().toLowerCase()
    return needle ? list.filter((p) => p.name.toLowerCase().includes(needle)) : list
  }, [list, tab, q])

  const toggle = (p: Person) => {
    setPicked((cur) => {
      if (cur.some((x) => x.id === p.id)) return cur.filter((x) => x.id !== p.id)
      if (cur.length >= need) {
        toast.warning(`${mode} battle needs exactly ${need} — deselect someone first`)
        return cur
      }
      return [...cur, p]
    })
  }

  const send = async () => {
    if (!me) return
    if (picked.length !== need) {
      toast.error(`${mode} battle needs exactly ${need} fighter${need > 1 ? 's' : ''}`)
      return
    }
    setSending(true)
    try {
      const res = await api.battleInvite(
        liveId,
        mode,
        picked.map((p) => p.id),
        120
      )
      const parts: BattleParticipantInfo[] = [
        { userId: me.id, name: me.name, avatarKey: me.avatarKey, avatarUrl: me.avatarUrl ?? null, side: 0, slot: 0, accepted: true, score: 0 },
        ...picked.map((p, i) => ({
          userId: p.id,
          name: p.name,
          avatarKey: p.avatarKey,
          avatarUrl: p.avatarUrl,
          side: mode === '1v1' ? 1 : i === 0 ? 0 : 1,
          slot: mode === '1v1' ? 0 : i === 0 ? 1 : i === 1 ? 0 : 1,
          accepted: false,
          score: 0,
        })),
      ]
      socketClient.emit('battle:invite', {
        targets: picked.map((p) => p.id),
        payload: { battleId: res.battle.id, liveId, mode, from: { id: me.id, name: me.name, avatarKey: me.avatarKey } },
      })
      onInvited(res.battle.id, mode, parts, {
        id: me.id,
        name: me.name,
        avatarKey: me.avatarKey,
        avatarUrl: me.avatarUrl ?? null,
      })
    } catch (e) {
      toast.error((e as Error).message || 'Could not send the invite')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="absolute inset-0 z-50 flex items-end bg-black/60" onClick={onClose} role="dialog" aria-modal="true" aria-label="Invite to battle">
      <div className="flex max-h-[86%] w-full flex-col rounded-t-[24px] bg-[#181b26] pb-6 text-white" onClick={(e) => e.stopPropagation()}>
        {/* header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 pb-3 pt-4">
          <h3 className="flex items-center gap-2 text-[17px] font-extrabold">
            <Swords size={18} className="text-[#FFD166]" /> Invite fighters
          </h3>
          <button className="rounded-full bg-white/10 p-2" onClick={onClose} aria-label="Close">
            <X size={17} />
          </button>
        </div>

        {/* mode selector */}
        <div className="flex gap-2 px-5 pt-3">
          <button
            className={`flex-1 rounded-[14px] py-2.5 text-[13px] font-bold ${mode === '1v1' ? 'bg-[#7B3FE4] text-white' : 'bg-white/10 text-white/70'}`}
            onClick={() => {
              setMode('1v1')
              setPicked((cur) => cur.slice(0, 1))
            }}
          >
            ⚔️ 1 vs 1
          </button>
          <button
            className={`flex-1 rounded-[14px] py-2.5 text-[13px] font-bold ${mode === '2v2' ? 'bg-[#7B3FE4] text-white' : 'bg-white/10 text-white/70'}`}
            onClick={() => setMode('2v2')}
          >
            🛡️ 2 vs 2
          </button>
        </div>
        <p className="px-5 pt-1.5 text-[11.5px] text-white/55">
          {mode === '1v1' ? 'Pick 1 opponent — side-by-side battle.' : 'Pick 3 fighters — 2 on each team.'} Double-taps give +1 point, gifts boost the score much more.
        </p>

        {/* tabs */}
        <div className="mt-3 flex px-5">
          <button
            className={`flex h-9 flex-1 items-center justify-center gap-1.5 rounded-l-full text-[12.5px] font-bold ${tab === 'search' ? 'bg-white/20 text-white' : 'bg-white/5 text-white/60'}`}
            onClick={() => setTab('search')}
          >
            <Search size={14} /> Search users
          </button>
          <button
            className={`flex h-9 flex-1 items-center justify-center gap-1.5 rounded-r-full text-[12.5px] font-bold ${tab === 'audience' ? 'bg-white/20 text-white' : 'bg-white/5 text-white/60'}`}
            onClick={() => setTab('audience')}
          >
            <Radio size={14} /> Audience
          </button>
        </div>

        {/* search box */}
        <div className="px-5 pt-3">
          <div className="flex h-10 items-center gap-2 rounded-full bg-white/10 px-3.5">
            <Search size={15} className="text-white/50" />
            <input
              className="w-full bg-transparent text-[14px] text-white outline-none placeholder:text-white/40"
              placeholder={tab === 'search' ? 'Search name or @username' : 'Filter audience'}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>

        {/* selected chips */}
        {picked.length > 0 && (
          <div className="flex flex-wrap gap-2 px-5 pt-3">
            {picked.map((p) => (
              <span key={p.id} className="flex items-center gap-1.5 rounded-full bg-[#7B3FE4]/40 py-1 pl-1.5 pr-2.5 text-[12px] font-bold">
                <Avatar name={p.name} avatarKey={p.avatarKey} size={20} src={p.avatarUrl} />
                {p.name.split(' ')[0]}
                <button onClick={() => toggle(p)} aria-label={`Remove ${p.name}`}>
                  <X size={13} />
                </button>
              </span>
            ))}
            <span className="self-center text-[11px] font-semibold text-white/50">
              {picked.length}/{need}
            </span>
          </div>
        )}

        {/* list */}
        <div className="app-scroll min-h-[140px] flex-1 overflow-y-auto px-3 pt-2">
          {tab === 'search' && !q.trim() && (
            <p className="px-3 py-8 text-center text-[13px] text-white/50">Type a name or @username to search every CALL user</p>
          )}
          {tab === 'audience' && loadingAudience && audience.length === 0 && (
            <div className="flex justify-center py-8">
              <Loader2 size={20} className="animate-spin text-white/40" />
            </div>
          )}
          {tab === 'audience' && !loadingAudience && audience.length === 0 && (
            <p className="px-3 py-8 text-center text-[13px] text-white/50">No one is watching right now — try the Search tab instead</p>
          )}
          {tab === 'search' && searching && (
            <div className="flex justify-center py-8">
              <Loader2 size={20} className="animate-spin text-white/40" />
            </div>
          )}
          {filtered.map((p) => {
            const on = picked.some((x) => x.id === p.id)
            return (
              <button
                key={p.id}
                className={`flex w-full items-center gap-3 rounded-2xl px-2.5 py-2 text-left transition ${on ? 'bg-[#7B3FE4]/30' : 'hover:bg-white/10'}`}
                onClick={() => toggle(p)}
              >
                <Avatar name={p.name} avatarKey={p.avatarKey} size={40} src={p.avatarUrl} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-bold">{p.name}</div>
                  <div className="truncate text-[11px] text-white/50">
                    {p.username ? `@${p.username}` : ''}
                    {p.online ? ' · watching now' : ''}
                  </div>
                </div>
                {p.online && <span className="h-2 w-2 flex-none rounded-full bg-green-400" />}
                <span
                  className={`flex h-6 w-6 flex-none items-center justify-center rounded-full border-2 ${on ? 'border-[#FFD166] bg-[#FFD166] text-black' : 'border-white/30'}`}
                >
                  {on && <Check size={14} />}
                </span>
              </button>
            )
          })}
        </div>

        {/* send */}
        <div className="px-5 pt-3">
          <button
            className="flex h-[50px] w-full items-center justify-center gap-2 rounded-[16px] bg-gradient-to-r from-[#7B3FE4] to-[#E1306C] font-bold disabled:opacity-50"
            disabled={sending || picked.length !== need}
            onClick={() => void send()}
          >
            {sending ? <Loader2 size={18} className="animate-spin" /> : <Users size={18} />}
            {picked.length === need ? `Send ${mode} invites` : `Select ${need - picked.length} more`}
          </button>
        </div>
      </div>
    </div>
  )
}
