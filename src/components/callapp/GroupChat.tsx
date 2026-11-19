'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  X, Send, Users, Search, Loader2, ArrowLeft, MoreVertical, LogOut, UserPlus,
  Check, Crown, UsersRound,
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/callapp/api'
import { useApp } from '@/lib/callapp/store'
import { socketClient } from '@/lib/callapp/socket'
import { Avatar } from './Avatar'
import { fmtChatListTime } from '@/lib/callapp/utils'
import type { GroupItem, GroupMessageItem, GroupMemberItem } from '@/lib/callapp/types'

const NAME_COLORS = ['#E1306C', '#7B3FE4', '#0EA5E9', '#F59E0B', '#10B981', '#EF4444', '#8B5CF6']

function nameColor(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 997
  return NAME_COLORS[h % NAME_COLORS.length]
}

/* ============================================================
 * Groups list rows (rendered inside ChatsTab above 1:1 chats)
 * ============================================================ */
export function GroupsSection({ variant = 'mobile' }: { variant?: 'mobile' | 'desktop' }) {
  const me = useApp((s) => s.me)
  const [groups, setGroups] = useState<GroupItem[]>([])
  const [loaded, setLoaded] = useState(false)
  const [openGroup, setOpenGroup] = useState<GroupItem | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const desk = variant === 'desktop'

  const load = useCallback(async () => {
    try {
      const res = await api.groups()
      setGroups(res.groups)
    } catch {}
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (!me) return
    queueMicrotask(() => void load())
    const t = window.setInterval(() => void load(), 20000)
    return () => window.clearInterval(t)
  }, [me, load])

  const groupsRef = useRef<GroupItem[]>([])
  useEffect(() => {
    groupsRef.current = groups
    // join my group rooms for realtime fan-out
    if (groups.length) socketClient.emit('group:join', { groupIds: groups.map((g) => g.id) })
  }, [groups])

  // rooms are lost whenever the socket reconnects — re-join every time
  useEffect(() => {
    const rejoin = () => {
      const ids = groupsRef.current.map((g) => g.id)
      if (ids.length) socketClient.emit('group:join', { groupIds: ids })
    }
    const off = socketClient.on('connect', rejoin)
    return () => {
      off()
    }
  }, [])

  useEffect(() => {
    if (!me) return
    const onMsg = (p: unknown) => {
      const d = p as { groupId: string }
      if (d.groupId && !openGroup) void load()
    }
    const off = socketClient.on('group:msg', onMsg)
    return () => {
      off()
    }
  }, [me, load, openGroup])

  const refresh = () => void load()

  return (
    <>
      {/* section header + create button */}
      <div className={`flex items-center gap-2 ${desk ? 'px-4 pb-1 pt-3' : 'px-5 pb-1 pt-2'}`}>
        <span className="flex items-center gap-1.5 text-[11.5px] font-extrabold uppercase tracking-wider text-cmut">
          <UsersRound size={14} /> Groups
        </span>
        <span className="flex-1" />
        <button
          className="flex h-8 items-center gap-1.5 rounded-full bg-csoft px-3 text-[12px] font-bold text-cbrand transition hover:bg-[#E7EEFF]"
          onClick={() => setCreateOpen(true)}
          aria-label="Create group"
        >
          <UserPlus size={14} /> New group
        </button>
      </div>
      {loaded && groups.length > 0 && (
        <div className="pb-1">
          {groups.map((g) => (
            <button
              key={g.id}
              className={`flex w-full items-center gap-3.5 text-left transition hover:bg-cbg ${desk ? 'px-4 py-2.5' : 'px-5 py-3'}`}
              onClick={() => setOpenGroup(g)}
              aria-label={`Open group ${g.name}`}
            >
              <GroupAvatar name={g.name} size={desk ? 46 : 56} members={g.members.length} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15.5px] font-bold text-cink">{g.name}</div>
                <div className="mt-0.5 truncate text-[13.5px] text-[#4A5568]">
                  {g.lastMessage ? (
                    <>
                      {g.lastMessage.mine ? (
                        <span className="font-semibold">You: </span>
                      ) : g.lastMessage.senderName ? (
                        <span className="font-semibold">{g.lastMessage.senderName.split(' ')[0]}: </span>
                      ) : null}
                      {g.lastMessage.content}
                    </>
                  ) : (
                    `${g.members.length} members`
                  )}
                </div>
              </div>
              <div className="flex w-[52px] flex-none flex-col items-end">
                <span className="text-[11.5px] text-cmut">{fmtChatListTime(g.lastMessage?.createdAt ?? g.updatedAt)}</span>
                {g.unread > 0 && (
                  <span className="mt-1.5 flex h-[21px] min-w-[21px] items-center justify-center rounded-full bg-cbrand px-1.5 text-[11px] font-bold text-white">
                    {g.unread}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
      {loaded && groups.length === 0 && (
        <p className={`${desk ? 'px-4' : 'px-5'} pb-2 text-[12.5px] text-cmut`}>No groups yet — tap “New group” to make one.</p>
      )}

      {createOpen && me && (
        <GroupCreateSheet
          desk={desk}
          onClose={() => setCreateOpen(false)}
          onCreated={(g) => {
            setCreateOpen(false)
            void load()
            setOpenGroup(g)
          }}
        />
      )}
      {openGroup && (
        <GroupChatScreen
          group={openGroup}
          desk={desk}
          onClose={() => {
            setOpenGroup(null)
            refresh()
          }}
        />
      )}
    </>
  )
}

/** rounded group tile: initials on a brand gradient + member count badge */
function GroupAvatar({ name, size, members }: { name: string; size: number; members: number }) {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
  return (
    <span className="relative inline-flex flex-none">
      <span
        className="flex items-center justify-center rounded-full bg-brand-grad font-extrabold text-white"
        style={{ width: size, height: size, fontSize: size * 0.36 }}
        aria-hidden="true"
      >
        {initials || 'G'}
      </span>
      <span className="absolute -bottom-0.5 -right-0.5 flex items-center gap-0.5 rounded-full bg-white px-1 text-[9px] font-extrabold text-cbrand ring-1 ring-cline">
        <Users size={8} /> {members}
      </span>
    </span>
  )
}

/* ============================================================
 * Group creation sheet — name + pick members (contacts + search)
 * ============================================================ */
export function GroupCreateSheet({
  desk,
  onClose,
  onCreated,
}: {
  desk: boolean
  onClose: () => void
  onCreated: (g: GroupItem) => void
}) {
  const contacts = useApp((s) => s.contacts)
  const chats = useApp((s) => s.chats)
  const [name, setName] = useState('')
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState<GroupMemberItem[]>([])
  const [busy, setBusy] = useState(false)
  const [searchRes, setSearchRes] = useState<Array<{ id: string; name: string; username: string; avatarKey: number; avatarUrl: string | null }>>([])
  const [searching, setSearching] = useState(false)

  // people pool: chats + registered contacts (search covers everyone else)
  const pool = useMemo(() => {
    const map = new Map<string, GroupMemberItem>()
    for (const c of chats) map.set(c.peer.id, { id: c.peer.id, name: c.peer.name, username: c.peer.username, avatarKey: c.peer.avatarKey, avatarUrl: c.peer.avatarUrl ?? null, role: 'member' })
    for (const c of contacts) {
      if (c.user && !map.has(c.user.id))
        map.set(c.user.id, {
          id: c.user.id,
          name: c.user.name,
          username: (c.user as unknown as { username?: string }).username ?? '',
          avatarKey: c.user.avatarKey,
          avatarUrl: (c.user as unknown as { avatarUrl?: string | null }).avatarUrl ?? null,
          role: 'member',
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
        setSearchRes(res.users)
      } catch {
        setSearchRes([])
      } finally {
        setSearching(false)
      }
    }, 280)
    return () => window.clearTimeout(t)
  }, [q])

  const list = q.trim() ? searchRes : pool
  const toggle = (p: { id: string; name: string; username: string; avatarKey: number; avatarUrl: string | null }) =>
    setPicked((cur) =>
      cur.some((x) => x.id === p.id)
        ? cur.filter((x) => x.id !== p.id)
        : [...cur, { ...p, role: 'member' }]
    )

  const create = async () => {
    if (!name.trim()) {
      toast.error('Give the group a name')
      return
    }
    if (picked.length < 1) {
      toast.error('Pick at least 1 member')
      return
    }
    setBusy(true)
    try {
      const res = await api.createGroup(name.trim(), picked.map((p) => p.id))
      toast.success(`Group “${res.group.name}” created`)
      onCreated(res.group)
    } catch (e) {
      toast.error((e as Error).message || 'Could not create the group')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label="Create group">
      <button className="absolute inset-0 bg-black/50" aria-label="Close" onClick={onClose} />
      <div
        className="relative flex max-h-[88vh] w-full flex-col rounded-t-[24px] bg-white shadow-2xl sm:max-w-md sm:rounded-[24px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-cline px-4 pb-3 pt-4">
          <h3 className="flex items-center gap-2 text-[16px] font-extrabold text-cink">
            <Users size={18} className="text-cbrand" /> Create group
          </h3>
          <button onClick={onClose} className="text-[12.5px] font-bold text-cmut hover:text-cink" aria-label="Close">
            Close
          </button>
        </div>

        <div className="px-4 pt-3">
          <input
            className="h-12 w-full rounded-[14px] bg-[#F0F3FA] px-4 text-[15px] text-cink outline-none placeholder:text-[#7A8499]"
            placeholder="Group name (e.g. Family, Team CALL)"
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
          />
          {picked.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {picked.map((p) => (
                <span key={p.id} className="flex items-center gap-1.5 rounded-full bg-csoft py-1 pl-1.5 pr-2.5 text-[12px] font-bold text-cink">
                  <Avatar name={p.name} avatarKey={p.avatarKey} size={20} src={p.avatarUrl} />
                  {p.name.split(' ')[0]}
                  <button onClick={() => toggle(p)} aria-label={`Remove ${p.name}`}>
                    <X size={13} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="mt-3 flex h-10 items-center gap-2 rounded-full bg-[#F0F3FA] px-3.5">
            <Search size={15} className="text-cmut" />
            <input
              className="w-full bg-transparent text-[14px] text-cink outline-none placeholder:text-[#7A8499]"
              placeholder="Search people by name or @username"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>

        <div className="app-scroll min-h-[160px] flex-1 overflow-y-auto px-2 py-2">
          {searching && (
            <div className="flex justify-center py-6">
              <Loader2 size={20} className="animate-spin text-cmut" />
            </div>
          )}
          {!searching && list.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-cmut">
              {q.trim() ? 'No users found' : 'Pick from your chats and contacts, or search all users'}
            </p>
          )}
          {!searching &&
            list.map((p) => {
              const on = picked.some((x) => x.id === p.id)
              return (
                <button
                  key={p.id}
                  className={`flex w-full items-center gap-3 rounded-2xl px-2.5 py-2 text-left transition ${on ? 'bg-csoft' : 'hover:bg-cbg'}`}
                  onClick={() => toggle(p)}
                >
                  <Avatar name={p.name} avatarKey={p.avatarKey} size={42} src={p.avatarUrl} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14.5px] font-semibold text-cink">{p.name}</div>
                    {p.username && <div className="truncate text-[11.5px] text-cmut">@{p.username}</div>}
                  </div>
                  <span
                    className={`flex h-6 w-6 flex-none items-center justify-center rounded-full border-2 transition ${
                      on ? 'border-cbrand bg-cbrand text-white' : 'border-cline bg-white'
                    }`}
                  >
                    {on && <Check size={14} />}
                  </span>
                </button>
              )
            })}
        </div>

        <div className="border-t border-cline px-4 pb-[max(env(safe-area-inset-bottom),12px)] py-3">
          <button
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-brand-grad text-[15px] font-bold text-white shadow-[0_6px_16px_rgba(47,91,234,0.35)] disabled:opacity-40"
            disabled={busy || !picked.length || !name.trim()}
            onClick={() => void create()}
          >
            {busy ? <Loader2 size={18} className="animate-spin" /> : <Users size={18} />}
            Create group with {picked.length + 1} {picked.length ? 'people' : 'person'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ============================================================
 * Group chat screen — realtime messages via the group socket room
 * ============================================================ */
export function GroupChatScreen({ group, desk, onClose }: { group: GroupItem; desk: boolean; onClose: () => void }) {
  const me = useApp((s) => s.me)
  const [meta, setMeta] = useState<GroupItem>(group)
  const [messages, setMessages] = useState<GroupMessageItem[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const seenRef = useRef(new Set<string>())

  /* load details + history */
  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const res = await api.groupDetail(group.id)
        if (!alive) return
        setMeta({ ...group, ...res.group })
        setMessages(res.messages)
        res.messages.forEach((m) => seenRef.current.add(m.id))
      } catch {
        toast.error('Could not open the group')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    socketClient.emit('group:join', { groupIds: [group.id] })
    // rooms are lost on socket reconnect — re-join silently
    const rejoin = () => socketClient.emit('group:join', { groupIds: [group.id] })
    const offConn = socketClient.on('connect', rejoin)
    return () => {
      alive = false
      offConn()
      socketClient.emit('group:leave', { groupId: group.id })
    }
  }, [group.id, group])

  /* realtime incoming */
  useEffect(() => {
    const onMsg = (p: unknown) => {
      const d = p as { groupId: string; message: GroupMessageItem }
      if (d.groupId !== group.id || !d.message) return
      if (seenRef.current.has(d.message.id)) return
      seenRef.current.add(d.message.id)
      setMessages((m) => [...m.slice(-200), d.message])
    }
    const off = socketClient.on('group:msg', onMsg)
    return () => {
      off()
    }
  }, [group.id])

  /* autoscroll */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length, loading])

  const send = async () => {
    const content = text.trim()
    if (!content || !me || sending) return
    setSending(true)
    setText('')
    try {
      const res = await api.groupSend(group.id, content)
      // realtime fan-out to the other members (REST already persisted it)
      socketClient.emit('group:msg', { groupId: group.id, message: res.message })
      if (!seenRef.current.has(res.message.id)) {
        seenRef.current.add(res.message.id)
        setMessages((m) => [...m.slice(-200), res.message])
      }
    } catch (e) {
      toast.error((e as Error).message || 'Could not send')
      setText(content)
    } finally {
      setSending(false)
    }
  }

  const leave = async () => {
    if (!confirm('Leave this group?')) return
    try {
      const res = await api.groupLeave(group.id)
      toast.success(res.dissolved ? 'Group dissolved' : 'You left the group')
      onClose()
    } catch (e) {
      toast.error((e as Error).message || 'Could not leave')
    }
  }

  const addMembers = async (userIds: string[]) => {
    try {
      const res = await api.groupAddMembers(group.id, userIds)
      toast.success(`${res.added} member${res.added === 1 ? '' : 's'} added`)
      const res2 = await api.groupDetail(group.id)
      setMeta((m) => ({ ...m, ...res2.group }))
      setInfoOpen(false)
    } catch (e) {
      toast.error((e as Error).message || 'Could not add members')
    }
  }

  const isOwner = meta.ownerId === me?.id

  return (
    <div className={desk ? 'absolute inset-0 z-40 flex flex-col bg-cbg' : 'fixed inset-0 z-[70] flex flex-col bg-cbg'}>
      {/* header */}
      <header className="flex items-center gap-3 border-b border-cline bg-white px-3 pb-3 pt-4">
        <button className="flex h-10 w-10 items-center justify-center rounded-full bg-csoft text-cink" onClick={onClose} aria-label="Back">
          <ArrowLeft size={19} />
        </button>
        <GroupAvatar name={meta.name} size={42} members={meta.members.length} />
        <button className="min-w-0 flex-1 text-left" onClick={() => setInfoOpen(true)} aria-label="Group info">
          <p className="truncate text-[15.5px] font-extrabold text-cink">{meta.name}</p>
          <p className="truncate text-[11.5px] text-cmut">{meta.members.length} members · tap for info</p>
        </button>
        <button className="flex h-10 w-10 items-center justify-center rounded-full text-cmut hover:bg-cbg" onClick={() => setInfoOpen(true)} aria-label="Group info">
          <MoreVertical size={19} />
        </button>
      </header>

      {/* messages */}
      <div className="app-scroll flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="flex h-full items-center justify-center text-cmut">
            <Loader2 size={22} className="animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <p className="pt-10 text-center text-sm text-cmut">No messages yet — say salam to the group!</p>
        ) : (
          <div className="space-y-2">
            {messages.map((m) => {
              if (m.type === 'system') {
                return (
                  <p key={m.id} className="mx-auto w-fit max-w-[90%] rounded-full bg-csoft px-3 py-1 text-center text-[11.5px] font-semibold text-cmut">
                    {m.content}
                  </p>
                )
              }
              const mine = m.mine || m.sender.id === me?.id
              return (
                <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[78%] ${mine ? 'items-end' : 'items-start'} flex flex-col`}>
                    {!mine && (
                      <span className="mb-0.5 pl-1 text-[11px] font-bold" style={{ color: nameColor(m.sender.id) }}>
                        {m.sender.name.split(' ')[0]}
                      </span>
                    )}
                    <div
                      className={`rounded-[18px] px-3.5 py-2.5 text-[14px] leading-[19px] shadow-sm ${
                        mine ? 'rounded-br-[6px] bg-cbrand text-white' : 'rounded-bl-[6px] bg-white text-cink ring-1 ring-cline'
                      }`}
                    >
                      {m.content}
                    </div>
                    <span className="pt-0.5 text-[10px] text-cmut">{fmtChatListTime(m.createdAt)}</span>
                  </div>
                </div>
              )
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* composer */}
      <div className="flex items-center gap-2.5 border-t border-cline bg-white px-4 pt-3 pb-[max(env(safe-area-inset-bottom),14px)]">
        <input
          className="h-12 min-w-0 flex-1 rounded-full bg-[#F0F3FA] px-4 text-[15px] text-cink outline-none placeholder:text-[#7A8499]"
          placeholder={`Message ${meta.name}`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void send()}
          aria-label="Group message"
        />
        <button
          className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-cbrand text-white disabled:opacity-40"
          onClick={() => void send()}
          disabled={sending || !text.trim()}
          aria-label="Send group message"
        >
          {sending ? <Loader2 size={19} className="animate-spin" /> : <Send size={19} />}
        </button>
      </div>

      {/* group info sheet */}
      {infoOpen && (
        <GroupInfoSheet
          group={meta}
          isOwner={isOwner}
          desk={desk}
          onClose={() => setInfoOpen(false)}
          onLeave={() => void leave()}
          onAddMembers={(ids) => void addMembers(ids)}
        />
      )}
    </div>
  )
}

/* ---------- group info: members, add (owner), leave ---------- */
function GroupInfoSheet({
  group,
  isOwner,
  desk,
  onClose,
  onLeave,
  onAddMembers,
}: {
  group: GroupItem
  isOwner: boolean
  desk: boolean
  onClose: () => void
  onLeave: () => void
  onAddMembers: (ids: string[]) => void
}) {
  const [addOpen, setAddOpen] = useState(false)
  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label="Group info">
      <button className="absolute inset-0 bg-black/50" aria-label="Close" onClick={onClose} />
      <div
        className="relative flex max-h-[85vh] w-full flex-col rounded-t-[24px] bg-white shadow-2xl sm:max-w-md sm:rounded-[24px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 pb-3 pt-4">
          <GroupAvatar name={group.name} size={54} members={group.members.length} />
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-[17px] font-extrabold text-cink">{group.name}</h3>
            <p className="text-[12px] text-cmut">{group.members.length} members</p>
          </div>
          <button onClick={onClose} className="rounded-full bg-csoft p-2 text-cmut" aria-label="Close">
            <X size={17} />
          </button>
        </div>
        <div className="app-scroll flex-1 overflow-y-auto px-2 py-2">
          {group.members.map((m) => (
            <div key={m.id} className="flex items-center gap-3 rounded-2xl px-2.5 py-2">
              <Avatar name={m.name} avatarKey={m.avatarKey} size={40} src={m.avatarUrl} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 truncate text-[14.5px] font-semibold text-cink">
                  {m.name}
                  {m.role === 'owner' && <Crown size={13} className="text-[#F59E0B]" />}
                </div>
                <div className="truncate text-[11.5px] text-cmut">{m.role === 'owner' ? 'Owner' : m.role === 'admin' ? 'Admin' : `@${m.username || 'member'}`}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-cline px-4 pb-[max(env(safe-area-inset-bottom),12px)] py-3">
          {isOwner && (
            <button
              className="mb-2 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-csoft text-[14.5px] font-bold text-cbrand"
              onClick={() => setAddOpen(true)}
            >
              <UserPlus size={17} /> Add members
            </button>
          )}
          <button
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#FEF1F0] text-[14.5px] font-bold text-cred"
            onClick={onLeave}
          >
            <LogOut size={17} /> {isOwner ? 'Delete group' : 'Leave group'}
          </button>
        </div>
        {addOpen && (
          <AddMembersSheet
            existing={group.members.map((m) => m.id)}
            desk={desk}
            onClose={() => setAddOpen(false)}
            onAdd={onAddMembers}
          />
        )}
      </div>
    </div>
  )
}

function AddMembersSheet({
  existing,
  desk,
  onClose,
  onAdd,
}: {
  existing: string[]
  desk: boolean
  onClose: () => void
  onAdd: (ids: string[]) => void
}) {
  const chats = useApp((s) => s.chats)
  const contacts = useApp((s) => s.contacts)
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const [searchRes, setSearchRes] = useState<Array<{ id: string; name: string; username: string; avatarKey: number; avatarUrl: string | null }>>([])

  const pool = useMemo(() => {
    const map = new Map<string, { id: string; name: string; username: string; avatarKey: number; avatarUrl: string | null }>()
    for (const c of chats) map.set(c.peer.id, { id: c.peer.id, name: c.peer.name, username: c.peer.username, avatarKey: c.peer.avatarKey, avatarUrl: c.peer.avatarUrl ?? null })
    for (const c of contacts) {
      if (c.user && !map.has(c.user.id))
        map.set(c.user.id, { id: c.user.id, name: c.user.name, username: (c.user as unknown as { username?: string }).username ?? '', avatarKey: c.user.avatarKey, avatarUrl: (c.user as unknown as { avatarUrl?: string | null }).avatarUrl ?? null })
    }
    return Array.from(map.values()).filter((p) => !existing.includes(p.id))
  }, [chats, contacts, existing])

  useEffect(() => {
    const needle = q.trim()
    if (!needle) {
      queueMicrotask(() => setSearchRes([]))
      return
    }
    const t = window.setTimeout(async () => {
      try {
        const res = await api.searchUsers(needle)
        setSearchRes(res.users.filter((u) => !existing.includes(u.id)))
      } catch {
        setSearchRes([])
      }
    }, 280)
    return () => window.clearTimeout(t)
  }, [q, existing])

  const list = q.trim() ? searchRes : pool
  const toggle = (id: string) => setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))

  return (
    <div className="absolute inset-0 z-10 flex flex-col rounded-[inherit] bg-white">
      <div className="flex items-center justify-between border-b border-cline px-4 pb-3 pt-4">
        <h3 className="text-[15px] font-extrabold text-cink">Add members</h3>
        <button onClick={onClose} className="text-[12.5px] font-bold text-cmut" aria-label="Close">
          Cancel
        </button>
      </div>
      <div className="px-4 pt-3">
        <div className="flex h-10 items-center gap-2 rounded-full bg-[#F0F3FA] px-3.5">
          <Search size={15} className="text-cmut" />
          <input
            className="w-full bg-transparent text-[14px] text-cink outline-none placeholder:text-[#7A8499]"
            placeholder="Search people"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>
      <div className="app-scroll flex-1 overflow-y-auto px-2 py-2">
        {list.map((p) => {
          const on = picked.includes(p.id)
          return (
            <button
              key={p.id}
              className={`flex w-full items-center gap-3 rounded-2xl px-2.5 py-2 text-left transition ${on ? 'bg-csoft' : 'hover:bg-cbg'}`}
              onClick={() => toggle(p.id)}
            >
              <Avatar name={p.name} avatarKey={p.avatarKey} size={40} src={p.avatarUrl} />
              <span className="min-w-0 flex-1 truncate text-[14.5px] font-semibold text-cink">{p.name}</span>
              <span
                className={`flex h-6 w-6 flex-none items-center justify-center rounded-full border-2 ${
                  on ? 'border-cbrand bg-cbrand text-white' : 'border-cline bg-white'
                }`}
              >
                {on && <Check size={14} />}
              </span>
            </button>
          )
        })}
        {list.length === 0 && <p className="px-3 py-6 text-center text-sm text-cmut">No people found</p>}
      </div>
      <div className="border-t border-cline px-4 pb-[max(env(safe-area-inset-bottom),12px)] py-3">
        <button
          className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-brand-grad text-[15px] font-bold text-white disabled:opacity-40"
          disabled={!picked.length}
          onClick={() => onAdd(picked)}
        >
          <Users size={17} /> Add {picked.length} to group
        </button>
      </div>
    </div>
  )
}
