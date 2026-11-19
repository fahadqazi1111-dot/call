'use client'

import { useEffect, useMemo, useState } from 'react'
import { Search, Loader2, X, Check, UserPlus, Send } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/callapp/api'
import { useApp } from '@/lib/callapp/store'
import { Avatar } from './Avatar'

export interface PickPerson {
  id: string
  name: string
  username?: string
  avatarKey: number
  avatarUrl: string | null
}

/**
 * Reusable "invite people" popup with REAL user search (name / @username).
 * Replaces the old prompt()/alert() contact flow in voice rooms and
 * anywhere else that invites users. Contacts + recent chats are pre-listed;
 * typing searches every registered CALL user.
 */
export function InviteUsersSheet({
  title = 'Invite people',
  hint,
  onInvite,
  onClose,
}: {
  title?: string
  hint?: string
  /** send the invite; return true when sent successfully */
  onInvite: (person: PickPerson) => Promise<boolean>
  onClose: () => void
}) {
  const contacts = useApp((s) => s.contacts)
  const chats = useApp((s) => s.chats)
  const [q, setQ] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [sent, setSent] = useState<string[]>([])
  const [searchRes, setSearchRes] = useState<PickPerson[]>([])
  const [searching, setSearching] = useState(false)

  const pool = useMemo<PickPerson[]>(() => {
    const map = new Map<string, PickPerson>()
    for (const c of chats)
      map.set(c.peer.id, { id: c.peer.id, name: c.peer.name, username: c.peer.username, avatarKey: c.peer.avatarKey, avatarUrl: c.peer.avatarUrl ?? null })
    for (const c of contacts) {
      if (c.user && !map.has(c.user.id))
        map.set(c.user.id, {
          id: c.user.id,
          name: c.user.name,
          username: (c.user as unknown as { username?: string }).username ?? '',
          avatarKey: c.user.avatarKey,
          avatarUrl: (c.user as unknown as { avatarUrl?: string | null }).avatarUrl ?? null,
        })
    }
    return Array.from(map.values())
  }, [chats, contacts])

  useEffect(() => {
    const needle = q.trim()
    if (!needle) {
      setSearchRes([])
      setSearching(false)
      return
    }
    setSearching(true)
    const t = window.setTimeout(async () => {
      try {
        const res = await api.searchUsers(needle)
        setSearchRes(res.users.map((u) => ({ id: u.id, name: u.name, username: u.username, avatarKey: u.avatarKey, avatarUrl: u.avatarUrl })))
      } catch {
        setSearchRes([])
      } finally {
        setSearching(false)
      }
    }, 280)
    return () => window.clearTimeout(t)
  }, [q])

  const list = q.trim() ? searchRes : pool

  const invite = async (p: PickPerson) => {
    setBusyId(p.id)
    try {
      const ok = await onInvite(p)
      if (ok) {
        setSent((s) => [...s, p.id])
        toast.success(`Invite sent to ${p.name}`)
      }
    } catch (e) {
      toast.error((e as Error).message || 'Could not send the invite')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="fixed inset-0 z-[92] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <button className="absolute inset-0 bg-black/55" aria-label="Close" onClick={onClose} />
      <div
        className="relative flex max-h-[82vh] w-full flex-col rounded-t-[24px] bg-[#181b26] text-white shadow-2xl sm:max-w-md sm:rounded-[24px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 pb-3 pt-4">
          <h3 className="flex items-center gap-2 text-[16px] font-extrabold">
            <UserPlus size={18} className="text-[#FFD166]" /> {title}
          </h3>
          <button onClick={onClose} className="rounded-full bg-white/10 p-2" aria-label="Close">
            <X size={16} />
          </button>
        </div>
        {hint && <p className="px-4 pt-2.5 text-[12px] text-white/55">{hint}</p>}
        <div className="px-4 pt-3">
          <div className="flex h-10 items-center gap-2 rounded-full bg-white/10 px-3.5">
            <Search size={15} className="text-white/50" />
            <input
              className="w-full bg-transparent text-[14px] text-white outline-none placeholder:text-white/40"
              placeholder="Search name or @username"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search users to invite"
            />
          </div>
        </div>
        <div className="app-scroll min-h-[180px] flex-1 overflow-y-auto px-2 py-2">
          {searching && (
            <div className="flex justify-center py-7">
              <Loader2 size={20} className="animate-spin text-white/40" />
            </div>
          )}
          {!searching && list.length === 0 && (
            <p className="px-3 py-8 text-center text-[13px] text-white/50">
              {q.trim() ? 'No users found' : 'Your chats and contacts appear here — or search every CALL user'}
            </p>
          )}
          {!searching &&
            list.map((p) => {
              const done = sent.includes(p.id)
              return (
                <div key={p.id} className="flex w-full items-center gap-3 rounded-2xl px-2.5 py-2">
                  <Avatar name={p.name} avatarKey={p.avatarKey} size={40} src={p.avatarUrl} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14.5px] font-bold">{p.name}</div>
                    {p.username && <div className="truncate text-[11px] text-white/45">@{p.username}</div>}
                  </div>
                  <button
                    className={`flex h-9 flex-none items-center gap-1.5 rounded-full px-3.5 text-[12px] font-bold transition ${
                      done ? 'bg-green-500/25 text-green-300' : 'bg-gradient-to-r from-[#E1306C] to-[#7B3FE4] text-white'
                    } disabled:opacity-60`}
                    disabled={done || busyId === p.id}
                    onClick={() => void invite(p)}
                  >
                    {busyId === p.id ? <Loader2 size={14} className="animate-spin" /> : done ? <Check size={14} /> : <Send size={13} />}
                    {done ? 'Sent' : 'Invite'}
                  </button>
                </div>
              )
            })}
        </div>
        <div className="pb-[max(env(safe-area-inset-bottom),12px)]" />
      </div>
    </div>
  )
}
