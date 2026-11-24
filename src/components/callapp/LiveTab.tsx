'use client'

import { useEffect, useRef, useState } from 'react'
import { Clapperboard, Plus, Eye, Users, Loader2, Radio, ChevronUp, Swords } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/callapp/api'
import { useApp } from '@/lib/callapp/store'
import { liveManager } from '@/lib/callapp/liveManager'
import { describeLiveMediaError, type PreflightErrorKind } from '@/lib/callapp/ice'
import { Avatar } from './Avatar'
import { AdBanner } from './GiftsUI'
import { LiveHostScreen } from './LiveHostScreen'
import { LiveViewerScreen } from './LiveViewerScreen'
import type { LiveSessionItem } from '@/lib/callapp/types'

/** Video Live tab: TikTok-style reels feed (mobile) + grid list (desktop). */
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
        key={watching.id}
        session={watching}
        onClose={() => {
          setWatching(null)
          void load()
        }}
      />
    )
  }

  /* ---------- mobile: TikTok-style reels feed ---------- */
  if (!desk) {
    return (
      <div className="relative h-full bg-black">
        {loading ? (
          <div className="flex h-full justify-center pt-24">
            <Loader2 className="animate-spin text-white/40" size={26} />
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center bg-white px-8 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-csoft text-[#E1306C]">
              <Clapperboard size={34} />
            </div>
            <p className="mt-5 text-lg font-bold text-cink">No one is live</p>
            <p className="mt-1 text-sm text-cmut">
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
          <>
            {/* slim floating header over the feed */}
            <div className="absolute inset-x-0 top-0 z-40 flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),12px)]">
              <span className="rounded-full bg-black/45 px-3 py-1.5 text-[11px] font-bold text-white backdrop-blur">
                {sessions.length} live now
              </span>
              <button
                className="flex h-9 items-center gap-1.5 rounded-full bg-gradient-to-r from-[#E1306C] to-[#7B3FE4] px-3.5 text-[12px] font-bold text-white shadow-lg"
                onClick={() => setShowCreate(true)}
              >
                <Plus size={14} /> Go live
              </button>
            </div>
            <LiveReels
              meId={me?.id ?? ''}
              sessions={sessions}
              onManageMine={(s) => setHosting({ id: s.id, title: s.title, mode: s.mode })}
              onEnded={() => void load()}
            />
          </>
        )}
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

  /* ---------- desktop / tablet: classic list + full viewer ---------- */
  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2.5 border-b border-cline px-5 pb-3 pt-5">
        <h1 className="flex-1 font-extrabold tracking-tight text-cink text-[26px]">Video Live</h1>
        <button
          className="flex h-11 items-center gap-1.5 rounded-full bg-gradient-to-r from-[#E1306C] to-[#7B3FE4] px-4 text-[13px] font-bold text-white"
          onClick={() => setShowCreate(true)}
        >
          <Plus size={16} /> Go live
        </button>
      </header>

      <div className="app-scroll desk-scroll flex-1 overflow-y-auto">
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
          <div className="grid grid-cols-1 gap-3 px-4 pt-3">
            {sessions.map((s) => {
              const isMine = s.isMine || s.host.id === me?.id
              return (
                <button
                  key={s.id}
                  className="group relative overflow-hidden rounded-[18px] border border-cline bg-gradient-to-br from-[#1a1d2b] to-[#101219] p-4 text-left text-white transition hover:shadow-lg"
                  onClick={() => {
                    // my own stream → resume the HOST screen (never the viewer)
                    if (isMine) {
                      setHosting({ id: s.id, title: s.title, mode: s.mode })
                    } else {
                      setWatching(s)
                    }
                  }}
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
                      {isMine ? 'Your broadcast · tap to manage' : s.mode === 'battle' ? 'Teams live' : 'Solo live'}
                    </span>
                  </div>
                </button>
              )
            })}
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

/* ================= mobile reels feed ================= */

/**
 * TikTok-style vertical snap feed of every ongoing live. Only the section
 * snapped into view mounts the real viewer (joins the WebRTC mesh) — swiping
 * down/up moves you to the next live exactly like TikTok reels.
 */
function LiveReels({
  sessions,
  meId,
  onManageMine,
  onEnded,
}: {
  sessions: LiveSessionItem[]
  meId: string
  onManageMine: (s: LiveSessionItem) => void
  onEnded: () => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [snappedId, setSnappedId] = useState<string | null>(sessions[0]?.id ?? null)
  /* derived, always-valid active id — no effect needed to repair it */
  const activeId = snappedId && sessions.some((s) => s.id === snappedId) ? snappedId : (sessions[0]?.id ?? null)

  /* which section is snapped into view — scroll-position based (sections are
   * exactly viewport-height, so round(scrollTop/height) is the active index) */
  const onScroll = () => {
    const root = scrollRef.current
    if (!root) return
    const h = root.clientHeight || 1
    const idx = Math.min(sessions.length - 1, Math.max(0, Math.round(root.scrollTop / h)))
    const id = root.querySelectorAll('[data-live-id]')[idx]?.getAttribute('data-live-id') ?? null
    if (id) setSnappedId(id)
  }
  useEffect(() => {
    const root = scrollRef.current
    if (!root) return
    // re-sync once sessions change (feed re-orders / new lives appear) —
    // deferred so we never setState synchronously inside the effect
    const t = window.setTimeout(onScroll, 0)
    root.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.clearTimeout(t)
      root.removeEventListener('scroll', onScroll)
    }
  }, [sessions])

  return (
    <div
      ref={scrollRef}
      className="h-full snap-y snap-mandatory overflow-y-auto overscroll-contain bg-black no-scrollbar"
      aria-label="Live feed — swipe between broadcasts"
    >
      {sessions.map((s) => {
        const isMine = s.isMine || s.host.id === meId
        const isActive = activeId === s.id && !isMine
        return (
          <section
            key={s.id}
            data-live-id={s.id}
            className="relative h-full w-full flex-none snap-start overflow-hidden bg-gradient-to-br from-[#141624] to-[#0a0b12]"
          >
            {isMine ? (
              /* my own broadcast — manage card (never view myself as a viewer) */
              <button className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center" onClick={() => onManageMine(s)}>
                <Avatar name={s.host.name} avatarKey={s.host.avatarKey} size={84} src={s.host.avatarUrl} />
                <p className="mt-2 max-w-full truncate text-[17px] font-extrabold text-white">{s.title}</p>
                <p className="text-[12px] text-white/60">Your broadcast · {s.viewerCount} watching</p>
                <span className="mt-2 flex h-11 items-center gap-2 rounded-full bg-gradient-to-r from-[#E1306C] to-[#7B3FE4] px-5 text-[13px] font-bold text-white">
                  <Radio size={15} /> Manage broadcast
                </span>
              </button>
            ) : isActive ? (
              /* the snapped-in session: the real viewer joins the stream */
              <LiveViewerScreen key={s.id} session={s} embedded onClose={onEnded} />
            ) : (
              /* off-screen sessions: poster until snapped into view */
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(123,63,228,0.18),transparent_65%)]" />
                <div className="relative">
                  <Avatar name={s.host.name} avatarKey={s.host.avatarKey} size={84} src={s.host.avatarUrl} />
                  <span className="absolute -bottom-1 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-red-500 px-2.5 py-1 text-[10px] font-bold text-white">
                    ● LIVE
                  </span>
                </div>
                <p className="mt-2 max-w-full truncate text-[16px] font-extrabold text-white">{s.title}</p>
                <p className="max-w-[240px] truncate text-[12px] text-white/60">{s.host.name}</p>
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/75">
                    <Eye size={12} /> {s.viewerCount}
                  </span>
                  {s.mode === 'battle' && (
                    <span className="flex items-center gap-1 rounded-full bg-[#7B3FE4]/40 px-2.5 py-1 text-[11px] font-bold text-white">
                      <Swords size={12} /> Battle
                    </span>
                  )}
                </div>
                <span className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold text-white/45">
                  <ChevronUp size={13} className="animate-bounce" /> swipe to watch
                </span>
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}

function GoLiveSheet({ onClose, onStart }: { onClose: () => void; onStart: (title: string, mode: string) => Promise<void> }) {
  const [title, setTitle] = useState('')
  const [mode, setMode] = useState<'solo' | 'battle'>('solo')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [errorHint, setErrorHint] = useState('')
  const [perm, setPerm] = useState<'unknown' | 'ok' | 'failed'>('unknown')

  /** Explain a getUserMedia failure in plain language (the browser error name
   *  is the ground truth — permission prompts, OS-level device locks, iframe
   *  policies and missing hardware all surface differently).
   *
   *  The richer `errorKind` (returned by `liveManager.preflightCamera` after
   *  probing each device separately) lets us say SPECIFICALLY which device
   *  is missing instead of the old generic "No camera or microphone was found
   *  on this device" — which was actively misleading because the browser had
   *  rejected the request for constraint reasons before the user even saw the
   *  permission prompt. */
  const describeCamError = (name: string, errorKind?: PreflightErrorKind): { msg: string; hint: string } => {
    // Prefer the preflight's probed kind — it's the most actionable signal.
    if (errorKind) {
      const d = describeLiveMediaError(errorKind)
      return { msg: d.title, hint: d.hint }
    }
    // Fallback: classify by raw error name (the only info we have).
    const d = describeLiveMediaError(
      name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError'
        ? 'permission'
        : name === 'NotReadableError' || name === 'TrackStartError'
          ? 'busy'
          : name === 'NotFoundError' || name === 'OverconstrainedError' || name === 'DevicesNotFoundError'
            ? 'both'
            : 'unknown'
    )
    return { msg: d.title, hint: d.hint }
  }

  const start = async () => {
    setBusy(true)
    setError('')
    setErrorHint('')
    try {
      // PREFLIGHT — capture camera/mic FIRST, inside this tap, BEFORE creating
      // the session. The browser permission prompt appears right here; a
      // failure never creates a ghost broadcast row.
      const pre = await liveManager.preflightCamera()
      if (!pre.ok) {
        setPerm('failed')
        const { msg, hint } = describeCamError(pre.errorName, pre.errorKind)
        setError(msg)
        setErrorHint(hint)
        setBusy(false)
        return
      }
      setPerm('ok')
      await onStart(title.trim() || 'Live', mode)
    } catch (e) {
      liveManager.discardPreflight()
      toast.error((e as Error).message || 'Could not start the live')
      setError((e as Error).message)
      setBusy(false)
    }
  }

  const cancel = () => {
    // release the warmed camera when the user backs out without going live
    liveManager.discardPreflight()
    onClose()
  }

  return (
    <div className="absolute inset-0 z-50 flex flex-col justify-end bg-black/50" onClick={cancel}>
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
        {error && (
          <div className="mt-3 rounded-[14px] border border-[#F5C2C7]/60 bg-[#FEF1F0] px-3.5 py-3">
            <div className="text-[13px] font-bold text-cred">{error}</div>
            {errorHint && <div className="mt-1 text-[12px] leading-[17px] text-[#8a4a4e]">{errorHint}</div>}
          </div>
        )}
        {!error && perm === 'ok' && (
          <p className="mt-3 flex items-center gap-1.5 text-[12px] font-semibold text-cgreen">Camera & microphone ready — starting…</p>
        )}
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
