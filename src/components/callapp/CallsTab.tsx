'use client'

import { useMemo, useState } from 'react'
import { Avatar } from './Avatar'
import { Search, Phone, Video, PhoneIncoming, PhoneOutgoing, PhoneMissed, Users } from 'lucide-react'
import { useApp } from '@/lib/callapp/store'
import { callStatusText, fmtChatListTime } from '@/lib/callapp/utils'
import type { CallRecord } from '@/lib/callapp/types'

export function CallsTab({ variant = 'mobile' }: { variant?: 'mobile' | 'desktop' }) {
  const calls = useApp((s) => s.calls)
  const startCall = useApp((s) => s.startCall)
  const setTab = useApp((s) => s.setTab)
  const openChat = useApp((s) => s.openChat)
  const openConferenceComposer = useApp((s) => s.openConferenceComposer)
  const confMax = useApp((s) => s.conference.conf?.max ?? s.conference.maxParticipants)
  const [filter, setFilter] = useState<'all' | 'missed'>('all')
  const [query, setQuery] = useState('')
  const desk = variant === 'desktop'

  const list = useMemo(() => {
    let arr = calls
    if (filter === 'missed') arr = arr.filter((c) => c.missed)
    if (query.trim()) {
      const q = query.toLowerCase()
      arr = arr.filter((c) => c.peer.name.toLowerCase().includes(q) || c.peer.phone.includes(q))
    }
    return arr
  }, [calls, filter, query])

  const StatusIcon = (c: CallRecord) =>
    c.missed ? PhoneMissed : c.outgoing ? PhoneOutgoing : PhoneIncoming

  /* ---------- shared pieces ---------- */

  const headerNode = (
    <header
      className={`flex items-center gap-2.5 ${desk ? 'border-b border-cline px-5 pb-3 pt-5' : 'px-5 pt-[max(env(safe-area-inset-top),16px)]'}`}
    >
      <h1 className={`flex-1 font-extrabold tracking-tight text-cink ${desk ? 'text-[26px]' : 'text-[30px]'}`}>
        Calls
      </h1>
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
        placeholder="Search calls"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search calls"
      />
    </div>
  )

  const segmentNode = (
    <div className={`mt-4 flex rounded-[14px] bg-[#F0F3FA] p-1 text-center text-sm font-semibold ${desk ? 'mx-4' : 'mx-5'}`}>
      <button
        className={`flex-1 rounded-[11px] py-2.5 transition-all ${
          filter === 'all' ? 'bg-white text-cink shadow-[0_2px_6px_rgba(14,23,38,0.08)]' : 'text-cmut'
        }`}
        onClick={() => setFilter('all')}
      >
        All
      </button>
      <button
        className={`flex-1 rounded-[11px] py-2.5 transition-all ${
          filter === 'missed' ? 'bg-white text-cred shadow-[0_2px_6px_rgba(14,23,38,0.08)]' : 'text-cmut'
        }`}
        onClick={() => setFilter('missed')}
      >
        Missed
      </button>
    </div>
  )

  const listNode = (
    <>
      {list.length === 0 ? (
        <div className="flex flex-col items-center px-6 py-16 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-csoft text-cbrand">
            <Phone size={32} />
          </div>
          <p className="mt-5 text-lg font-bold text-cink">No {filter === 'missed' ? 'missed ' : ''}calls yet</p>
          <p className="mt-1 text-sm text-cmut">
            Every voice and video call on CALL is free and unlimited — dial away.
          </p>
        </div>
      ) : (
        list.map((c) => {
          const Icon = StatusIcon(c)
          const isVideo = c.type === 'video'
          return (
            <div key={c.id} className={`flex items-center gap-3.5 py-3 transition-colors hover:bg-cbg ${desk ? 'px-5' : 'px-5'}`}>
              <Avatar name={c.peer.name} avatarKey={c.peer.avatarKey} size={desk ? 46 : 52} src={c.peer.avatarUrl} />
              <button
                className="min-w-0 flex-1 text-left"
                onClick={() => openChat(c.peer.id)}
                aria-label={`Open chat with ${c.peer.name}`}
              >
                <div className={`text-[16px] font-bold ${c.missed ? 'text-cred' : 'text-cink'}`}>{c.peer.name}</div>
                <div className={`mt-0.5 flex items-center gap-1.5 text-sm ${c.missed ? 'text-cred' : 'text-[#4A5568]'}`}>
                  <Icon size={15} className="flex-none" />
                  <span className="truncate">
                    {isVideo ? 'Video' : 'Voice'} · {callStatusText(c)} · {fmtChatListTime(c.startedAt)}
                  </span>
                </div>
              </button>
              <button
                className="flex h-11 w-11 flex-none items-center justify-center rounded-full text-cbrand hover:bg-csoft"
                aria-label={`Voice call ${c.peer.name}`}
                onClick={() => startCall(c.peer, 'voice')}
              >
                <Phone size={22} />
              </button>
              <button
                className="flex h-11 w-11 flex-none items-center justify-center rounded-full text-cbrand hover:bg-csoft"
                aria-label={`Video call ${c.peer.name}`}
                onClick={() => startCall(c.peer, 'video')}
              >
                <Video size={23} />
              </button>
            </div>
          )
        })
      )}
    </>
  )

  const newCallRow = (
    <button
      className={`flex w-full items-center gap-3.5 text-left transition-colors hover:bg-cbg ${desk ? 'px-5' : 'px-5'} py-3`}
      onClick={() => setTab('contacts')}
    >
      <span className="flex h-[52px] w-[52px] flex-none items-center justify-center rounded-full bg-cbrand text-white">
        <Users size={24} />
      </span>
      <div>
        <div className="text-[16px] font-bold text-cink">Start a new call</div>
        <div className="mt-0.5 text-sm text-[#4A5568]">Pick someone from your contacts</div>
      </div>
    </button>
  )

  /* group conference entry — opens the invite sheet (AppRoot renders it for
     both mobile and desktop); the participant cap is server-enforced */
  const conferenceRow = (
    <div className={`flex items-stretch gap-3 pt-1 ${desk ? 'px-5' : 'px-5'} pb-1`}>
      <button
        className="flex min-w-0 flex-1 items-center gap-3 rounded-[18px] bg-csoft p-3.5 text-left transition-transform active:scale-[0.98]"
        onClick={() => openConferenceComposer('voice')}
        aria-label="Start a group voice call"
      >
        <span className="flex h-[44px] w-[44px] flex-none items-center justify-center rounded-full bg-cbrand text-white">
          <Phone size={20} />
        </span>
        <div className="min-w-0">
          <div className="text-[14.5px] font-bold text-cink">Group voice call</div>
          <div className="mt-0.5 text-[12px] text-[#4A5568]">Up to {confMax} people</div>
        </div>
      </button>
      <button
        className="flex min-w-0 flex-1 items-center gap-3 rounded-[18px] bg-csoft p-3.5 text-left transition-transform active:scale-[0.98]"
        onClick={() => openConferenceComposer('video')}
        aria-label="Start a group video call"
      >
        <span className="flex h-[44px] w-[44px] flex-none items-center justify-center rounded-full bg-gradient-to-r from-cbrand to-[#7B3FE4] text-white">
          <Video size={20} />
        </span>
        <div className="min-w-0">
          <div className="text-[14.5px] font-bold text-cink">Group video call</div>
          <div className="mt-0.5 text-[12px] text-[#4A5568]">Up to {confMax} people</div>
        </div>
      </button>
    </div>
  )

  if (desk) {
    /* desktop: pinned header + single list scroller */
    return (
      <div className="flex h-full flex-col">
        {headerNode}
        {searchNode}
        {segmentNode}
        <div className="app-scroll desk-scroll mt-3 flex-1 overflow-y-auto pb-4">
          {newCallRow}
          {conferenceRow}
          {listNode}
        </div>
      </div>
    )
  }

  /* mobile: ONE full-page scroller — header, search, filter and list all scroll together */
  return (
    <div className="app-scroll flex h-full flex-col overflow-y-auto pb-[calc(84px+max(env(safe-area-inset-bottom),12px))]">
      {headerNode}
      {searchNode}
      {segmentNode}
      <div className="mt-3">
        {newCallRow}
        {conferenceRow}
        {listNode}
      </div>
    </div>
  )
}
