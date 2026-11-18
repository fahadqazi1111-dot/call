'use client'

import { useEffect, useState } from 'react'
import { Clapperboard, Plus, Eye, Users, Loader2, Radio } from 'lucide-react'
import { api } from '@/lib/callapp/api'
import { useApp } from '@/lib/callapp/store'
import { Avatar } from './Avatar'
import { AdBanner } from './GiftsUI'
import { LiveHostScreen } from './LiveHostScreen'
import { LiveViewerScreen } from './LiveViewerScreen'
import type { LiveSessionItem } from '@/lib/callapp/types'

/** TikTok-style Video Live tab: session list + go live + viewer. */
export function LiveTab({ variant = 'mobile' }: { variant?: 'mobile' | 'desktop' }) {
  const me = useApp((s) => s.me)
  const [sessions, setSessions] = useState<LiveSessionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [hosting, setHosting] = useState<{ id: string; title: string; mode: string } | null>(null)
  const [watching, setWatching] = useState<LiveSessionItem | null>(null)
  const desk = variant === 'desktop'

  const load = async () => {
    try {
      const res = await api.liveSessions()
      setSessions(res.sessions)
    } catch {}
    setLoading(false)
  }

  useEffect(() => {
    queueMicrotask(() => void load())
    const t = window.setInterval(() => void load(), 15_000)
    return () => window.clearInterval(t)
  }, [])

  if (hosting) {
    return (
      <LiveHostScreen
        liveId={hosting.id}
        title={hosting.title}
        mode={hosting.mode}
        onClose={() => {
          setHosting(null)
          void load()
        }}
      />
    )
  }
  if (watching) {
    return (
      <LiveViewerScreen
        session={watching}
        onClose={() => {
          setWatching(null)
          void load()
        }}
      />
    )
  }

  return (
    <div className="flex h-full flex-col">
      <header className={`flex items-center gap-2.5 ${desk ? 'border-b border-cline px-5 pb-3 pt-5' : 'px-6 pt-14'}`}>
        <h1 className={`flex-1 font-extrabold tracking-tight text-cink ${desk ? 'text-[26px]' : 'text-[32px]'}`}>Video Live</h1>
        <button
          className="flex h-11 items-center gap-1.5 rounded-full bg-gradient-to-r from-[#E1306C] to-[#7B3FE4] px-4 text-[13px] font-bold text-white"
          onClick={() => setShowCreate(true)}
        >
          <Plus size={16} /> Go live
        </button>
      </header>

      <div className={`app-scroll flex-1 overflow-y-auto ${desk ? 'desk-scroll' : 'pb-[96px]'}`}>
        <AdBanner placement="rooms" />
        {loading ? (
          <div className="flex justify-center pt-16">
            <Loader2 className="animate-spin text-cbrand" size={26} />
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center pt-20 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-csoft text-[#E1306C]">
              <Clapperboard size={34} />
            </div>
            <p className="mt-5 text-lg font-bold text-cink">No one is live</p>
            <p className="mt-1 px-10 text-sm text-cmut">
              Start a broadcast, invite friends to a 1v1 or 2v2 battle, and let viewers send gifts.
            </p>
            <button
              className="mt-5 rounded-full bg-gradient-to-r from-[#E1306C] to-[#7B3FE4] px-6 py-3 text-sm font-semibold text-white"
              onClick={() => setShowCreate(true)}
            >
              Go live now
            </button>
          </div>
        ) : (
          <div className={`grid gap-3 ${desk ? 'grid-cols-1 px-4 pt-3' : 'grid-cols-2 px-5 pt-2'}`}>
            {sessions.map((s) => (
              <button
                key={s.id}
                className="group relative overflow-hidden rounded-[18px] border border-cline bg-gradient-to-br from-[#1a1d2b] to-[#101219] p-4 text-left text-white transition hover:shadow-lg"
                onClick={() => setWatching(s)}
              >
                <div className="flex items-center justify-between pb-3">
                  <span className="rounded-full bg-red-500 px-2.5 py-1 text-[10px] font-bold">● LIVE</span>
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-white/70">
                    <Eye size={13} /> {s.viewerCount}
                  </span>
                </div>
                <Avatar name={s.host.name} avatarKey={s.host.avatarKey} size={52} src={s.host.avatarUrl} />
                <p className="mt-2.5 truncate text-[15px] font-bold">{s.title}</p>
                <p className="truncate text-[12px] text-white/60">{s.host.name}</p>
                <div className="mt-2 flex items-center gap-2">
                  {s.mode === 'battle' && (
                    <span className="rounded-full bg-[#FFD166]/20 px-2 py-0.5 text-[10px] font-bold text-[#FFD166]">⚔️ Battle</span>
                  )}
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/70">
                    {s.mode === 'battle' ? 'Teams live' : 'Solo live'}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {showCreate && me && (
        <GoLiveSheet
          onClose={() => setShowCreate(false)}
          onStart={async (title, mode) => {
            const res = await api.createLive(title, mode)
            setShowCreate(false)
            setHosting({ id: res.session.id, title, mode: res.session.mode })
          }}
        />
      )}
    </div>
  )
}

function GoLiveSheet({ onClose, onStart }: { onClose: () => void; onStart: (title: string, mode: string) => Promise<void> }) {
  const [title, setTitle] = useState('')
  const [mode, setMode] = useState<'solo' | 'battle'>('solo')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const start = async () => {
    setBusy(true)
    setError('')
    try {
      await onStart(title.trim() || 'Live', mode)
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className="absolute inset-0 z-50 flex flex-col justify-end bg-black/50" onClick={onClose}>
      <div className="rounded-t-[24px] border-t border-cline bg-white p-5 pb-10" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Go live">
        <h3 className="flex items-center gap-2 text-lg font-extrabold text-cink">
          <Radio size={20} className="text-[#E1306C]" /> Start a live broadcast
        </h3>
        <input
          className="mt-4 h-12 w-full rounded-[14px] bg-[#F0F3FA] px-4 text-[15px] outline-none placeholder:text-[#7A8499]"
          placeholder="Live title (e.g. Tonight's chill room)"
          value={title}
          maxLength={60}
          onChange={(e) => setTitle(e.target.value)}
        />
        <div className="mt-4 flex gap-2">
          <button
            className={`flex-1 rounded-[14px] py-3 text-sm font-bold transition ${mode === 'solo' ? 'bg-[#E1306C] text-white' : 'bg-[#F0F3FA] text-[#4A5568]'}`}
            onClick={() => setMode('solo')}
          >
            🎥 Solo live
          </button>
          <button
            className={`flex-1 rounded-[14px] py-3 text-sm font-bold transition ${mode === 'battle' ? 'bg-[#7B3FE4] text-white' : 'bg-[#F0F3FA] text-[#4A5568]'}`}
            onClick={() => setMode('battle')}
          >
            ⚔️ Battle live (1v1/2v2)
          </button>
        </div>
        <p className="mt-2 text-[11px] text-cmut">
          {mode === 'solo'
            ? 'You broadcast, viewers watch and send gifts.'
            : 'Invite 1 friend (1v1) or 3 friends (2v2) after going live. Viewers gift to score sides.'}
        </p>
        {error && <p className="mt-3 text-[13px] font-semibold text-cred">{error}</p>}
        <button
          className="mt-5 h-[52px] w-full rounded-[16px] bg-gradient-to-r from-[#E1306C] to-[#7B3FE4] text-[15px] font-bold text-white disabled:opacity-40"
          disabled={busy}
          onClick={() => void start()}
        >
          {busy ? <Loader2 className="mx-auto animate-spin" size={20} /> : 'Go live'}
        </button>
        <p className="mt-3 flex items-center justify-center gap-1 text-[11px] text-cmut">
          <Users size={12} /> Viewers watch in real time — camera & mic permission required
        </p>
      </div>
    </div>
  )
}
