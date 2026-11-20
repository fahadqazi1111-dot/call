'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  X, Send, Users, Search, Loader2, ArrowLeft, MoreVertical, LogOut, UserPlus,
  Check, Crown, UsersRound, Mic, Plus, ImageIcon, Film, ShieldCheck, Trash2, Camera, Eraser,
} from 'lucide-react'
import { toast } from 'sonner'
import { api, uploadFile } from '@/lib/callapp/api'
import { useApp } from '@/lib/callapp/store'
import { socketClient } from '@/lib/callapp/socket'
import { Avatar } from './Avatar'
import { VoiceBubble } from './VoiceBubble'
import { MediaComposer, type ComposedMedia } from './MediaComposer'
import { SponsoredAdCard, type ServedAd } from './GiftsUI'
import { getMediaUrl } from '@/lib/callapp/media'
import { useRecorder } from './useRecorder'
import { fmtChatListTime, fmtDuration } from '@/lib/callapp/utils'
import type { GroupItem, GroupMessageItem, GroupMemberItem, Message } from '@/lib/callapp/types'

const NAME_COLORS = ['#E1306C', '#7B3FE4', '#0EA5E9', '#F59E0B', '#10B981', '#EF4444', '#8B5CF6']

function nameColor(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 997
  return NAME_COLORS[h % NAME_COLORS.length]
}

/** resolve a private media id into a signed URL */
function useMediaUrl(mediaId?: string | null): string | null {
  const [url, setUrl] = useState<string | null>(mediaId ? null : null)
  useEffect(() => {
    if (!mediaId) return
    let alive = true
    void getMediaUrl(mediaId).then((u) => {
      if (alive) setUrl(u)
    })
    return () => {
      alive = false
    }
  }, [mediaId])
  return mediaId ? url : null
}

function previewOf(m: GroupMessageItem | null, mine: boolean): string {
  if (!m) return ''
  if (m.type === 'voice') return `${mine ? 'Voice message' : `${m.sender.name.split(' ')[0]} sent a voice message`}`
  if (m.type === 'image') return 'Photo'
  if (m.type === 'video') return 'Video'
  return m.content
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
              <GroupAvatar name={g.name} size={desk ? 46 : 56} members={g.members.length} avatarUrl={g.avatarUrl ?? null} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15.5px] font-bold text-cink">{g.name}</div>
                <div className="mt-0.5 truncate text-[13.5px] text-[#4A5568]">
                  {g.lastMessage ? (
                    <>
                      {g.lastMessage.type === 'text' || g.lastMessage.type === 'system' ? (
                        <>
                          {g.lastMessage.mine ? (
                            <span className="font-semibold">You: </span>
                          ) : g.lastMessage.senderName ? (
                            <span className="font-semibold">{g.lastMessage.senderName.split(' ')[0]}: </span>
                          ) : null}
                          {g.lastMessage.content}
                        </>
                      ) : (
                        <>
                          {g.lastMessage.mine ? <span className="font-semibold">You: </span> : null}
                          {previewOf(
                            { type: g.lastMessage.type, sender: { name: g.lastMessage.senderName } } as unknown as GroupMessageItem,
                            g.lastMessage.mine
                          )}
                        </>
                      )}
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

/** rounded group tile: uploaded photo when set, initials otherwise */
function GroupAvatar({
  name,
  size,
  members,
  avatarUrl,
}: {
  name: string
  size: number
  members: number
  avatarUrl?: string | null
}) {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
  return (
    <span className="relative inline-flex flex-none">
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={name}
          className="rounded-full object-cover ring-1 ring-cline"
          style={{ width: size, height: size }}
        />
      ) : (
        <span
          className="flex items-center justify-center rounded-full bg-brand-grad font-extrabold text-white"
          style={{ width: size, height: size, fontSize: size * 0.36 }}
          aria-hidden="true"
        >
          {initials || 'G'}
        </span>
      )}
      <span className="absolute -bottom-0.5 -right-0.5 flex items-center gap-0.5 rounded-full bg-white px-1 text-[9px] font-extrabold text-cbrand ring-1 ring-cline">
        <Users size={8} /> {members}
      </span>
    </span>
  )
}

/* ============================================================
 * Group creation sheet — photo, name, pick members (search included)
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
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement | null>(null)
  const [searchRes, setSearchRes] = useState<Array<{ id: string; name: string; username: string; avatarKey: number; avatarUrl: string | null }>>([])
  const [searching, setSearching] = useState(false)

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
        setSearchRes(res)
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

  const pickAvatar = async (f: File | undefined | null) => {
    if (!f) return
    if (!f.type.startsWith('image/')) {
      toast.error('Please choose an image')
      return
    }
    setUploadingAvatar(true)
    try {
      const res = await uploadFile(f, 'group.jpg', 'avatar')
      setAvatarUrl(`/api/media/${res.id}`)
      toast.success('Group photo ready')
    } catch {
      toast.error('Upload failed')
    } finally {
      setUploadingAvatar(false)
    }
  }

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
      const res = await api.createGroup(name.trim(), picked.map((p) => p.id), avatarUrl)
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

        <div className="flex items-center gap-4 px-4 pt-4">
          {/* group photo picker */}
          <button
            className="relative flex-none"
            onClick={() => avatarInputRef.current?.click()}
            aria-label="Choose group photo"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="Group" className="h-[72px] w-[72px] rounded-full object-cover ring-1 ring-cline" />
            ) : (
              <span className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-csoft text-cbrand">
                <Camera size={26} />
              </span>
            )}
            {uploadingAvatar && (
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50">
                <Loader2 size={20} className="animate-spin text-white" />
              </span>
            )}
            <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-cbrand text-white ring-2 ring-white">
              <Plus size={13} strokeWidth={3} />
            </span>
          </button>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void pickAvatar(e.target.files?.[0])}
          />
          <input
            className="h-12 min-w-0 flex-1 rounded-[14px] bg-[#F0F3FA] px-4 text-[15px] text-cink outline-none placeholder:text-[#7A8499]"
            placeholder="Group name (e.g. Family, Team CALL)"
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        {picked.length > 0 && (
          <div className="flex flex-wrap gap-2 px-4 pt-3">
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
        <div className="px-4 pt-3">
          <div className="flex h-10 items-center gap-2 rounded-full bg-[#F0F3FA] px-3.5">
            <Search size={15} className="text-cmut" />
            <input
              className="w-full bg-transparent text-[14px] text-cink outline-none placeholder:text-[#7A8499]"
              placeholder="Search people by name or @username"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>

        <div className="app-scroll min-h-[140px] flex-1 overflow-y-auto px-2 py-2">
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
 * Group chat screen — realtime messages + voice/photo/video (WhatsApp-style)
 * ============================================================ */
export function GroupChatScreen({ group, desk, onClose }: { group: GroupItem; desk: boolean; onClose: () => void }) {
  const me = useApp((s) => s.me)
  const [meta, setMeta] = useState<GroupItem>(group)
  const [messages, setMessages] = useState<GroupMessageItem[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const [composer, setComposer] = useState<{ file: File; kind: 'image' | 'video' } | null>(null)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const seenRef = useRef(new Set<string>())
  const photoInputRef = useRef<HTMLInputElement | null>(null)
  const videoInputRef = useRef<HTMLInputElement | null>(null)
  const recorder = useRecorder()

  /* ---------- in-conversation sponsored ads (same engine as 1:1 chats) ---------- */
  const [adCfg, setAdCfg] = useState({ firstAfter: 10, interval: 20 })
  const [chatAds, setChatAds] = useState<ServedAd[]>([])
  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const res = await api.ads('chats')
        if (!alive) return
        if (res.chatAd) setAdCfg(res.chatAd)
        if (res.ads[0]) setChatAds([res.ads[0]])
      } catch {}
    })()
    return () => {
      alive = false
    }
  }, [])
  // an ad slot number is attached to the message index it follows — after the
  // first N (non-system) messages, then after every M further messages
  const adSlots = useMemo(() => {
    const map: Record<number, number> = {}
    let count = 0
    let slot = 0
    for (let i = 0; i < messages.length; i++) {
      if (messages[i].type === 'system') continue
      count++
      if (
        count === adCfg.firstAfter ||
        (count > adCfg.firstAfter && (count - adCfg.firstAfter) % adCfg.interval === 0)
      ) {
        map[i] = slot++
      }
    }
    return map
  }, [messages, adCfg])
  const slotCount = Object.keys(adSlots).length
  useEffect(() => {
    // fetch a different rotated ad for each additional slot
    if (slotCount <= chatAds.length) return
    let alive = true
    void (async () => {
      try {
        const exclude = chatAds.map((a) => a.id)
        const res = await api.ads('chats', exclude)
        if (alive && res.ads[0]) setChatAds((cur) => [...cur, res.ads[0]])
      } catch {}
    })()
    return () => {
      alive = false
    }
  }, [slotCount, chatAds.length])

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

  const pushMessage = useCallback((m: GroupMessageItem) => {
    if (!seenRef.current.has(m.id)) {
      seenRef.current.add(m.id)
      setMessages((cur) => [...cur.slice(-200), m])
    }
  }, [])

  const sendText = async () => {
    const content = text.trim()
    if (!content || !me || sending) return
    setSending(true)
    setText('')
    try {
      const res = await api.groupSend(group.id, { type: 'text', content })
      socketClient.emit('group:msg', { groupId: group.id, message: res.message })
      pushMessage(res.message)
    } catch (e) {
      toast.error((e as Error).message || 'Could not send')
      setText(content)
    } finally {
      setSending(false)
    }
  }

  /** voice note — record → upload → send */
  const stopAndSendVoice = async () => {
    const out = await recorder.stop()
    if (!out || !me) return
    setSending(true)
    try {
      const up = await api.uploadVoice(out.blob)
      const res = await api.groupSend(group.id, { type: 'voice', mediaId: up.id, duration: out.durationSec })
      socketClient.emit('group:msg', { groupId: group.id, message: res.message })
      pushMessage(res.message)
    } catch (e) {
      toast.error((e as Error).message || 'Could not send the voice message')
    } finally {
      setSending(false)
    }
  }

  /** photo/video after the crop/trim composer */
  const sendComposed = async (media: ComposedMedia, kind: 'image' | 'video') => {
    setSending(true)
    try {
      const up = kind === 'image' ? await api.uploadImage(media.blob) : await api.uploadVideo(media.blob)
      const res = await api.groupSend(group.id, {
        type: kind,
        mediaId: up.id,
        duration: media.durationSec,
      })
      socketClient.emit('group:msg', { groupId: group.id, message: res.message })
      pushMessage(res.message)
      toast.success(kind === 'image' ? 'Photo sent' : 'Video sent')
    } catch (e) {
      toast.error((e as Error).message || 'Could not send')
    } finally {
      setSending(false)
    }
  }

  const leave = async () => {
    const isOwner = meta.ownerId === me?.id
    const msg = isOwner
      ? 'Leave this group? Ownership will transfer to another admin or the next member.'
      : 'Leave this group?'
    if (!confirm(msg)) return
    try {
      const res = await api.groupLeave(group.id)
      toast.success(res.dissolved ? 'Group dissolved' : 'You left the group')
      onClose()
    } catch (e) {
      toast.error((e as Error).message || 'Could not leave')
    }
  }

  /** WhatsApp-style per-user clear — other members still see everything */
  const clearChat = async () => {
    if (!confirm('Clear all messages in this group for you? Other members will still see them.')) return
    try {
      await api.groupChatState(group.id, 'clear')
      setMessages([])
      setInfoOpen(false)
      toast.success('Chat cleared for you')
    } catch (e) {
      toast.error((e as Error).message || 'Could not clear the chat')
    }
  }

  /** WhatsApp-style per-user delete — hidden from my list until a new message arrives */
  const deleteChat = async () => {
    if (!confirm('Delete this group chat for you? It will re-appear if someone sends a new message.')) return
    try {
      await api.groupChatState(group.id, 'delete')
      toast.success('Chat deleted for you')
      onClose()
    } catch (e) {
      toast.error((e as Error).message || 'Could not delete the chat')
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
  const isAdmin = isOwner || meta.myRole === 'admin'

  return (
    <div className={desk ? 'absolute inset-0 z-40 flex flex-col bg-cbg' : 'fixed inset-0 z-[70] flex flex-col bg-cbg'}>
      {/* header */}
      <header className="flex items-center gap-3 border-b border-cline bg-white px-3 pb-3 pt-4">
        <button className="flex h-10 w-10 items-center justify-center rounded-full bg-csoft text-cink" onClick={onClose} aria-label="Back">
          <ArrowLeft size={19} />
        </button>
        <GroupAvatar name={meta.name} size={42} members={meta.members.length} avatarUrl={meta.avatarUrl ?? null} />
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
            {messages.map((m, i) => (
              <div key={m.id}>
                <GroupMessageRow m={m} meId={me?.id ?? ''} onOpenLightbox={setLightbox} />
                {adSlots[i] !== undefined && chatAds[adSlots[i]] && (
                  <div className="pt-1.5">
                    <SponsoredAdCard ad={chatAds[adSlots[i]]} />
                  </div>
                )}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* composer / recorder */}
      {recorder.status === 'recording' ? (
        <div className="flex items-center gap-3 border-t border-cline bg-white px-4 py-3.5 pb-[max(env(safe-area-inset-bottom),14px)]">
          <button
            className="flex h-12 w-12 flex-none items-center justify-center rounded-full text-cred hover:bg-[#FEF0EF]"
            aria-label="Cancel recording"
            onClick={recorder.cancel}
          >
            <Trash2 size={23} />
          </button>
          <div className="flex h-12 flex-1 items-center gap-3 rounded-[24px] bg-[#FEF0EF] px-4 text-cred">
            <span className="blink-anim h-2.5 w-2.5 flex-none rounded-full bg-cred" />
            <span className="min-w-[38px] text-sm font-bold">{fmtDuration(recorder.seconds)}</span>
            <div className="flex h-6 flex-1 items-end gap-[2.5px] overflow-hidden">
              {recorder.bars.map((h, i) => (
                <span
                  key={i}
                  className="w-[3px] flex-none rounded-sm bg-cred"
                  style={{ height: h, opacity: 0.35 + (i / Math.max(1, recorder.bars.length)) * 0.65 }}
                />
              ))}
            </div>
          </div>
          <button
            className="relative flex h-12 w-12 flex-none items-center justify-center rounded-full bg-brand-grad text-white shadow-[0_6px_16px_rgba(47,91,234,0.35)]"
            aria-label="Send voice message"
            onClick={() => void stopAndSendVoice()}
          >
            <span className="ring-anim absolute inset-0 rounded-full border-2 border-cred" style={{ animationDuration: '1.8s', borderColor: '#F04438' }} />
            <Send size={21} />
          </button>
        </div>
      ) : (
        <div className="border-t border-cline bg-white px-3 pt-3 pb-[max(env(safe-area-inset-bottom),14px)]">
          <div className="flex items-center gap-2">
            {/* attachments: photo / video */}
            <button
              className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-csoft text-cbrand"
              onClick={() => photoInputRef.current?.click()}
              aria-label="Send photo"
              title="Photo (crop before sending)"
            >
              <ImageIcon size={19} />
            </button>
            <button
              className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-csoft text-cbrand"
              onClick={() => videoInputRef.current?.click()}
              aria-label="Send video"
              title="Video (trim before sending)"
            >
              <Film size={19} />
            </button>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) setComposer({ file: f, kind: 'image' })
                e.target.value = ''
              }}
            />
            <input
              ref={videoInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) setComposer({ file: f, kind: 'video' })
                e.target.value = ''
              }}
            />
            <div className="flex h-12 min-w-0 flex-1 items-center rounded-[24px] bg-[#F0F3FA] px-4">
              <input
                className="w-full min-w-0 bg-transparent text-[15px] text-cink outline-none placeholder:text-[#7A8499]"
                placeholder={`Message ${meta.name}`}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void sendText()}
                aria-label="Group message"
              />
            </div>
            {text.trim() ? (
              <button
                className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-brand-grad text-white shadow-[0_6px_16px_rgba(47,91,234,0.35)] disabled:opacity-40"
                onClick={() => void sendText()}
                disabled={sending}
                aria-label="Send group message"
              >
                {sending ? <Loader2 size={19} className="animate-spin" /> : <Send size={19} />}
              </button>
            ) : (
              <button
                className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-brand-grad text-white shadow-[0_6px_16px_rgba(47,91,234,0.35)]"
                onClick={() => void recorder.start()}
                aria-label="Record voice message"
                title="Voice message"
              >
                <Mic size={22} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* media crop/trim composer (photo/video) */}
      {composer && (
        <MediaComposer
          file={composer.file}
          kind={composer.kind}
          onSend={(media) => sendComposed(media, composer.kind)}
          onClose={() => setComposer(null)}
        />
      )}

      {/* photo lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-[94] flex items-center justify-center bg-black/95" onClick={() => setLightbox(null)} role="dialog" aria-label="Photo viewer">
          <img src={lightbox} alt="Photo" className="max-h-[92vh] max-w-[96vw] object-contain" />
          <button className="absolute right-4 top-[max(env(safe-area-inset-top),16px)] rounded-full bg-white/10 p-2.5 text-white" onClick={() => setLightbox(null)} aria-label="Close photo">
            <X size={20} />
          </button>
        </div>
      )}

      {/* group info sheet */}
      {infoOpen && (
        <GroupInfoSheet
          group={meta}
          isOwner={isOwner}
          isAdmin={isAdmin}
          desk={desk}
          onClose={() => setInfoOpen(false)}
          onLeave={() => void leave()}
          onClearChat={() => void clearChat()}
          onDeleteChat={() => void deleteChat()}
          onAddMembers={(ids) => void addMembers(ids)}
          onMeta={(g) => setMeta(g)}
        />
      )}
    </div>
  )
}

/* ---------- one group message row (text / system / voice / photo / video) ---------- */
function GroupMessageRow({
  m,
  meId,
  onOpenLightbox,
}: {
  m: GroupMessageItem
  meId: string
  onOpenLightbox: (url: string) => void
}) {
  if (m.type === 'system') {
    return (
      <p className="mx-auto w-fit max-w-[90%] rounded-full bg-csoft px-3 py-1 text-center text-[11.5px] font-semibold text-cmut">
        {m.content}
      </p>
    )
  }
  const mine = m.mine || m.sender.id === meId
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[82%] flex-col ${mine ? 'items-end' : 'items-start'}`}>
        {!mine && (
          <span className="mb-0.5 pl-1 text-[11px] font-bold" style={{ color: nameColor(m.sender.id) }}>
            {m.sender.name.split(' ')[0]}
          </span>
        )}
        <div
          className={`overflow-hidden rounded-[18px] shadow-sm ${
            m.type === 'text' ? 'px-3.5 py-2.5' : 'p-1.5'
          } ${mine ? 'rounded-br-[6px] bg-cbrand text-white' : 'rounded-bl-[6px] bg-white text-cink ring-1 ring-cline'}`}
        >
          {m.type === 'text' && (
            <p className="whitespace-pre-wrap break-words text-[14px] leading-[19px]">{m.content}</p>
          )}
          {m.type === 'voice' && (
            <div className="min-w-[220px] px-1 py-0.5">
              <GroupVoiceBubble m={m} mine={mine} />
            </div>
          )}
          {m.type === 'image' && <GroupPhotoBubble m={m} onOpen={onOpenLightbox} />}
          {m.type === 'video' && <GroupVideoBubble m={m} />}
        </div>
        <span className="pt-0.5 text-[10px] text-cmut">{fmtChatListTime(m.createdAt)}</span>
      </div>
    </div>
  )
}

function GroupVoiceBubble({ m, mine }: { m: GroupMessageItem; mine: boolean }) {
  const url = useMediaUrl(m.mediaId)
  const shim = useMemo<Message>(
    () => ({
      id: m.id,
      type: 'voice',
      content: m.mediaId ?? '',
      duration: m.duration ?? null,
      createdAt: m.createdAt,
      mine,
      mediaUrl: url,
    }),
    [m.id, m.mediaId, m.duration, m.createdAt, mine, url]
  )
  return <VoiceBubble msg={shim} mine={mine} />
}

function GroupPhotoBubble({ m, onOpen }: { m: GroupMessageItem; onOpen: (url: string) => void }) {
  const url = useMediaUrl(m.mediaId)
  if (!url) {
    return <span className="flex h-40 w-56 items-center justify-center rounded-[14px] bg-black/10 text-cmut"><Loader2 size={18} className="animate-spin" /></span>
  }
  return (
    <button className="block max-w-[260px]" onClick={() => onOpen(url)} aria-label="Open photo">
      <img src={url} alt="Photo" className="max-h-[320px] w-full rounded-[14px] object-cover" loading="lazy" />
    </button>
  )
}

function GroupVideoBubble({ m }: { m: GroupMessageItem }) {
  const url = useMediaUrl(m.mediaId)
  if (!url) {
    return <span className="flex h-40 w-56 items-center justify-center rounded-[14px] bg-black/10 text-cmut"><Loader2 size={18} className="animate-spin" /></span>
  }
  return (
    <div className="flex items-center gap-1.5">
      <video src={url} controls playsInline className="max-h-[320px] w-[260px] rounded-[14px] bg-black object-contain" preload="metadata" />
      {m.duration ? <span className="flex-none pr-1 text-[10px] font-semibold opacity-70">{fmtDuration(m.duration)}</span> : null}
    </div>
  )
}

/* ---------- group info: photo, roles, members, add, leave ---------- */
function GroupInfoSheet({
  group,
  isOwner,
  isAdmin,
  desk,
  onClose,
  onLeave,
  onClearChat,
  onDeleteChat,
  onAddMembers,
  onMeta,
}: {
  group: GroupItem
  isOwner: boolean
  isAdmin: boolean
  desk: boolean
  onClose: () => void
  onLeave: () => void
  onClearChat: () => void
  onDeleteChat: () => void
  onAddMembers: (ids: string[]) => void
  onMeta: (g: GroupItem) => void
}) {
  const [addOpen, setAddOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement | null>(null)

  const changePhoto = async (f: File | undefined | null) => {
    if (!f) return
    if (!f.type.startsWith('image/')) {
      toast.error('Please choose an image')
      return
    }
    setUploading(true)
    try {
      const up = await uploadFile(f, 'group.jpg', 'avatar')
      const url = `/api/media/${up.id}`
      await api.groupUpdate(group.id, { avatarUrl: url })
      onMeta({ ...group, avatarUrl: url })
      toast.success('Group photo updated')
    } catch (e) {
      toast.error((e as Error).message || 'Could not update the photo')
    } finally {
      setUploading(false)
    }
  }

  const setRole = async (userId: string, role: 'admin' | 'member') => {
    try {
      await api.groupSetRole(group.id, userId, role)
      toast.success(role === 'admin' ? 'Promoted to admin' : 'Admin removed')
      const res = await api.groupDetail(group.id)
      onMeta({ ...group, ...res.group })
    } catch (e) {
      toast.error((e as Error).message || 'Could not change the role')
    }
  }

  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label="Group info">
      <button className="absolute inset-0 bg-black/50" aria-label="Close" onClick={onClose} />
      <div
        className="relative flex max-h-[85vh] w-full flex-col rounded-t-[24px] bg-white shadow-2xl sm:max-w-md sm:rounded-[24px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 pb-3 pt-4">
          <button
            className={isOwner ? 'relative flex-none' : 'relative flex-none cursor-default'}
            onClick={isOwner ? () => avatarInputRef.current?.click() : undefined}
            aria-label={isOwner ? 'Change group photo' : 'Group photo'}
          >
            <GroupAvatar name={group.name} size={54} members={group.members.length} avatarUrl={group.avatarUrl ?? null} />
            {isOwner && (
              <>
                <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 transition hover:bg-black/40" />
                <span className="absolute -bottom-0.5 left-1/2 flex h-5 w-5 -translate-x-1/2 items-center justify-center rounded-full bg-cbrand text-white ring-2 ring-white">
                  <Camera size={11} />
                </span>
              </>
            )}
            {uploading && (
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50">
                <Loader2 size={18} className="animate-spin text-white" />
              </span>
            )}
          </button>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void changePhoto(e.target.files?.[0])}
          />
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-[17px] font-extrabold text-cink">{group.name}</h3>
            <p className="text-[12px] text-cmut">{group.members.length} members · you are {isOwner ? 'the owner' : isAdmin ? 'an admin' : 'a member'}</p>
          </div>
          <button onClick={onClose} className="rounded-full bg-csoft p-2 text-cmut" aria-label="Close">
            <X size={17} />
          </button>
        </div>
        <div className="app-scroll flex-1 overflow-y-auto px-2 py-2">
          {group.members.map((m) => {
            const memberIsOwner = m.role === 'owner' || m.id === group.ownerId
            const canManage = isOwner && !memberIsOwner && m.id !== group.ownerId
            return (
              <div key={m.id} className="flex items-center gap-3 rounded-2xl px-2.5 py-2">
                <Avatar name={m.name} avatarKey={m.avatarKey} size={40} src={m.avatarUrl} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 truncate text-[14.5px] font-semibold text-cink">
                    {m.name}
                    {memberIsOwner && <Crown size={13} className="text-[#F59E0B]" />}
                    {m.role === 'admin' && !memberIsOwner && <ShieldCheck size={13} className="text-cbrand" />}
                  </div>
                  <div className="truncate text-[11.5px] text-cmut">
                    {memberIsOwner ? 'Owner' : m.role === 'admin' ? 'Admin' : `@${m.username || 'member'}`}
                  </div>
                </div>
                {canManage && (
                  <button
                    className={`flex h-8 flex-none items-center gap-1 rounded-full px-3 text-[11.5px] font-bold transition ${
                      m.role === 'admin' ? 'bg-csoft text-cmut hover:bg-[#e2e9fb]' : 'bg-csoft text-cbrand hover:bg-[#E7EEFF]'
                    }`}
                    onClick={() => void setRole(m.id, m.role === 'admin' ? 'member' : 'admin')}
                  >
                    {m.role === 'admin' ? 'Remove admin' : 'Make admin'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
        <div className="border-t border-cline px-4 pb-[max(env(safe-area-inset-bottom),12px)] py-3">
          {isAdmin && (
            <button
              className="mb-2 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-csoft text-[14.5px] font-bold text-cbrand"
              onClick={() => setAddOpen(true)}
            >
              <UserPlus size={17} /> Add members
            </button>
          )}
          <button
            className="mb-2 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-csoft text-[14.5px] font-bold text-cink"
            onClick={onClearChat}
          >
            <Eraser size={17} /> Clear chat (for me)
          </button>
          <button
            className="mb-2 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#FEF1F0] text-[14.5px] font-bold text-cred"
            onClick={onDeleteChat}
          >
            <Trash2 size={17} /> Delete chat (for me)
          </button>
          <button
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#FEF1F0] text-[14.5px] font-bold text-cred"
            onClick={onLeave}
          >
            <LogOut size={17} /> {isOwner ? 'Leave group (owner transfers)' : 'Leave group'}
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
        setSearchRes(res.filter((u) => !existing.includes(u.id)))
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
