'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Avatar, OfficialAvatar } from './Avatar'
import { VoiceBubble } from './VoiceBubble'
import { useRecorder } from './useRecorder'
import { useApp } from '@/lib/callapp/store'
import { socketClient } from '@/lib/callapp/socket'
import { fmtDuration, fmtTime, lastSeenLabel } from '@/lib/callapp/utils'
import { StaffTick } from './StaffTick'
import { ChevronLeft, Mic, Phone, Plus, Send, Smile, Square, Trash2, Video, Check, CheckCheck, PhoneIncoming, PhoneOutgoing, PhoneMissed, ShieldCheck } from 'lucide-react'
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

  /** Resolve the peer from existing chats, falling back to contacts (fresh conversation). */
  const peer = useMemo(() => {
    const fromChat = chats.find((c) => c.peer.id === peerId)?.peer
    if (fromChat) return fromChat
    const fromContact = contacts.find((c) => c.user?.id === peerId)?.user
    if (fromContact)
      return {
        id: fromContact.id,
        name: fromContact.name,
        avatarKey: fromContact.avatarKey,
        avatarUrl: fromContact.avatarUrl,
        lastSeen: fromContact.lastSeen,
      }
    return undefined
  }, [chats, contacts, peerId])
  const [draft, setDraft] = useState('')
  const [showEmoji, setShowEmoji] = useState(false)
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const typingLast = useRef(0)
  const recorder = useRecorder()
  const desk = variant === 'desktop'
  const official = !!peer?.isOfficial

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
    if (!text || sending) return
    setSending(true)
    try {
      emitTyping(false)
      setDraft('')
      setShowEmoji(false)
      await sendText(peerId, text)
    } catch {
      setDraft(text)
      alert('Message failed to send. Try again.')
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
    } catch {
      alert('Voice message failed to upload. Try again.')
    }
  }

  const groups = useMemo(() => {
    const byDay = new Map<string, Message[]>()
    for (const m of messages) {
      const key = new Date(m.createdAt).toDateString()
      const arr = byDay.get(key) ?? []
      arr.push(m)
      byDay.set(key, arr)
    }
    return Array.from(byDay.entries())
  }, [messages])

  if (!peer) return null

  return (
    <div
      className={`flex flex-col ${
        desk ? 'relative h-full min-w-0 flex-1 bg-cbg' : 'absolute inset-0 z-40 bg-cbg'
      }`}
    >
      {/* header */}
      <header
        className={`relative z-10 flex items-center gap-2 border-b border-cline bg-white/95 backdrop-blur-md ${
          desk ? 'px-4 py-2.5' : 'px-2 pb-3 pt-12'
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
        {peer.isOfficial ? <OfficialAvatar size={42} /> : <Avatar name={peer.name} avatarKey={peer.avatarKey} size={42} online={online[peer.id]} src={peer.avatarUrl} />}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[16px] font-bold leading-5 text-cink">{peer.name}</span>
            <StaffTick role={peer.role} isOfficial={peer.isOfficial} />
          </div>
          <div className={`text-xs font-semibold ${typing ? 'text-cgreen' : online[peer.id] ? 'text-cgreen' : 'text-cmut'}`}>
            {official ? 'Official account' : typing ? 'typing…' : lastSeenLabel(peer.lastSeen, online[peer.id])}
          </div>
        </div>
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
      </header>

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
              </>
            )}
          </div>
        )}

        {groups.map(([day, msgs]) => (
          <div key={day}>
            <div className="my-3 flex justify-center">
              <span className="rounded-[12px] bg-[#E8ECF6] px-3 py-1 text-xs font-semibold text-cmut">
                {day === new Date().toDateString()
                  ? 'Today'
                  : new Date(day).toLocaleDateString([], { day: 'numeric', month: 'short' })}
              </span>
            </div>
            <div className="flex flex-col gap-2.5">
              {msgs.map((m) => (
                <MessageRow key={m.id} msg={m} peerName={peer.name} />
              ))}
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

      {/* composer / recorder */}
      {official ? (
        <div className={`border-t border-cline bg-white px-4 ${desk ? 'pb-3.5 pt-3' : 'pb-[92px] pt-3'}`}>
          <div className="flex items-center justify-center gap-2 rounded-[16px] bg-cbg px-4 py-3 text-center">
            <ShieldCheck size={16} className="flex-none text-cbrand" />
            <span className="text-[12.5px] font-medium leading-5 text-cmut">
              You can&apos;t reply to {peer.name} — messages from the CALL team are one-way.
            </span>
          </div>
        </div>
      ) : recorder.status === 'recording' ? (
        <div className={`flex items-center gap-3 border-t border-cline bg-white px-4 ${desk ? 'h-[84px] py-4' : 'h-[92px] pb-4'}`}>
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
        <div className={`border-t border-cline bg-white ${desk ? 'px-4 pb-3.5 pt-3' : 'px-4 pb-[92px] pt-3'}`}>
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
              className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-csoft text-cbrand"
              aria-label="Emoji"
              onClick={() => setShowEmoji((s) => !s)}
            >
              <Smile size={21} />
            </button>
            <div className="flex h-12 flex-1 items-center rounded-[24px] bg-[#F0F3FA] px-4">
              <input
                ref={inputRef}
                className="w-full bg-transparent text-[15px] text-cink outline-none placeholder:text-[#7A8499]"
                placeholder="Type a message"
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
                disabled={sending}
                onClick={() => void send()}
              >
                <Send size={21} />
              </button>
            ) : (
              <button
                className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-brand-grad text-white shadow-[0_6px_16px_rgba(47,91,234,0.35)]"
                aria-label="Record voice message"
                onClick={() => void recorder.start()}
              >
                <Mic size={22} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function MessageRow({ msg, peerName }: { msg: Message; peerName: string }) {
  const mine = msg.mine
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
          className={`flex items-center gap-2.5 rounded-[20px] px-3.5 py-2.5 shadow-sm ${
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
        </div>
      </div>
    )
  }

  if (msg.type === 'voice') {
    return (
      <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
        <div
          className={`rounded-[20px] px-3 py-2 shadow-sm ${
            mine ? 'rounded-br-md bg-brand-grad text-white shadow-[0_6px_16px_rgba(47,91,234,0.3)]' : 'rounded-bl-md bg-white text-cbrand'
          }`}
        >
          <VoiceBubble msg={msg} mine={mine} />
          <div className="mt-1 flex items-center justify-end gap-1.5 text-[11px] opacity-75">
            <span>{fmtTime(msg.createdAt)}</span>
            {mine && (msg.readAt ? <CheckCheck size={13} className="text-[#9FE8C1]" /> : <Check size={13} />)}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`rounded-[20px] px-3.5 py-2 shadow-sm sm:max-w-[520px] max-w-[272px] ${
          mine
            ? 'rounded-br-md bg-brand-grad text-white shadow-[0_6px_16px_rgba(47,91,234,0.3)]'
            : 'rounded-bl-md bg-white text-cink'
        }`}
      >
        <p className="whitespace-pre-wrap break-words text-[15px] leading-[21px]">{msg.content}</p>
        <div className="mt-1 flex items-center justify-end gap-1.5 text-[11px] opacity-75">
          <span>{fmtTime(msg.createdAt)}</span>
          {mine && (msg.readAt ? <CheckCheck size={13} className="text-[#9FE8C1]" /> : <Check size={13} />)}
        </div>
      </div>
    </div>
  )
}
