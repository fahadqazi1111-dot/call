'use client'

import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Avatar, OfficialAvatar } from './Avatar'
import { VoiceBubble } from './VoiceBubble'
import { useRecorder } from './useRecorder'
import { useApp } from '@/lib/callapp/store'
import { socketClient } from '@/lib/callapp/socket'
import { fmtDuration, fmtTime, lastSeenLabel } from '@/lib/callapp/utils'
import { StaffTick } from './StaffTick'
import { SponsoredAdCard, type ServedAd } from './GiftsUI'
import { ChevronLeft, Mic, Phone, Plus, Send, Smile, Square, Trash2, Video, Check, CheckCheck, PhoneIncoming, PhoneOutgoing, PhoneMissed, ShieldCheck, MoreVertical, Archive, ArchiveRestore, Ban, Bell, BellOff, CircleUserRound, Flag, ShieldBan, Copy, Forward, Undo2, CheckSquare, X, Search, ClipboardCheck } from 'lucide-react'
import { api } from '@/lib/callapp/api'
import { toast } from 'sonner'
import { PeerProfileSheet } from './PeerProfileSheet'
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
import type { Message } from '@/lib/callapp/types'

const EMOJIS = ['😀', '😂', '🥰', '😍', '👍', '🙏', '🔥', '🎉', '❤️', '😭', '😮', '🤝']
const EMPTY_MESSAGES: Message[] = []

export function ChatScreen({ peerId, variant = 'mobile' }: { peerId: string; variant?: 'mobile' | 'desktop' }) {
  const me = useApp((s) => s.me)
  const messages = useApp((s) => s.messages[peerId]) ?? EMPTY_MESSAGES
  const chats = useApp((s) => s.chats)
  const contacts = useApp((s) => s.contacts)
  const online = useApp((s) => s.online)
  const typing = useApp((s) => s.typing[peerId] ?? false)
  const closeChat = useApp((s) => s.closeChat)
  const sendText = useApp((s) => s.sendText)
  const sendVoice = useApp((s) => s.sendVoice)
  const startCall = useApp((s) => s.startCall)
  const loadMessages = useApp((s) => s.loadMessages)
  const deleteMessages = useApp((s) => s.deleteMessages)
  const forwardMessages = useApp((s) => s.forwardMessages)
  const blockedMap = useApp((s) => s.blockedIds)

  /** Resolve the peer from existing chats, falling back to contacts (fresh conversation). */
  const peer = useMemo(() => {
    const fromChat = chats.find((c) => c.peer.id === peerId)?.peer
    if (fromChat) return fromChat
    const fromContact = contacts.find((c) => c.user?.id === peerId)?.user
    if (fromContact)
      return {
        id: fromContact.id,
        name: fromContact.name,
        username: fromContact.username ?? '',
        phone: '',
        about: fromContact.about,
        avatarKey: fromContact.avatarKey,
        avatarUrl: fromContact.avatarUrl ?? null,
        lastSeen: fromContact.lastSeen,
        role: fromContact.role,
        isOfficial: fromContact.isOfficial,
      }
    return undefined
  }, [chats, contacts, peerId])
  const [draft, setDraft] = useState('')
  const [showEmoji, setShowEmoji] = useState(false)
  const [sending, setSending] = useState(false)
  /** sponsored ads config (admin-controlled message intervals) */
  const [adCfg, setAdCfg] = useState({ firstAfter: 10, interval: 20 })
  const [chatAds, setChatAds] = useState<ServedAd[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const typingLast = useRef(0)
  const recorder = useRecorder()
  const desk = variant === 'desktop'
  const official = !!peer?.isOfficial

  /* safety state for this conversation (server flags + locally-tracked blocks) */
  const chatRow = useMemo(() => chats.find((c) => c.peer.id === peerId), [chats, peerId])
  const muted = !!chatRow?.muted
  const blockedByMe = !!chatRow?.blocked || !!blockedMap[peerId]
  const blockedByPeer = !!chatRow?.blockedMe
  const composerLocked = blockedByMe || blockedByPeer
  const [profileOpen, setProfileOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [pending, setPending] = useState<PendingAction>(null)
  const menuWrapRef = useRef<HTMLDivElement>(null)

  /* ---------- message actions: select / forward / unsend / delete-for-me ---------- */
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [actionMsg, setActionMsg] = useState<Message | null>(null)
  const [forwardOpen, setForwardOpen] = useState(false)
  const [forwardBusy, setForwardBusy] = useState(false)
  const selectedMsgs = useMemo(() => messages.filter((m) => selectedIds.includes(m.id)), [messages, selectedIds])
  const allSelectedMine = selectedMsgs.length > 0 && selectedMsgs.every((m) => m.mine && !m.deletedAt)
  const forwardableSelected = useMemo(() => selectedMsgs.filter((m) => m.type !== 'call' && !m.deletedAt), [selectedMsgs])

  const enterSelectMode = (msg: Message) => {
    setSelectMode(true)
    setSelectedIds([msg.id])
    setActionMsg(null)
  }
  const exitSelectMode = () => {
    setSelectMode(false)
    setSelectedIds([])
  }
  const toggleSelect = (id: string) => {
    setSelectedIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))
  }
  const onDeleteSelected = () => {
    const scope: 'everyone' | 'me' = allSelectedMine ? 'everyone' : 'me'
    void deleteMessages(peerId, selectedIds, scope).then(() => {
      toast.success(scope === 'everyone' ? 'Message unsent for everyone' : 'Deleted for you')
      exitSelectMode()
    })
  }
  const onCopySelected = () => {
    const m = selectedMsgs.find((x) => x.type === 'text')
    if (m) void navigator.clipboard?.writeText(m.content).then(() => toast.success('Message copied'))
  }
  const onForwardSend = async (targets: string[]) => {
    if (!targets.length || !forwardableSelected.length) return
    setForwardBusy(true)
    try {
      await forwardMessages(targets, forwardableSelected)
      toast.success(`Forwarded to ${targets.length} ${targets.length === 1 ? 'chat' : 'chats'}`)
      setForwardOpen(false)
      exitSelectMode()
    } finally {
      setForwardBusy(false)
    }
  }

  useEffect(() => {
    if (peer) {
      document.title = `${peer.name} · CALL`
    }
  }, [peer])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length, typing, recorder.status])

  const emitTyping = (isTyping: boolean) => {
    socketClient.emit('typing', { to: peerId, isTyping })
  }

  const onDraftChange = (v: string) => {
    setDraft(v)
    const now = Date.now()
    if (v && now - typingLast.current > 1200) {
      typingLast.current = now
      emitTyping(true)
    }
  }

  const send = async () => {
    const text = draft.trim()
    if (!text || sending || composerLocked) return
    setSending(true)
    try {
      emitTyping(false)
      setDraft('')
      setShowEmoji(false)
      await sendText(peerId, text)
    } catch (e) {
      setDraft(text)
      // surfaces server rejections too (e.g. 403 "You blocked this contact…")
      toast.error(e instanceof Error && e.message ? e.message : 'Message failed to send. Try again.')
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  const stopAndSend = async () => {
    const res = await recorder.stop()
    if (!res) return
    try {
      await sendVoice(peerId, res.blob, res.durationSec)
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : 'Voice message failed to upload. Try again.')
    }
  }

  /** archive/unarchive from the header menu — close the screen on success */
  const onMenuArchive = () => {
    setMenuOpen(false)
    const next = !chatRow?.archived
    void setChatArchived(peerId, next).then((ok) => {
      if (ok) closeChat()
    })
  }

  const groups = useMemo(() => {
    const byDay = new Map<string, Message[]>()
    for (const m of messages) {
      const key = new Date(m.createdAt).toDateString()
      const arr = byDay.get(key) ?? []
      arr.push(m)
      byDay.set(key, arr)
    }
    const entries = Array.from(byDay.entries())
    // ---- sponsored ad slots (admin-configured message intervals) ----
    // after the first N messages, then after every M further messages.
    // An ad slot number is attached to the local index of the message it
    // follows, so cards render inline without disturbing message state.
    let global = 0
    let slot = 0
    const slots = entries.map(([, msgs]) => {
      const map: Record<number, number> = {}
      for (let i = 0; i < msgs.length; i++) {
        global++
        const after = global
        if (after === adCfg.firstAfter || (after > adCfg.firstAfter && (after - adCfg.firstAfter) % adCfg.interval === 0)) {
          map[i] = slot++
        }
      }
      return map
    })
    return { entries, slots }
  }, [messages, adCfg])

  /* ---------- in-chat sponsored ads (rotation + admin intervals) ---------- */
  const slotCount = useMemo(() => {
    return groups.slots.reduce((n, map) => n + Object.keys(map).length, 0)
  }, [groups])
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

  if (!peer) return null

  return (
    <div
      className={`flex flex-col ${
        desk ? 'relative h-full min-w-0 flex-1 bg-cbg' : 'absolute inset-0 z-40 bg-cbg'
      }`}
    >
      {/* header — selection mode replaces it entirely */}
      {selectMode ? (
        <header
          className={`relative z-10 flex items-center gap-2 border-b border-cline bg-white/95 backdrop-blur-md ${
            desk ? 'px-4 py-2.5' : 'px-2 pb-2.5 pt-[max(env(safe-area-inset-top),10px)]'
          }`}
        >
          <button
            className="flex h-10 w-10 items-center justify-center rounded-full text-cink transition hover:bg-cbg"
            onClick={exitSelectMode}
            aria-label="Exit selection mode"
          >
            <X size={22} />
          </button>
          <span className="flex-1 text-[16px] font-bold text-cink">
            {selectedIds.length} selected
          </span>
          <button
            className="flex h-10 items-center rounded-full px-3 text-[13px] font-bold text-cbrand transition hover:bg-csoft"
            onClick={() => setSelectedIds(messages.filter((m) => !m.deletedAt).map((m) => m.id))}
          >
            Select all
          </button>
        </header>
      ) : (
      <header
        className={`relative z-10 flex items-center gap-2 border-b border-cline bg-white/95 backdrop-blur-md ${
          desk ? 'px-4 py-2.5' : 'px-2 pb-2.5 pt-[max(env(safe-area-inset-top),10px)]'
        }`}
      >
        <button
          className={`flex h-10 w-10 items-center justify-center rounded-full text-cink transition hover:bg-cbg ${
            desk ? 'hidden' : ''
          }`}
          onClick={closeChat}
          aria-label="Back to chats"
        >
          <ChevronLeft size={22} />
        </button>
        <button
          type="button"
          className="-mx-1 flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-1 py-1 text-left transition-colors hover:bg-cbg"
          onClick={() => setProfileOpen(true)}
          aria-label={`View ${peer.name}'s profile`}
        >
          {peer.isOfficial ? <OfficialAvatar size={42} /> : <Avatar name={peer.name} avatarKey={peer.avatarKey} size={42} online={online[peer.id]} src={peer.avatarUrl} />}
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <span className="truncate text-[16px] font-bold leading-5 text-cink">{peer.name}</span>
              <StaffTick role={peer.role} isOfficial={peer.isOfficial} />
            </span>
            <span className={`block text-xs font-semibold ${typing ? 'text-cgreen' : online[peer.id] ? 'text-cgreen' : 'text-cmut'}`}>
              {official ? 'Official account' : typing ? 'typing…' : lastSeenLabel(peer.lastSeen, online[peer.id])}
            </span>
          </span>
        </button>
        {official ? (
          <span className="mr-1 flex items-center gap-1.5 rounded-full bg-csoft px-3 py-1.5 text-[11px] font-bold text-cbrand">
            <ShieldCheck size={13} /> Official
          </span>
        ) : (
          <>
            <button
              className="flex h-10 w-10 items-center justify-center rounded-full text-cbrand transition hover:bg-csoft"
              aria-label="Video call"
              onClick={() => startCall(peer, 'video')}
            >
              <Video size={22} />
            </button>
            <button
              className="flex h-10 w-10 items-center justify-center rounded-full text-cbrand transition hover:bg-csoft"
              aria-label="Voice call"
              onClick={() => startCall(peer, 'voice')}
            >
              <Phone size={21} />
            </button>
          </>
        )}
        {/* three-dot chat menu — available for every conversation incl. official accounts */}
        <div className="relative flex-none" ref={menuWrapRef}>
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full text-cink transition hover:bg-cbg"
            aria-label="More options"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={(e) => {
              e.stopPropagation()
              setMenuOpen((o) => !o)
            }}
          >
            <MoreVertical size={20} />
          </button>
          <MenuShell open={menuOpen} onClose={() => setMenuOpen(false)} wrapRef={menuWrapRef}>
            <ChatMenuItem
              icon={<CircleUserRound size={17} />}
              label="View profile"
              onClick={() => {
                setMenuOpen(false)
                setProfileOpen(true)
              }}
            />
            <ChatMenuItem
              icon={muted ? <Bell size={17} /> : <BellOff size={17} />}
              label={muted ? 'Unmute notifications' : 'Mute notifications'}
              onClick={() => {
                setMenuOpen(false)
                void setChatMuted(peerId, !muted)
              }}
            />
            <ChatMenuItem
              icon={<ShieldBan size={17} />}
              label={chatRow?.restricted ? 'Unrestrict user' : 'Restrict user'}
              onClick={() => {
                setMenuOpen(false)
                if (chatRow?.restricted) void unrestrictUserAction(peerId, peer.name)
                else setPending('restrict')
              }}
            />
            <ChatMenuItem
              icon={<Ban size={17} />}
              label={blockedByMe ? `Unblock ${peer.name}` : 'Block user'}
              danger
              onClick={() => {
                setMenuOpen(false)
                if (blockedByMe) void unblockUserAction(peerId, peer.name)
                else setPending('block')
              }}
            />
            <ChatMenuItem
              icon={<Flag size={17} />}
              label="Report user"
              danger
              onClick={() => {
                setMenuOpen(false)
                setPending('report')
              }}
            />
            <MenuDivider />
            <ChatMenuItem
              icon={<Trash2 size={17} />}
              label="Delete chat"
              danger
              onClick={() => {
                setMenuOpen(false)
                setPending('delete')
              }}
            />
            <ChatMenuItem
              icon={chatRow?.archived ? <ArchiveRestore size={17} /> : <Archive size={17} />}
              label={chatRow?.archived ? 'Unarchive chat' : 'Archive chat'}
              onClick={onMenuArchive}
            />
          </MenuShell>
        </div>
      </header>
      )}

      {/* blocked / blocked-by-peer banners — pinned above the message canvas */}
      {blockedByMe && (
        <div className="flex items-center gap-3 border-b border-cline bg-[#FEF2F2] px-4 py-3">
          <Ban size={17} className="flex-none text-cred" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-[12.5px] font-semibold leading-5 text-cred">
            You blocked {peer.name} — unblock to send messages
          </p>
          <button
            type="button"
            className="flex-none rounded-full border border-cred/40 px-3.5 py-1.5 text-[12px] font-bold text-cred transition hover:bg-cred/10"
            onClick={() => void unblockUserAction(peer.id, peer.name)}
          >
            Unblock
          </button>
        </div>
      )}
      {!blockedByMe && blockedByPeer && (
        <div className="flex items-center gap-3 border-b border-cline bg-csoft px-4 py-3">
          <Ban size={17} className="flex-none text-cmut" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-[12.5px] font-semibold leading-5 text-cmut">You can&apos;t send messages to this contact</p>
        </div>
      )}

      {/* messages */}
      <div
        ref={scrollRef}
        className={`app-scroll flex-1 overflow-y-auto ${desk ? 'chat-canvas desk-scroll px-6 py-6 md:px-10' : 'px-4 pb-4 pt-4'}`}
      >
        {messages.length === 0 && (
          <div className="mt-10 flex flex-col items-center text-center">
            {peer.isOfficial ? <OfficialAvatar size={84} /> : <Avatar name={peer.name} avatarKey={peer.avatarKey} size={84} src={peer.avatarUrl} />}
            <p className="mt-4 flex items-center gap-1.5 text-lg font-bold text-cink">
              {peer.name}
              <StaffTick role={peer.role} isOfficial={peer.isOfficial} size={17} />
            </p>
            {official ? (
              <p className="mt-1 px-12 text-sm text-cmut">
                This is the official CALL account. Announcements from the CALL team arrive here — replies are not available.
              </p>
            ) : (
              <>
                <p className="mt-1 px-12 text-sm text-cmut">
                  Messages and calls are peer-to-peer. Start the conversation — it&apos;s free.
                </p>
                {!composerLocked && (
                  <div className="mt-5 flex flex-wrap justify-center gap-2">
                    {['Assalam-o-Alaikum!', 'Hey, free to talk?', 'Call me when free'].map((q) => (
                      <button
                        key={q}
                        className="rounded-full bg-white px-4 py-2 text-sm font-medium text-cbrand shadow-sm"
                        onClick={() => void sendText(peerId, q)}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {groups.entries.map(([day, msgs], gi) => (
          <div key={day}>
            <div className="my-3 flex justify-center">
              <span className="rounded-[12px] bg-[#E8ECF6] px-3 py-1 text-xs font-semibold text-cmut">
                {day === new Date().toDateString()
                  ? 'Today'
                  : new Date(day).toLocaleDateString([], { day: 'numeric', month: 'short' })}
              </span>
            </div>
            <div className="flex flex-col gap-2.5">
              {msgs.map((m, mi) => {
                const slot = groups.slots[gi]?.[mi]
                return (
                  <Fragment key={m.id}>
                    <MessageRow
                      msg={m}
                      peerName={peer.name}
                      selectMode={selectMode}
                      selected={selectedIds.includes(m.id)}
                      onToggleSelect={() => toggleSelect(m.id)}
                      onOpenActions={setActionMsg}
                    />
                    {slot !== undefined && chatAds[slot] && <SponsoredAdCard ad={chatAds[slot]} />}
                  </Fragment>
                )
              })}
            </div>
          </div>
        ))}

        {typing && (
          <div className="mt-2 flex justify-start">
            <div className="rounded-[20px] rounded-bl-md bg-white px-4 py-3 shadow-sm">
              <div className="flex items-center gap-1.5">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="blink-anim h-2 w-2 rounded-full bg-[#9AA8C7]"
                    style={{ animationDelay: `${i * 0.25}s` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* composer / recorder — hidden while selecting messages */}
      {!selectMode && (official ? (
        <div className={`border-t border-cline bg-white px-4 ${desk ? 'pb-3.5 pt-3' : 'pb-[max(env(safe-area-inset-bottom),16px)] pt-3'}`}>
          <div className="flex items-center justify-center gap-2 rounded-[16px] bg-cbg px-4 py-3 text-center">
            <ShieldCheck size={16} className="flex-none text-cbrand" />
            <span className="text-[12.5px] font-medium leading-5 text-cmut">
              You can&apos;t reply to {peer.name} — messages from the CALL team are one-way.
            </span>
          </div>
        </div>
      ) : recorder.status === 'recording' ? (
        <div className={`flex items-center gap-3 border-t border-cline bg-white px-4 ${desk ? 'h-[84px] py-4' : 'py-3.5 pb-[max(env(safe-area-inset-bottom),16px)]'}`}>
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
            onClick={() => void stopAndSend()}
          >
            <span className="ring-anim absolute inset-0 rounded-full border-2 border-cred" style={{ animationDuration: '1.8s', borderColor: '#F04438' }} />
            <Send size={21} />
          </button>
        </div>
      ) : (
        <div className={`border-t border-cline bg-white ${desk ? 'px-4 pb-3.5 pt-3' : 'px-4 pb-[max(env(safe-area-inset-bottom),14px)] pt-3'}`}>
          {showEmoji && (
            <div className="mb-2 flex flex-wrap gap-1.5 rounded-2xl bg-cbg p-3">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  className="h-9 w-9 rounded-lg text-xl hover:bg-white"
                  onClick={() => setDraft((d) => d + e)}
                >
                  {e}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2.5">
            <button
              className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-csoft text-cbrand disabled:opacity-50"
              aria-label="Emoji"
              disabled={composerLocked}
              onClick={() => setShowEmoji((s) => !s)}
            >
              <Smile size={21} />
            </button>
            <div className="flex h-12 flex-1 items-center rounded-[24px] bg-[#F0F3FA] px-4">
              <input
                ref={inputRef}
                className="w-full bg-transparent text-[15px] text-cink outline-none placeholder:text-[#7A8499] disabled:opacity-60"
                placeholder={blockedByMe ? 'You blocked this contact' : blockedByPeer ? "You can't message this contact" : 'Type a message'}
                disabled={composerLocked}
                value={draft}
                onChange={(e) => onDraftChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) void send()
                }}
                onBlur={() => emitTyping(false)}
              />
            </div>
            {draft.trim() ? (
              <button
                className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-brand-grad text-white shadow-[0_6px_16px_rgba(47,91,234,0.35)] disabled:opacity-60"
                aria-label="Send message"
                disabled={sending || composerLocked}
                onClick={() => void send()}
              >
                <Send size={21} />
              </button>
            ) : (
              <button
                className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-brand-grad text-white shadow-[0_6px_16px_rgba(47,91,234,0.35)] disabled:opacity-60"
                aria-label="Record voice message"
                disabled={composerLocked}
                onClick={() => void recorder.start()}
              >
                <Mic size={22} />
              </button>
            )}
          </div>
        </div>
      ))}

      {/* selection action toolbar — replaces the composer in select mode */}
      {selectMode && (
        <div
          className={`flex items-center gap-1.5 border-t border-cline bg-white px-3 ${
            desk ? 'py-3' : 'pt-3 pb-[max(env(safe-area-inset-bottom),14px)]'
          }`}
        >
          <button
            className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-brand-grad text-[13.5px] font-bold text-white shadow-[0_6px_16px_rgba(47,91,234,0.35)] disabled:opacity-40"
            disabled={!forwardableSelected.length}
            onClick={() => setForwardOpen(true)}
          >
            <Forward size={17} /> Forward
          </button>
          {selectedMsgs.length === 1 && selectedMsgs[0]?.type === 'text' && (
            <button
              className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-csoft text-[13.5px] font-bold text-cink transition hover:bg-cline disabled:opacity-40"
              onClick={onCopySelected}
            >
              <Copy size={16} /> Copy
            </button>
          )}
          <button
            className={`flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full text-[13.5px] font-bold disabled:opacity-40 ${
              allSelectedMine ? 'bg-[#FEF0EF] text-cred' : 'bg-csoft text-cink'
            }`}
            disabled={!selectedIds.length}
            onClick={onDeleteSelected}
          >
            <Trash2 size={16} /> {allSelectedMine ? 'Unsend' : 'Delete'}
          </button>
        </div>
      )}
      {profileOpen && <PeerProfileSheet peer={peer} desk={desk} onClose={() => setProfileOpen(false)} />}
      <ChatActionDialogs peer={peer} pending={pending} onClose={() => setPending(null)} />
      {actionMsg && (
        <MessageActionSheet
          msg={actionMsg}
          peerName={peer.name}
          onClose={() => setActionMsg(null)}
          onCopy={() => {
            void navigator.clipboard?.writeText(actionMsg.content).then(() => toast.success('Message copied'))
            setActionMsg(null)
          }}
          onForward={() => {
            setActionMsg(null)
            setSelectMode(true)
            setSelectedIds([actionMsg.id])
            setForwardOpen(true)
          }}
          onUnsend={() => {
            const id = actionMsg.id
            setActionMsg(null)
            void deleteMessages(peerId, [id], 'everyone').then(() => toast.success('Message unsent for everyone'))
          }}
          onDeleteForMe={() => {
            const id = actionMsg.id
            setActionMsg(null)
            void deleteMessages(peerId, [id], 'me').then(() => toast.success('Deleted for you'))
          }}
          onSelect={() => enterSelectMode(actionMsg)}
        />
      )}
      {forwardOpen && (
        <ForwardSheet
          busy={forwardBusy}
          count={forwardableSelected.length}
          onClose={() => setForwardOpen(false)}
          onSend={onForwardSend}
        />
      )}
    </div>
  )
}

function MessageRow({
  msg,
  peerName,
  selectMode,
  selected,
  onToggleSelect,
  onOpenActions,
}: {
  msg: Message
  peerName: string
  selectMode?: boolean
  selected?: boolean
  onToggleSelect?: () => void
  onOpenActions?: (m: Message) => void
}) {
  const mine = msg.mine
  const deleted = !!msg.deletedAt
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const suppressClick = useRef(false)

  /* long-press (touch) opens the per-message action sheet; desktop uses right-click */
  const armLongPress = () => {
    if (selectMode || deleted || !onOpenActions) return
    pressTimer.current = setTimeout(() => {
      suppressClick.current = true
      try {
        navigator.vibrate?.(12)
      } catch {}
      onOpenActions(msg)
    }, 480)
  }
  const disarmLongPress = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current)
      pressTimer.current = null
    }
  }
  const bubbleProps = {
    onTouchStart: armLongPress,
    onTouchEnd: disarmLongPress,
    onTouchMove: disarmLongPress,
    onContextMenu: (e: React.MouseEvent) => {
      if (selectMode || deleted || !onOpenActions) return
      e.preventDefault()
      onOpenActions(msg)
    },
    onClickCapture: (e: React.MouseEvent) => {
      // swallow the tap that fires right after a long-press opens the sheet
      if (suppressClick.current) {
        e.stopPropagation()
        e.preventDefault()
        suppressClick.current = false
      }
    },
  }
  const selectOverlay = selectMode ? (
    <button
      type="button"
      className="absolute inset-0 z-10 cursor-pointer rounded-[inherit] focus:outline-none"
      aria-label={selected ? 'Deselect message' : 'Select message'}
      onClick={onToggleSelect}
    />
  ) : null
  const ring = selected ? 'ring-2 ring-cbrand/70' : ''
  const forwardedChip = msg.forwarded ? (
    <div className="mb-0.5 flex items-center gap-1 text-[11px] font-semibold italic opacity-70">
      <Forward size={11} /> Forwarded
    </div>
  ) : null

  /* tombstone — "unsent" message */
  if (deleted) {
    return (
      <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
        <div
          className={`rounded-[20px] px-3.5 py-2 shadow-sm max-w-[272px] sm:max-w-[520px] ${ring} ${
            mine ? 'rounded-br-md bg-[#E8ECF6] text-cmut' : 'rounded-bl-md bg-white text-cmut'
          }`}
        >
          <p className="text-[13.5px] italic leading-5">{mine ? 'You unsent a message' : `${peerName} unsent a message`}</p>
          <div className="mt-1 flex items-center justify-end text-[11px] opacity-75">
            <span>{fmtTime(msg.createdAt)}</span>
          </div>
        </div>
      </div>
    )
  }

  if (msg.type === 'call') {
    let meta: { callType?: string; status?: string; durationSec?: number } = {}
    try {
      meta = JSON.parse(msg.content)
    } catch {}
    const video = meta.callType === 'video'
    const missed = meta.status !== 'answered'
    const Icon = missed ? PhoneMissed : mine ? PhoneOutgoing : PhoneIncoming
    const MissedIcon = missed ? PhoneMissed : null
    return (
      <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
        <div
          {...bubbleProps}
          className={`relative flex items-center gap-2.5 rounded-[20px] px-3.5 py-2.5 shadow-sm ${ring} ${
            mine ? 'rounded-br-md bg-brand-grad text-white' : 'rounded-bl-md bg-white text-cink'
          }`}
        >
          <span className={`flex h-9 w-9 items-center justify-center rounded-full ${mine ? 'bg-white/15 text-white' : 'bg-csoft text-cbrand'}`}>
            <Icon size={17} className={MissedIcon ? 'text-cred' : ''} />
          </span>
          <div>
            <div className="flex items-center gap-1 text-sm font-semibold">
              {video ? 'Video call' : 'Voice call'}
              {missed && <span className={mine ? 'text-[#FFD3CE]' : 'text-cred'}>· {meta.status === 'declined' ? 'Declined' : 'No answer'}</span>}
            </div>
            <div className="text-xs opacity-75">
              {meta.status === 'answered' ? fmtDuration(meta.durationSec ?? 0) : 'Tap to call again'} · {fmtTime(msg.createdAt)}
            </div>
          </div>
          {selectOverlay}
        </div>
      </div>
    )
  }

  if (msg.type === 'voice') {
    return (
      <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
        <div
          {...bubbleProps}
          className={`relative rounded-[20px] px-3 py-2 shadow-sm ${ring} ${
            mine ? 'rounded-br-md bg-brand-grad text-white shadow-[0_6px_16px_rgba(47,91,234,0.3)]' : 'rounded-bl-md bg-white text-cbrand'
          }`}
        >
          {forwardedChip}
          <VoiceBubble msg={msg} mine={mine} />
          <div className="mt-1 flex items-center justify-end gap-1.5 text-[11px] opacity-75">
            <span>{fmtTime(msg.createdAt)}</span>
            {mine && (msg.readAt ? <CheckCheck size={13} className="text-[#9FE8C1]" /> : msg.deliveredAt ? <CheckCheck size={13} className="text-white/60" /> : <Check size={13} />)}
          </div>
          {selectOverlay}
        </div>
      </div>
    )
  }

  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div
        {...bubbleProps}
        className={`relative rounded-[20px] px-3.5 py-2 shadow-sm sm:max-w-[520px] max-w-[272px] ${ring} ${
          mine
            ? 'rounded-br-md bg-brand-grad text-white shadow-[0_6px_16px_rgba(47,91,234,0.3)]'
            : 'rounded-bl-md bg-white text-cink'
        }`}
      >
        {forwardedChip}
        <p className="whitespace-pre-wrap break-words text-[15px] leading-[21px]">{msg.content}</p>
        <div className="mt-1 flex items-center justify-end gap-1.5 text-[11px] opacity-75">
          <span>{fmtTime(msg.createdAt)}</span>
          {mine && (msg.readAt ? <CheckCheck size={13} className="text-[#9FE8C1]" /> : msg.deliveredAt ? <CheckCheck size={13} className="text-white/60" /> : <Check size={13} />)}
        </div>
        {selectOverlay}
      </div>
    </div>
  )
}

/* ================= per-message action sheet (long-press / right-click) ================= */

function MessageActionSheet({
  msg,
  peerName,
  onClose,
  onCopy,
  onForward,
  onUnsend,
  onDeleteForMe,
  onSelect,
}: {
  msg: Message
  peerName: string
  onClose: () => void
  onCopy: () => void
  onForward: () => void
  onUnsend: () => void
  onDeleteForMe: () => void
  onSelect: () => void
}) {
  const deleted = !!msg.deletedAt
  const isText = msg.type === 'text'
  const forwardable = !deleted && msg.type !== 'call'
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center" role="dialog" aria-label="Message actions">
      <button className="absolute inset-0 bg-black/45" aria-label="Close actions" onClick={onClose} />
      <div
        className="relative w-full sm:max-w-sm sm:rounded-[24px] rounded-t-[24px] bg-white p-2 sm:mb-0 pb-[max(env(safe-area-inset-bottom),10px)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-1 mt-1 h-1 w-10 rounded-full bg-cline sm:hidden" />
        <div className="mb-1 px-3 py-1.5">
          <p className="truncate text-[12.5px] font-semibold text-cmut">
            {isText && !deleted ? msg.content.slice(0, 70) : deleted ? 'Unsent message' : msg.type === 'voice' ? 'Voice message' : 'Call log'}
          </p>
        </div>
        {isText && !deleted && (
          <SheetRow icon={<Copy size={18} />} label="Copy" onClick={onCopy} />
        )}
        {forwardable && <SheetRow icon={<Forward size={18} />} label="Forward" onClick={onForward} />}
        {msg.mine && !deleted && <SheetRow icon={<Undo2 size={18} />} label="Unsend for everyone" danger onClick={onUnsend} />}
        <SheetRow icon={<Trash2 size={18} />} label="Delete for me" danger onClick={onDeleteForMe} />
        {!deleted && <SheetRow icon={<CheckSquare size={18} />} label="Select messages" onClick={onSelect} />}
        <div className="my-1 h-px bg-cline" />
        <SheetRow icon={<X size={18} />} label="Cancel" onClick={onClose} />
      </div>
    </div>
  )
}

function SheetRow({ icon, label, danger, onClick }: { icon: React.ReactNode; label: string; danger?: boolean; onClick: () => void }) {
  return (
    <button
      className={`flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-left text-[14.5px] font-semibold transition hover:bg-cbg ${
        danger ? 'text-cred' : 'text-cink'
      }`}
      onClick={onClick}
    >
      <span className="flex-none">{icon}</span>
      <span className="min-w-0 flex-1">{label}</span>
    </button>
  )
}

/* ================= forward picker (Messenger-style) ================= */

function ForwardSheet({
  count,
  busy,
  onClose,
  onSend,
}: {
  count: number
  busy: boolean
  onClose: () => void
  onSend: (targets: string[]) => void
}) {
  const chats = useApp((s) => s.chats)
  const contacts = useApp((s) => s.contacts)
  const [q, setQ] = useState('')
  const [targets, setTargets] = useState<string[]>([])

  const people = useMemo(() => {
    const map = new Map<string, { id: string; name: string; avatarKey: number; avatarUrl: string | null }>()
    for (const c of chats) map.set(c.peer.id, { id: c.peer.id, name: c.peer.name, avatarKey: c.peer.avatarKey, avatarUrl: c.peer.avatarUrl })
    for (const c of contacts) {
      if (c.user && !map.has(c.user.id))
        map.set(c.user.id, { id: c.user.id, name: c.user.name, avatarKey: c.user.avatarKey, avatarUrl: c.user.avatarUrl ?? null })
    }
    const list = Array.from(map.values())
    const needle = q.trim().toLowerCase()
    return needle ? list.filter((p) => p.name.toLowerCase().includes(needle)) : list
  }, [chats, contacts, q])

  const toggle = (id: string) => setTargets((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))

  return (
    <div className="fixed inset-0 z-[75] flex items-end justify-center sm:items-center" role="dialog" aria-label="Forward messages">
      <button className="absolute inset-0 bg-black/45" aria-label="Close forward picker" onClick={onClose} />
      <div
        className="relative flex max-h-[80vh] w-full flex-col sm:max-w-md sm:rounded-[24px] rounded-t-[24px] bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-cline px-4 pb-3 pt-4">
          <span className="text-[16px] font-bold text-cink">Forward</span>
          <span className="rounded-full bg-csoft px-2 py-0.5 text-[11px] font-bold text-cbrand">{count}</span>
          <button className="ml-auto flex h-9 w-9 items-center justify-center rounded-full text-cink hover:bg-cbg" onClick={onClose} aria-label="Close">
            <X size={19} />
          </button>
        </div>
        <div className="px-4 pt-3">
          <div className="flex h-10 items-center gap-2 rounded-full bg-[#F0F3FA] px-3.5">
            <Search size={16} className="text-cmut" />
            <input
              className="w-full bg-transparent text-[14px] text-cink outline-none placeholder:text-[#7A8499]"
              placeholder="Search people"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>
        <div className="app-scroll min-h-[120px] flex-1 overflow-y-auto px-2 py-2">
          {people.length === 0 && <p className="px-3 py-6 text-center text-sm text-cmut">No people found</p>}
          {people.map((p) => {
            const on = targets.includes(p.id)
            return (
              <button
                key={p.id}
                className={`flex w-full items-center gap-3 rounded-2xl px-2.5 py-2 text-left transition ${on ? 'bg-csoft' : 'hover:bg-cbg'}`}
                onClick={() => toggle(p.id)}
              >
                <Avatar name={p.name} avatarKey={p.avatarKey} size={42} src={p.avatarUrl} />
                <span className="min-w-0 flex-1 truncate text-[14.5px] font-semibold text-cink">{p.name}</span>
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
        <div className="border-t border-cline px-4 py-3 pb-[max(env(safe-area-inset-bottom),12px)]">
          <button
            className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-brand-grad text-[15px] font-bold text-white shadow-[0_6px_16px_rgba(47,91,234,0.35)] disabled:opacity-40"
            disabled={busy || !targets.length}
            onClick={() => onSend(targets)}
          >
            <ClipboardCheck size={17} />
            {busy ? 'Forwarding…' : targets.length ? `Send to ${targets.length} ${targets.length === 1 ? 'chat' : 'chats'}` : 'Select chats'}
          </button>
        </div>
      </div>
    </div>
  )
}
