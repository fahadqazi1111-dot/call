'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Avatar, OfficialAvatar } from './Avatar'
import { StoriesTray } from './StoriesTray'
import { StaffTick } from './StaffTick'
import {
  Search, Plus, Mic, Video, Phone, Check, CheckCheck, MessageSquare, Camera,
  MoreVertical, Archive, ArchiveRestore, Bell, BellOff, Ban, ShieldBan, Flag, Trash2, CircleUserRound,
} from 'lucide-react'
import { useApp } from '@/lib/callapp/store'
import { fmtChatListTime, fmtDuration } from '@/lib/callapp/utils'
import { AdBanner } from './GiftsUI'
import { api } from '@/lib/callapp/api'
import { PeerProfileSheet } from './PeerProfileSheet'
import { GroupsSection } from './GroupChat'
import {
  ChatActionDialogs,
  ChatMenuItem,
  MenuDivider,
  MenuShell,
  setChatArchived,
  setChatMuted,
  unblockUserAction,
  unrestrictUserAction,
  type PendingAction,
} from './ChatActions'
import type { ChatSummary } from '@/lib/callapp/types'

export function ChatsTab({ variant = 'mobile' }: { variant?: 'mobile' | 'desktop' }) {
  const chats = useApp((s) => s.chats)
  const online = useApp((s) => s.online)
  const openChat = useApp((s) => s.openChat)
  const openPeerId = useApp((s) => s.openPeerId)
  const setTab = useApp((s) => s.setTab)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'unread' | 'archived'>('all')
  /** archived chats are served separately by GET /api/chats?archived=1 */
  const [archivedChats, setArchivedChats] = useState<ChatSummary[]>([])
  const [refreshKey, setRefreshKey] = useState(0)
  const desk = variant === 'desktop'

  /* fetch the archived list on mount, on every view (re)open and after any
     archive/unarchive/delete, so the Archived chip count and view stay in sync */
  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const { chats: archived } = await api.chatsArchived()
        if (alive) setArchivedChats(archived)
      } catch {}
    })()
    return () => {
      alive = false
    }
  }, [refreshKey, filter])

  /** live rows from the store — the server excludes archived chats from the main list */
  const chatById = useMemo(() => new Map(chats.map((c) => [c.peer.id, c])), [chats])

  /**
   * Archived view: server snapshots blended with live store rows. Blending
   * means unarchive (live row wins with archived=false), mute/unmute, block
   * flags and deletes all reflect instantly without extra fetches.
   */
  const archivedView = useMemo(
    () =>
      archivedChats
        .map((a) => chatById.get(a.peer.id) ?? a)
        .filter((c) => c.archived)
        .sort((a, b) => +new Date(b.lastActivity) - +new Date(a.lastActivity)),
    [archivedChats, chatById]
  )
  const archivedCount = archivedView.length

  const list = useMemo(() => {
    const base = filter === 'archived' ? archivedView : chats.filter((c) => !c.archived)
    let arr = [...base].sort((a, b) => +new Date(b.lastActivity) - +new Date(a.lastActivity))
    if (filter === 'unread') arr = arr.filter((c) => c.unread > 0)
    if (query.trim()) {
      const q = query.toLowerCase()
      arr = arr.filter((c) => c.peer.name.toLowerCase().includes(q))
    }
    return arr
  }, [chats, filter, archivedView, query])

  const previewOf = (c: ChatSummary) => {
    const lm = c.lastMessage
    if (!lm) return 'Say salam — start the conversation'
    if (lm.deletedAt) return lm.mine ? 'You unsent a message' : 'Message unsent'
    const fwd = lm.forwarded ? 'Forwarded · ' : ''
    if (lm.type === 'text') return (lm.mine ? 'You: ' : '') + fwd + lm.content
    if (lm.type === 'voice') return `${lm.mine ? 'You sent' : 'Voice message'} · ${fmtDuration(lm.duration ?? 0)}`
    try {
      const meta = JSON.parse(lm.content) as { callType?: string; status?: string; durationSec?: number }
      const icon = meta.callType === 'video' ? 'Video call' : 'Voice call'
      if (meta.status === 'answered') return `${lm.mine ? 'You called · ' : ''}${icon} ${fmtDuration(meta.durationSec ?? 0)}`
      if (meta.status === 'no-answer') return lm.mine ? 'No answer' : `Missed ${icon.toLowerCase()}`
      if (meta.status === 'declined') return 'Declined'
      return icon
    } catch {
      return 'Call'
    }
  }

  /* keep the local archived list in step after row-menu actions */
  const handleArchived = (c: ChatSummary, next: boolean) => {
    void setChatArchived(c.peer.id, next).then((ok) => {
      if (!ok) return
      setArchivedChats((cur) =>
        next ? (cur.some((x) => x.peer.id === c.peer.id) ? cur : [{ ...c, archived: true }, ...cur]) : cur.filter((x) => x.peer.id !== c.peer.id)
      )
    })
  }
  const handleMuted = (c: ChatSummary, next: boolean) => {
    void setChatMuted(c.peer.id, next).then((ok) => {
      if (!ok) return
      setArchivedChats((cur) => cur.map((x) => (x.peer.id === c.peer.id ? { ...x, muted: next } : x)))
    })
  }
  const handleDeleted = (peerId: string) => {
    setArchivedChats((cur) => cur.filter((x) => x.peer.id !== peerId))
    setRefreshKey((k) => k + 1)
  }

  /* ---------- shared pieces (single source of truth for both variants) ---------- */

  const headerNode = (
    <header
      className={`flex items-center gap-2.5 ${
        desk ? 'border-b border-cline px-4 pb-3 pt-5' : 'px-5 pt-[max(env(safe-area-inset-top),16px)]'
      }`}
    >
      <h1 className={`flex-1 font-extrabold tracking-tight text-cink ${desk ? 'text-[26px]' : 'text-[30px]'}`}>
        Chats
      </h1>
      {desk ? (
        <button
          className="flex h-10 w-10 items-center justify-center rounded-full bg-cbrand text-white transition hover:bg-cbrand-deep"
          aria-label="New chat"
          title="New chat"
          onClick={() => setTab('contacts')}
        >
          <MessageSquare size={19} />
        </button>
      ) : (
        <>
          <button
            className="flex h-11 w-11 items-center justify-center rounded-full bg-csoft text-cbrand"
            aria-label="New conversation"
            onClick={() => setTab('contacts')}
          >
            <Camera size={21} />
          </button>
          <button
            className="flex h-11 w-11 items-center justify-center rounded-full bg-cbrand text-white"
            aria-label="New chat"
            onClick={() => setTab('contacts')}
          >
            <Plus size={21} />
          </button>
        </>
      )}
    </header>
  )

  const searchNode = (
    <div
      className={`flex h-[46px] items-center gap-2.5 rounded-[14px] bg-[#F0F3FA] px-3.5 text-[#7A8499] ${
        desk ? 'mx-4 mt-4' : 'mx-5 mt-3'
      }`}
    >
      <Search size={19} className="flex-none" />
      <input
        className="w-full min-w-0 bg-transparent text-[15px] text-cink outline-none placeholder:text-[#7A8499]"
        placeholder="Search chats"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search chats"
      />
    </div>
  )

  const chipsNode = (
    <div className={`flex gap-2 pb-2 pt-3 ${desk ? 'px-4' : 'px-5'}`}>
      <ChipButton active={filter === 'all'} onClick={() => setFilter('all')}>
        All
      </ChipButton>
      <ChipButton active={filter === 'unread'} onClick={() => setFilter('unread')}>
        Unread
      </ChipButton>
      <ChipButton active={filter === 'archived'} onClick={() => setFilter('archived')}>
        Archived
        {archivedCount > 0 && (
          <span
            className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10.5px] font-bold ${
              filter === 'archived' ? 'bg-white/25 text-white' : 'bg-[#E3E9F6] text-[#4A5568]'
            }`}
          >
            {archivedCount}
          </span>
        )}
      </ChipButton>
    </div>
  )

  const listNode = (
    <>
      {list.length === 0 ? (
        filter === 'archived' ? (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-csoft text-cbrand">
              <Archive size={34} />
            </div>
            <p className="mt-5 text-lg font-bold text-cink">No archived chats</p>
            <p className="mt-1 text-sm text-cmut">Archive a chat from its options menu to keep your list tidy.</p>
          </div>
        ) : (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-csoft text-cbrand">
              <MessageBig />
            </div>
            <p className="mt-5 text-lg font-bold text-cink">No chats yet</p>
            <p className="mt-1 text-sm text-cmut">
              Add your contacts and start talking — calls and messages are always free.
            </p>
            <button className="mt-5 rounded-full bg-brand-grad px-6 py-3 text-sm font-semibold text-white" onClick={() => setTab('contacts')}>
              Find people
            </button>
          </div>
        )
      ) : (
        <div className={desk ? 'space-y-0.5 px-2 pt-1' : 'pt-1'}>
          {list.map((c) => (
            <div
              key={c.conversationId}
              role="button"
              tabIndex={0}
              aria-label={`Open chat with ${c.peer.name}`}
              className={`flex cursor-pointer text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-cbrand/40 ${
                desk
                  ? 'w-full items-center gap-3 rounded-xl px-3 py-2.5'
                  : 'w-full items-center gap-3.5 px-5 py-3'
              } ${
                openPeerId === c.peer.id
                  ? desk
                    ? 'bg-[#E7EEFF]'
                    : 'bg-cbg'
                  : 'hover:bg-cbg'
              }`}
              onClick={() => openChat(c.peer.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  openChat(c.peer.id)
                }
              }}
            >
              {c.peer.isOfficial ? (
                <OfficialAvatar size={desk ? 46 : 56} />
              ) : (
                <Avatar name={c.peer.name} avatarKey={c.peer.avatarKey} size={desk ? 46 : 56} online={online[c.peer.id]} src={c.peer.avatarUrl} />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-[15.5px] font-bold text-cink">
                  <span className="truncate">{c.peer.name}</span>
                  <StaffTick role={c.peer.role} isOfficial={c.peer.isOfficial} />
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 text-[13.5px] text-[#4A5568]">
                  {c.blockedMe && <Ban size={14} className="flex-none text-cred" aria-hidden="true" />}
                  {c.blocked ? (
                    <span className="truncate font-semibold text-cred">Blocked</span>
                  ) : (
                    <>
                      <PreviewIcon chat={c} />
                      <span className="truncate">{previewOf(c)}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex w-[52px] flex-none flex-col items-end">
                <span className="flex items-center gap-1 text-[11.5px] text-cmut">
                  {c.muted && (
                    <span title="Notifications muted" className="flex-none">
                      <BellOff size={12} aria-hidden="true" />
                    </span>
                  )}
                  {c.restricted && (
                    <span title="Restricted — no call or notification" className="flex-none">
                      <ShieldBan size={12} aria-hidden="true" />
                    </span>
                  )}
                  {fmtChatListTime(c.lastActivity)}
                </span>
                {c.unread > 0 ? (
                  <span className="mt-1.5 flex h-[21px] min-w-[21px] items-center justify-center rounded-full bg-cbrand px-1.5 text-[11px] font-bold text-white">
                    {c.unread}
                  </span>
                ) : null}
              </div>
              <RowMenu
                chat={c}
                desk={desk}
                archivedView={filter === 'archived'}
                onArchive={handleArchived}
                onMute={handleMuted}
                onDeleted={handleDeleted}
              />
            </div>
          ))}
        </div>
      )}
    </>
  )

  if (desk) {
    /* desktop: pinned header + single list scroller */
    return (
      <div className="flex h-full flex-col">
        {headerNode}
        {searchNode}
        {chipsNode}
        <StoriesTray variant={variant} />
        <div className="app-scroll desk-scroll flex-1 overflow-y-auto pb-4">
          <AdBanner placement="chats" />
          <GroupsSection variant={variant} />
          {listNode}
        </div>
      </div>
    )
  }

  /* mobile: header + search stay pinned at the top; chips, stories, ad, groups
     and the chat list scroll together as ONE full page (nothing else sticks) */
  return (
    <div className="flex h-full flex-col">
      <div className="z-20 flex-none bg-white pb-1">
        {headerNode}
        {searchNode}
      </div>
      <div className="app-scroll flex-1 overflow-y-auto pb-4">
        {chipsNode}
        <StoriesTray variant={variant} />
        <AdBanner placement="chats" />
        <GroupsSection variant={variant} />
        {listNode}
      </div>
    </div>
  )
}

function ChipButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      className={`flex items-center rounded-[20px] px-4 py-2 text-[13px] font-semibold transition-colors ${
        active ? 'bg-cbrand text-white' : 'bg-[#F0F3FA] text-[#4A5568]'
      }`}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

/* WhatsApp-style three-dot overflow menu for one chat row */
function RowMenu({
  chat,
  desk,
  archivedView,
  onArchive,
  onMute,
  onDeleted,
}: {
  chat: ChatSummary
  desk: boolean
  archivedView: boolean
  onArchive: (c: ChatSummary, next: boolean) => void
  onMute: (c: ChatSummary, next: boolean) => void
  onDeleted: (peerId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [up, setUp] = useState(false)
  const [pending, setPending] = useState<PendingAction>(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const peer = chat.peer

  const toggle = () => {
    if (!open) {
      // flip the panel upward when the row sits near the bottom of the viewport
      const rect = wrapRef.current?.getBoundingClientRect()
      setUp(!!rect && window.innerHeight - rect.bottom < 280)
    }
    setOpen((o) => !o)
  }

  const act = (fn: () => void) => () => {
    setOpen(false)
    fn()
  }

  return (
    <div ref={wrapRef} className="relative flex-none">
      <button
        type="button"
        className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-cmut transition hover:bg-csoft"
        aria-label={`Options for chat with ${peer.name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation()
          toggle()
        }}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <MoreVertical size={18} />
      </button>
      <MenuShell open={open} onClose={() => setOpen(false)} wrapRef={wrapRef} up={up}>
        <ChatMenuItem icon={<CircleUserRound size={17} />} label="View profile" onClick={act(() => setProfileOpen(true))} />
        <ChatMenuItem
          icon={archivedView ? <ArchiveRestore size={17} /> : <Archive size={17} />}
          label={archivedView ? 'Unarchive chat' : 'Archive chat'}
          onClick={act(() => onArchive(chat, !archivedView))}
        />
        <ChatMenuItem
          icon={chat.muted ? <Bell size={17} /> : <BellOff size={17} />}
          label={chat.muted ? 'Unmute notifications' : 'Mute notifications'}
          onClick={act(() => onMute(chat, !chat.muted))}
        />
        <ChatMenuItem
          icon={<Ban size={17} />}
          label={chat.blocked ? 'Unblock user' : 'Block user'}
          danger
          onClick={act(() => (chat.blocked ? void unblockUserAction(peer.id, peer.name) : setPending('block')))}
        />
        <ChatMenuItem
          icon={<ShieldBan size={17} />}
          label={chat.restricted ? 'Unrestrict user' : 'Restrict user'}
          onClick={act(() => (chat.restricted ? void unrestrictUserAction(peer.id, peer.name) : setPending('restrict')))}
        />
        <ChatMenuItem icon={<Flag size={17} />} label="Report user" danger onClick={act(() => setPending('report'))} />
        <MenuDivider />
        <ChatMenuItem icon={<Trash2 size={17} />} label="Delete chat" danger onClick={act(() => setPending('delete'))} />
      </MenuShell>
      <ChatActionDialogs
        peer={peer}
        pending={pending}
        onClose={() => setPending(null)}
        onDone={() => {
          if (pending === 'delete') onDeleted(peer.id)
        }}
      />
      {profileOpen && <PeerProfileSheet peer={peer} desk={desk} onClose={() => setProfileOpen(false)} />}
    </div>
  )
}

function PreviewIcon({ chat }: { chat: ChatSummary }) {
  const lm = chat.lastMessage
  if (!lm) return null
  if (lm.type === 'voice')
    return <Mic size={15} className="flex-none text-cbrand" />
  if (lm.type === 'call') {
    let meta: { callType?: string; status?: string } = {}
    try {
      meta = JSON.parse(lm.content)
    } catch {}
    const missed = !lm.mine && meta.status !== 'answered'
    if (meta.callType === 'video') return <Video size={15} className={missed ? 'flex-none text-cred' : 'flex-none text-cgreen'} />
    return <Phone size={15} className={missed ? 'flex-none text-cred' : 'flex-none text-cgreen'} />
  }
  if (lm.mine) {
    // sent ✓ → delivered ✓✓ (grey) → read ✓✓ (blue)
    return lm.readAt ? (
      <CheckCheck size={15} className="flex-none text-cbrand" />
    ) : lm.deliveredAt ? (
      <CheckCheck size={15} className="flex-none text-[#9AA8C7]" />
    ) : (
      <Check size={15} className="flex-none text-[#9AA8C7]" />
    )
  }
  return null
}

function MessageBig() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
      <path d="M8.5 11h7M8.5 14h4" />
    </svg>
  )
}
