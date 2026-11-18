'use client'

import { useMemo, useState } from 'react'
import { Avatar } from './Avatar'
import { Search, Plus, Mic, Video, Phone, Check, CheckCheck, MessageSquare, Camera } from 'lucide-react'
import { useApp } from '@/lib/callapp/store'
import { fmtChatListTime, fmtDuration } from '@/lib/callapp/utils'
import type { ChatSummary } from '@/lib/callapp/types'

export function ChatsTab({ variant = 'mobile' }: { variant?: 'mobile' | 'desktop' }) {
  const chats = useApp((s) => s.chats)
  const me = useApp((s) => s.me)
  const online = useApp((s) => s.online)
  const openChat = useApp((s) => s.openChat)
  const openPeerId = useApp((s) => s.openPeerId)
  const setTab = useApp((s) => s.setTab)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const desk = variant === 'desktop'

  const list = useMemo(() => {
    let arr = [...chats].sort((a, b) => +new Date(b.lastActivity) - +new Date(a.lastActivity))
    if (filter === 'unread') arr = arr.filter((c) => c.unread > 0)
    if (query.trim()) {
      const q = query.toLowerCase()
      arr = arr.filter((c) => c.peer.name.toLowerCase().includes(q))
    }
    return arr
  }, [chats, filter, query])

  const previewOf = (c: ChatSummary) => {
    const lm = c.lastMessage
    if (!lm) return 'Say salam — start the conversation'
    if (lm.type === 'text') return (lm.mine ? 'You: ' : '') + lm.content
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

  return (
    <div className="flex h-full flex-col">
      <header
        className={`flex items-center gap-2.5 ${desk ? 'border-b border-cline px-5 pb-3 pt-5' : 'px-6 pt-14'}`}
      >
        <h1 className={`flex-1 font-extrabold tracking-tight text-cink ${desk ? 'text-[26px]' : 'text-[32px]'}`}>
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

      <div
        className={`flex h-[46px] items-center gap-2.5 rounded-[14px] bg-[#F0F3FA] px-3.5 text-[#7A8499] ${
          desk ? 'mx-4 mt-4' : 'mx-6 mt-4'
        }`}
      >
        <Search size={19} />
        <input
          className="w-full bg-transparent text-[15px] text-cink outline-none placeholder:text-[#7A8499]"
          placeholder="Search chats"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className={`flex gap-2 pb-2 pt-3 ${desk ? 'px-4' : 'px-6'}`}>
        <button
          className={`rounded-[20px] px-4 py-2 text-[13px] font-semibold transition-colors ${
            filter === 'all' ? 'bg-cbrand text-white' : 'bg-[#F0F3FA] text-[#4A5568]'
          }`}
          onClick={() => setFilter('all')}
        >
          All
        </button>
        <button
          className={`rounded-[20px] px-4 py-2 text-[13px] font-semibold transition-colors ${
            filter === 'unread' ? 'bg-cbrand text-white' : 'bg-[#F0F3FA] text-[#4A5568]'
          }`}
          onClick={() => setFilter('unread')}
        >
          Unread
        </button>
      </div>

      <div className={`app-scroll flex-1 overflow-y-auto ${desk ? 'desk-scroll pb-4' : 'pb-[96px]'}`}>
        {list.length === 0 ? (
          <div className="flex flex-col items-center pt-24 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-csoft text-cbrand">
              <MessageBig />
            </div>
            <p className="mt-5 text-lg font-bold text-cink">No chats yet</p>
            <p className="mt-1 px-10 text-sm text-cmut">
              Add your contacts and start talking — calls and messages are always free.
            </p>
            <button className="mt-5 rounded-full bg-brand-grad px-6 py-3 text-sm font-semibold text-white" onClick={() => setTab('contacts')}>
              Find people
            </button>
          </div>
        ) : (
          list.map((c) => (
            <button
              key={c.conversationId}
              className={`flex w-full items-center gap-3.5 text-left transition-colors ${
                desk ? 'mx-2 rounded-xl px-3 py-2.5' : 'px-6 py-3'
              } ${
                openPeerId === c.peer.id
                  ? desk
                    ? 'bg-[#E7EEFF]'
                    : 'bg-cbg'
                  : 'hover:bg-cbg'
              }`}
              onClick={() => openChat(c.peer.id)}
            >
              <Avatar name={c.peer.name} avatarKey={c.peer.avatarKey} size={desk ? 48 : 56} online={online[c.peer.id]} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-[16px] font-bold text-cink">
                  <span className="truncate">{c.peer.name}</span>
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 text-sm text-[#4A5568]">
                  <PreviewIcon chat={c} />
                  <span className="truncate">{previewOf(c)}</span>
                </div>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-xs text-cmut">{fmtChatListTime(c.lastActivity)}</span>
                {c.unread > 0 && (
                  <span className="mt-1.5 flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-cbrand px-1.5 text-xs font-bold text-white">
                    {c.unread}
                  </span>
                )}
              </div>
            </button>
          ))
        )}
      </div>
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
    return lm.readAt ? (
      <CheckCheck size={15} className="flex-none text-cbrand" />
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
