'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { X, Eye, Send, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'
import { api } from '@/lib/callapp/api'
import { useApp } from '@/lib/callapp/store'
import { Avatar } from './Avatar'
import type { StoryGroup, StoryItem, StoryViewer as StoryViewerRow, StoryOverlay } from '@/lib/callapp/types'

const REACTIONS = ['❤️', '😂', '😮', '😢', '👏', '🔥']

function parseOverlays(json: string | null): StoryOverlay[] {
  if (!json) return []
  try {
    return JSON.parse(json) as StoryOverlay[]
  } catch {
    return []
  }
}

/**
 * Full-screen story viewer: sequential groups → clips with progress bars,
 * overlays, reactions, reply, viewers list (own stories), delete.
 */
export function StoryViewer({
  groups,
  startGroup,
  onClose,
}: {
  groups: StoryGroup[]
  startGroup: number
  onClose: () => void
}) {
  const openChat = useApp((s) => s.openChat)
  const [gi, setGi] = useState(startGroup)
  const [ci, setCi] = useState(0)
  const [paused, setPaused] = useState(false)
  const [progress, setProgress] = useState(0)
  const [showViewers, setShowViewers] = useState(false)
  const [viewers, setViewers] = useState<StoryViewerRow[]>([])
  const [replyText, setReplyText] = useState('')
  const rafRef = useRef<number>(0)
  const startRef = useRef<number>(0)

  const group = groups[gi]
  const story = group?.stories[ci]

  const advance = useCallback(() => {
    setProgress(0)
    if (!group) return
    if (ci < group.stories.length - 1) {
      setCi(ci + 1)
    } else if (gi < groups.length - 1) {
      setGi(gi + 1)
      setCi(0)
    } else {
      onClose()
    }
  }, [ci, gi, group, groups.length, onClose])

  const goBack = useCallback(() => {
    setProgress(0)
    if (ci > 0) setCi(ci - 1)
    else if (gi > 0) {
      setGi(gi - 1)
      setCi(0)
    }
  }, [ci, gi])

  /* record view */
  useEffect(() => {
    if (!story) return
    void api.storyView(story.id).catch(() => {})
    if (story.mine) {
      void api
        .storyViews(story.id)
        .then((res) => {
          setViewers(res.viewers)
        })
        .catch(() => {})
    }
  }, [story])

  /* progress ticker */
  useEffect(() => {
    if (!story || paused || showViewers) return
    startRef.current = performance.now() - progress * story.durationMs
    const tick = (t: number) => {
      const p = (t - startRef.current) / story.durationMs
      if (p >= 1) {
        advance()
        return
      }
      setProgress(p)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
     
  }, [story?.id, paused, showViewers])

  const overlays = useMemo(() => (story ? parseOverlays(story.overlayJson) : []), [story])

  if (!group || !story) return null

  const react = (emoji: string) => {
    void api.storyReact(story.id, emoji).catch(() => {})
  }

  const sendReply = () => {
    const text = replyText.trim()
    if (!text) return
    void openChatWithReply(group.userId, `Re: your story — ${text}`)
    setReplyText('')
  }

  const openChatWithReply = (peerId: string, text: string) => {
    onClose()
    openChat(peerId)
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent('call:chat-prefill', { detail: text }))
    }, 400)
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/95">
      <div className="relative flex h-full w-full max-w-[480px] flex-col md:h-[92vh] md:rounded-[24px] md:shadow-2xl">
        {/* progress bars */}
        <div className="absolute left-0 right-0 top-0 z-20 flex gap-1 px-3 pt-3">
          {group.stories.map((s, i) => (
            <div key={s.id} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/30">
              <div
                className="h-full rounded-full bg-white transition-none"
                style={{ width: i < ci ? '100%' : i === ci ? `${progress * 100}%` : '0%' }}
              />
            </div>
          ))}
        </div>

        {/* header */}
        <div className="absolute left-0 right-0 top-7 z-20 flex items-center gap-2.5 px-4 pt-2">
          <Avatar name={group.name} avatarKey={group.avatarKey} size={36} src={group.avatarUrl} />
          <div className="flex-1">
            <div className="text-[14px] font-bold text-white">{group.mine ? 'My status' : group.name}</div>
            <div className="text-[11px] text-white/70">
              {story.clipIndex > 0 ? `Clip ${story.clipIndex + 1} · ` : ''}
              {new Date(story.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
          {story.mine && (
            <button
              className="rounded-full p-2 text-white/80 hover:bg-white/10"
              title="Delete story"
              onClick={async () => {
                if (!confirm('Delete this story clip?')) return
                try {
                  await api.deleteStory(story.id)
                  advance()
                } catch {}
              }}
            >
              <Trash2 size={18} />
            </button>
          )}
          <button className="rounded-full p-2 text-white hover:bg-white/10" onClick={onClose} aria-label="Close">
            <X size={22} />
          </button>
        </div>

        {/* media */}
        <button
          className="absolute left-0 top-0 z-10 h-full w-[28%] cursor-default"
          onClick={goBack}
          aria-label="Previous"
        />
        <button
          className="absolute right-0 top-0 z-10 h-full w-[28%] cursor-default"
          onClick={advance}
          aria-label="Next"
        />
        <div
          className="flex flex-1 items-center justify-center overflow-hidden"
          onPointerDown={() => setPaused(true)}
          onPointerUp={() => setPaused(false)}
        >
          {story.kind === 'text' ? (
            <div className="flex h-full w-full items-center justify-center p-10" style={{ background: story.bgColor }}>
              <p className="text-center text-[22px] font-bold leading-relaxed text-white">{story.text}</p>
            </div>
          ) : story.kind === 'voice' ? (
            <div className="flex h-full w-full flex-col items-center justify-center gap-6" style={{ background: story.bgColor }}>
              <span className="text-[64px]">🎙️</span>
              <p className="text-white/90">Voice story</p>
              {story.mediaUrl && <audio src={story.mediaUrl} controls autoPlay className="w-[80%]" />}
            </div>
          ) : story.kind === 'video' ? (
            <video
              key={story.id}
              src={story.mediaUrl ?? undefined}
              autoPlay
              playsInline
              onEnded={advance}
              className="h-full w-full object-contain"
              onClick={advance}
            />
          ) : (
            <img
              key={story.id}
              src={story.mediaUrl ?? undefined}
              alt="Story"
              className="h-full w-full object-contain"
              draggable={false}
            />
          )}

          {/* overlays */}
          {overlays.map((o, i) => (
            <span
              key={i}
              className="pointer-events-none absolute select-none font-bold drop-shadow-[0_1px_4px_rgba(0,0,0,0.6)]"
              style={{
                left: `${o.x * 100}%`,
                top: `${o.y * 100}%`,
                fontSize: `${o.size}px`,
                color: o.color ?? '#fff',
                transform: 'translate(-50%, -50%)',
              }}
            >
              {o.text}
            </span>
          ))}
        </div>

        {/* footer: reactions + reply */}
        <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/80 to-transparent px-4 pb-5 pt-8">
          {story.mine ? (
            <div className="flex items-center gap-2 text-white">
              <Eye size={18} />
              <span className="text-sm font-semibold">{story.viewCount} views</span>
              <button
                className="ml-auto rounded-full bg-white/15 px-4 py-2 text-xs font-semibold hover:bg-white/25"
                onClick={() => setShowViewers(true)}
              >
                Viewers
              </button>
            </div>
          ) : (
            <>
              <div className="flex gap-2 pb-2.5">
                {REACTIONS.map((r) => (
                  <button
                    key={r}
                    className="rounded-full bg-white/15 px-3 py-1.5 text-lg transition hover:scale-110 hover:bg-white/25"
                    onClick={() => react(r)}
                    aria-label={`React ${r}`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  className="h-11 flex-1 rounded-full border border-white/30 bg-white/10 px-4 text-sm text-white outline-none placeholder:text-white/60"
                  placeholder="Reply to story…"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendReply()}
                />
                <button
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-black"
                  onClick={sendReply}
                  aria-label="Send reply"
                >
                  <Send size={18} />
                </button>
              </div>
            </>
          )}
        </div>

        {/* desktop arrows */}
        <button
          className="absolute left-2 top-1/2 z-20 hidden -translate-y-1/2 rounded-full bg-white/10 p-2 text-white md:block hover:bg-white/20"
          onClick={goBack}
          aria-label="Previous story"
        >
          <ChevronLeft size={22} />
        </button>
        <button
          className="absolute right-2 top-1/2 z-20 hidden -translate-y-1/2 rounded-full bg-white/10 p-2 text-white md:block hover:bg-white/20"
          onClick={advance}
          aria-label="Next story"
        >
          <ChevronRight size={22} />
        </button>

        {/* viewers sheet */}
        {showViewers && (
          <div className="absolute inset-0 z-30 flex flex-col bg-black/90">
            <div className="flex items-center justify-between px-5 py-4">
              <h3 className="text-lg font-bold text-white">Story viewers ({viewers.length})</h3>
              <button className="rounded-full p-2 text-white hover:bg-white/10" onClick={() => setShowViewers(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 pb-8">
              {viewers.length === 0 && <p className="pt-8 text-center text-sm text-white/60">No views yet</p>}
              {viewers.map((v) => (
                <div key={v.id} className="flex items-center gap-3 py-2.5">
                  <Avatar name={v.name} avatarKey={v.avatarKey} size={38} src={v.avatarUrl} />
                  <div>
                    <div className="text-sm font-semibold text-white">{v.name}</div>
                    <div className="text-[11px] text-white/50">
                      {new Date(v.at).toLocaleString([], { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
