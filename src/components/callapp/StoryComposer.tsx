'use client'

import { useEffect, useRef, useState } from 'react'
import {
  X, Camera, Type, Mic, Video, ImagePlus, Send, Sparkles, Sticker,
  Loader2, CheckCircle2, Globe, Users as UsersIcon, Play, Square,
} from 'lucide-react'
import { api } from '@/lib/callapp/api'
import { useApp } from '@/lib/callapp/store'
import { FACE_FILTERS, openCameraWithFilters, type FaceFilterHandle, type FilterId } from '@/lib/callapp/faceFilters'
import { VOICE_FX, createFxStream, previewFxOnBlob, type VoiceEffect } from '@/lib/callapp/voiceFx'
import { splitVideoForStory, type StoryClip } from '@/lib/callapp/videoSplit'
import type { StoryOverlay } from '@/lib/callapp/types'

type Mode = 'photo' | 'video' | 'text' | 'voice'
const BG_COLORS = ['#2F5BE0', '#7B3FE4', '#E1306C', '#0EA5A6', '#F59E0B', '#111827']
const STICKERS = ['😀', '😂', '😍', '🔥', '💜', '✨', '🎉', '🌟', '👍', '🤣', '🌹', '💯', '😎', '🌈', '⭐', '❤️']

/**
 * Story composer: photo (camera w/ face filters or upload), video (auto-split
 * into sequential clips), text, voice (with voice FX). Overlays (text +
 * stickers), preview, privacy, then publish as one story group.
 */
export function StoryComposer({ onClose }: { onClose: () => void }) {
  const me = useApp((s) => s.me)
  const [mode, setMode] = useState<Mode>('photo')
  const [privacy, setPrivacy] = useState<'all' | 'contacts'>('all')
  const [publishing, setPublishing] = useState(false)
  const [publishDone, setPublishDone] = useState(false)
  const [error, setError] = useState('')
  const [splitProgress, setSplitProgress] = useState('')

  /* photo */
  const [filter, setFilter] = useState<FilterId>('none')
  const [camReady, setCamReady] = useState(false)
  const [hasDetector, setHasDetector] = useState(false)
  const camRef = useRef<HTMLVideoElement>(null)
  const camCanvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<FaceFilterHandle | null>(null)
  const [captured, setCaptured] = useState<Blob | null>(null)

  /* video */
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [videoClips, setVideoClips] = useState<StoryClip[]>([])

  /* text */
  const [text, setText] = useState('')
  const [bgColor, setBgColor] = useState(BG_COLORS[0])

  /* voice */
  const [voiceEffect, setVoiceEffect] = useState<VoiceEffect>('original')
  const [recording, setRecording] = useState(false)
  const [recSecs, setRecSecs] = useState(0)
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null)
  const recRef = useRef<MediaRecorder | null>(null)
  const fxRef = useRef<{ stop(): void } | null>(null)
  const stopPreviewRef = useRef<(() => void) | null>(null)
  const [previewing, setPreviewing] = useState(false)

  /* overlays */
  const [overlays, setOverlays] = useState<StoryOverlay[]>([])
  const [showOverlayPicker, setShowOverlayPicker] = useState(false)
  const [overlayText, setOverlayText] = useState('')

  /* ---------- camera lifecycle ---------- */
  useEffect(() => {
    if (mode !== 'photo' || captured) return
    let cancelled = false
    let handle: FaceFilterHandle | null = null
    const start = async () => {
      try {
        handle = await openCameraWithFilters(filter, false, camCanvasRef.current)
        if (cancelled) {
          handle.stop()
          return
        }
        engineRef.current = handle
        setHasDetector(handle.hasDetector())
        setCamReady(true)
      } catch {
        setError('Camera permission is needed for photo stories. You can still upload a picture.')
      }
    }
    void start()
    return () => {
      cancelled = true
      handle?.stop()
      engineRef.current = null
      setCamReady(false)
    }
     
  }, [mode, captured])

  useEffect(() => {
    engineRef.current?.setFilter(filter)
  }, [filter])

  /* ---------- voice recording ---------- */
  useEffect(() => {
    if (!recording) return
    const t = window.setInterval(() => setRecSecs((s) => s + 1), 1000)
    return () => window.clearInterval(t)
  }, [recording])

  const startVoiceRecording = async () => {
    try {
      setError('')
      const raw = await navigator.mediaDevices.getUserMedia({ audio: true })
      const fx = await createFxStream(raw, voiceEffect)
      fxRef.current = fx
      const rec = new MediaRecorder(fx.stream)
      const chunks: Blob[] = []
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
      rec.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' })
        setVoiceBlob(blob)
        fx.stop()
        raw.getTracks().forEach((t) => t.stop())
        fxRef.current = null
      }
      recRef.current = rec
      rec.start()
      setRecSecs(0)
      setVoiceBlob(null)
      setRecording(true)
    } catch {
      setError('Microphone permission is needed for voice stories.')
    }
  }

  const stopVoiceRecording = () => {
    recRef.current?.stop()
    setRecording(false)
  }

  const togglePreview = async () => {
    if (!voiceBlob) return
    if (previewing) {
      stopPreviewRef.current?.()
      stopPreviewRef.current = null
      setPreviewing(false)
      return
    }
    stopPreviewRef.current = await previewFxOnBlob(voiceBlob, voiceEffect)
    setPreviewing(true)
    window.setTimeout(() => {
      stopPreviewRef.current?.()
      stopPreviewRef.current = null
      setPreviewing(false)
    }, 8000)
  }

  /* ---------- video selection ---------- */
  const onPickVideo = async (file: File) => {
    setError('')
    setVideoFile(file)
    setVideoClips([])
    try {
      const clips = await splitVideoForStory(file, (p) => {
        setSplitProgress(`Processing clip ${p.clipIndex + 1}/${p.clipCount} — ${Math.round(p.clipProgress * 100)}%`)
      })
      setVideoClips(clips)
      setSplitProgress('')
      if (clips.length > 1) {
        // user is informed the video was sequenced
        setError('')
      }
    } catch {
      setError('Could not process this video. Try a shorter one (up to 3 minutes).')
      setVideoFile(null)
    }
  }

  /* ---------- publish ---------- */
  const publish = async () => {
    setPublishing(true)
    setError('')
    try {
      const overlayJson = overlays.length ? JSON.stringify(overlays) : undefined
      const clips: Array<{ kind: string; mediaId?: string; text?: string; overlayJson?: string; bgColor?: string; durationMs?: number }> = []

      if (mode === 'photo') {
        let blob = captured
        if (!blob) {
          if (!engineRef.current) throw new Error('Camera not ready')
          blob = await engineRef.current.snap(1080)
        }
        const up = await api.uploadStoryMedia(blob, 'jpg')
        clips.push({ kind: 'photo', mediaId: up.id, overlayJson, durationMs: 6000 })
      } else if (mode === 'video') {
        for (const c of videoClips) {
          const up = await api.uploadStoryMedia(c.blob, 'webm')
          clips.push({ kind: 'video', mediaId: up.id, overlayJson, durationMs: c.durationMs })
        }
        if (!clips.length) throw new Error('No video processed')
      } else if (mode === 'text') {
        if (!text.trim()) throw new Error('Write something first')
        clips.push({ kind: 'text', text: text.trim(), bgColor, durationMs: 7000 })
      } else if (mode === 'voice') {
        if (!voiceBlob) throw new Error('Record a voice story first')
        const up = await api.uploadStoryMedia(voiceBlob, 'webm')
        clips.push({ kind: 'voice', mediaId: up.id, bgColor, durationMs: Math.max(3000, recSecs * 1000) })
      }

      await api.publishStory({ clips, privacy })
      setPublishDone(true)
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent('call:stories-refresh'))
        onClose()
      }, 1100)
    } catch (e) {
      setError((e as Error).message || 'Publish failed')
    } finally {
      setPublishing(false)
    }
  }

  const addOverlayText = () => {
    const t = overlayText.trim()
    if (!t) return
    setOverlays((o) => [
      ...o,
      { type: 'text', text: t, x: 0.5, y: 0.3 + o.length * 0.08, size: 26, color: '#ffffff' },
    ])
    setOverlayText('')
  }

  const addSticker = (s: string) => {
    setOverlays((o) => [...o, { type: 'emoji', text: s, x: 0.3 + Math.random() * 0.4, y: 0.25 + Math.random() * 0.4, size: 44 }])
  }

  const canPublish =
    (mode === 'photo' && (captured || camReady)) ||
    (mode === 'video' && videoClips.length > 0) ||
    (mode === 'text' && text.trim().length > 0) ||
    (mode === 'voice' && !!voiceBlob)

  const isVideoSeq = mode === 'video' && videoClips.length > 1

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-[#0b0d14] text-white">
      {/* header */}
      <header className="flex items-center gap-3 px-4 py-3.5">
        <button className="rounded-full bg-white/10 p-2 hover:bg-white/20" onClick={onClose} aria-label="Close composer">
          <X size={20} />
        </button>
        <h2 className="flex-1 text-lg font-bold">Create story</h2>
        <select
          className="rounded-full border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold outline-none"
          value={privacy}
          onChange={(e) => setPrivacy(e.target.value === 'contacts' ? 'contacts' : 'all')}
          aria-label="Story privacy"
        >
          <option value="all">🌍 Everyone</option>
          <option value="contacts">👥 Contacts only</option>
        </select>
      </header>

      {/* mode tabs */}
      <div className="flex gap-2 px-4 pb-3">
        {(
          [
            { id: 'photo', label: 'Photo', Icon: Camera },
            { id: 'video', label: 'Video', Icon: Video },
            { id: 'text', label: 'Text', Icon: Type },
            { id: 'voice', label: 'Voice', Icon: Mic },
          ] as const
        ).map(({ id, label, Icon }) => (
          <button
            key={id}
            className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold transition ${
              mode === id ? 'bg-white text-black' : 'bg-white/10 text-white/80 hover:bg-white/20'
            }`}
            onClick={() => {
              setMode(id)
              setError('')
            }}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {/* body */}
      <div className="relative mx-4 flex flex-1 items-center justify-center overflow-hidden rounded-[22px] bg-black/40 md:mx-auto md:w-[420px]">
        {mode === 'photo' && (
          <>
            {!captured ? (
              <div className="relative h-full w-full">
                <video ref={camRef} className="hidden" playsInline muted />
                <canvas
                  ref={camCanvasRef}
                  className="h-full w-full object-cover"
                  onDoubleClick={() => {
                    // allow manual anchor nudge when no native detector exists
                    engineRef.current?.setAnchor(0.5, 0.42, 0.4)
                  }}
                />
                {!camReady && (
                  <div className="absolute inset-0 flex items-center justify-center text-sm text-white/60">
                    <Loader2 className="mr-2 animate-spin" size={18} /> Starting camera…
                  </div>
                )}
                {!hasDetector && camReady && (
                  <p className="absolute bottom-2 left-2 right-2 rounded-lg bg-black/60 px-3 py-1.5 text-[11px] text-white/70">
                    Browser face-tracking unavailable — overlays stay centered. Drag the camera to frame your face.
                  </p>
                )}
                <button
                  className="absolute bottom-4 left-1/2 h-16 w-16 -translate-x-1/2 rounded-full border-4 border-white bg-white/20 transition active:scale-95"
                  onClick={() => {
                    engineRef.current
                      ?.snap(1080)
                      .then((b) => setCaptured(b))
                      .catch(() => {})
                  }}
                  aria-label="Capture photo"
                />
              </div>
            ) : (
              <CapturedPreview blob={captured} onRetake={() => setCaptured(null)} />
            )}
            {/* filter row */}
            <div className="absolute bottom-0 left-0 right-0 flex gap-2 overflow-x-auto px-3 pb-3 pt-6 stories-scroll">
              {!captured &&
                FACE_FILTERS.map((f) => (
                  <button
                    key={f.id}
                    className={`flex flex-none items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      filter === f.id ? 'bg-white text-black' : 'bg-black/50 text-white hover:bg-black/70'
                    }`}
                    onClick={() => setFilter(f.id)}
                  >
                    <span>{f.emoji}</span> {f.name}
                  </button>
                ))}
            </div>
          </>
        )}

        {mode === 'video' && (
          <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-6 text-center">
            {!videoFile && (
              <>
                <Video size={44} className="text-white/40" />
                <p className="text-sm text-white/70">Pick a video (up to 3 min). Longer videos are auto-split into sequential clips.</p>
                <label className="cursor-pointer rounded-full bg-white px-6 py-3 text-sm font-bold text-black">
                  <ImagePlus size={16} className="mr-2 inline" /> Choose video
                  <input
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime,video/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && void onPickVideo(e.target.files[0])}
                  />
                </label>
              </>
            )}
            {videoFile && !videoClips.length && (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="animate-spin" size={30} />
                <p className="text-sm text-white/70">{splitProgress || 'Processing…'}</p>
              </div>
            )}
            {videoClips.length > 0 && (
              <div className="flex flex-col items-center gap-3">
                <CheckCircle2 size={34} className="text-green-400" />
                <p className="text-sm font-semibold">
                  {videoClips.length === 1 ? 'Clip ready' : `${videoClips.length} sequential clips ready`}
                </p>
                <video src={URL.createObjectURL(videoClips[0].blob)} className="max-h-[46vh] rounded-xl" controls muted />
                <button className="text-xs text-white/60 underline" onClick={() => { setVideoFile(null); setVideoClips([]) }}>
                  Choose another video
                </button>
              </div>
            )}
          </div>
        )}

        {mode === 'text' && (
          <div className="h-full w-full p-6" style={{ background: bgColor }}>
            <textarea
              className="h-full w-full resize-none bg-transparent text-center text-[24px] font-bold leading-relaxed text-white outline-none placeholder:text-white/50"
              placeholder="Type your story…"
              value={text}
              maxLength={500}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
        )}

        {mode === 'voice' && (
          <div className="flex h-full w-full flex-col items-center justify-center gap-5 p-6">
            <div className={`flex h-28 w-28 items-center justify-center rounded-full ${recording ? 'animate-pulse bg-red-500' : 'bg-white/10'}`}>
              <Mic size={44} />
            </div>
            <p className="text-lg font-bold tabular-nums">{Math.floor(recSecs / 60)}:{String(recSecs % 60).padStart(2, '0')}</p>
            {recording ? (
              <button className="rounded-full bg-red-500 px-6 py-3 text-sm font-bold" onClick={stopVoiceRecording}>
                <Square size={15} className="mr-2 inline" /> Stop
              </button>
            ) : (
              <button className="rounded-full bg-white px-6 py-3 text-sm font-bold text-black" onClick={() => void startVoiceRecording()}>
                🎙️ Record {voiceEffect !== 'original' ? `(${VOICE_FX.find((v) => v.id === voiceEffect)?.name})` : ''}
              </button>
            )}
            {voiceBlob && !recording && (
              <div className="flex items-center gap-2">
                <button className="rounded-full bg-white/15 px-4 py-2 text-xs font-semibold" onClick={() => void togglePreview()}>
                  <Play size={13} className="mr-1.5 inline" /> {previewing ? 'Stop preview' : 'Preview'}
                </button>
                <button className="text-xs text-white/60 underline" onClick={() => setVoiceBlob(null)}>
                  Re-record
                </button>
              </div>
            )}
            {/* effect picker */}
            <div className="flex w-full flex-wrap justify-center gap-1.5 pt-2">
              {VOICE_FX.map((f) => (
                <button
                  key={f.id}
                  className={`rounded-full px-2.5 py-1.5 text-[11px] font-semibold transition ${
                    voiceEffect === f.id ? 'bg-white text-black' : 'bg-white/10 text-white/80 hover:bg-white/20'
                  }`}
                  onClick={() => setVoiceEffect(f.id)}
                >
                  {f.emoji} {f.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* overlay chips over media modes */}
        {(mode === 'photo' || mode === 'video') && (
          <button
            className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-2 text-xs font-semibold backdrop-blur"
            onClick={() => setShowOverlayPicker((v) => !v)}
          >
            <Sticker size={14} /> Overlays {overlays.length > 0 && `(${overlays.length})`}
          </button>
        )}
        {showOverlayPicker && (mode === 'photo' || mode === 'video') && (
          <div className="absolute bottom-16 left-3 right-3 rounded-2xl bg-black/80 p-4 backdrop-blur">
            <div className="flex gap-2 pb-2">
              <input
                className="h-9 flex-1 rounded-full bg-white/10 px-3 text-sm outline-none placeholder:text-white/50"
                placeholder="Add caption…"
                value={overlayText}
                onChange={(e) => setOverlayText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addOverlayText()}
              />
              <button className="rounded-full bg-white px-4 text-xs font-bold text-black" onClick={addOverlayText}>
                <Sparkles size={13} className="mr-1 inline" /> Add
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {STICKERS.map((s) => (
                <button key={s} className="rounded-lg bg-white/10 px-2 py-1 text-xl hover:bg-white/25" onClick={() => addSticker(s)}>
                  {s}
                </button>
              ))}
            </div>
            {overlays.length > 0 && (
              <button className="mt-2 text-[11px] text-white/60 underline" onClick={() => setOverlays([])}>
                Clear all overlays
              </button>
            )}
          </div>
        )}
      </div>

      {/* footer */}
      <div className="px-4 pb-6 pt-4 md:mx-auto md:w-[452px]">
        {mode === 'text' && (
          <div className="flex gap-2 pb-3">
            {BG_COLORS.map((c) => (
              <button
                key={c}
                className={`h-8 w-8 rounded-full ring-2 transition ${bgColor === c ? 'ring-white' : 'ring-transparent'}`}
                style={{ background: c }}
                onClick={() => setBgColor(c)}
                aria-label={`Background ${c}`}
              />
            ))}
          </div>
        )}
        {error && <p className="pb-2 text-[13px] font-semibold text-red-400">{error}</p>}
        {isVideoSeq && (
          <p className="pb-2 text-[12px] text-white/60">
            {videoClips.length} clips will play back-to-back as one story (like WhatsApp Status).
          </p>
        )}
        <button
          className="flex h-[52px] w-full items-center justify-center gap-2 rounded-[16px] bg-gradient-to-r from-[#2F5BE0] to-[#7B3FE4] text-[15px] font-bold disabled:opacity-40"
          disabled={!canPublish || publishing}
          onClick={() => void publish()}
        >
          {publishing ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
          {publishing ? 'Publishing…' : publishDone ? 'Published!' : 'Publish story'}
          {privacy === 'contacts' && !publishing && <UsersIcon size={15} className="opacity-70" />}
          {privacy === 'all' && !publishing && <Globe size={15} className="opacity-70" />}
        </button>
      </div>
    </div>
  )
}

function CapturedPreview({ blob, onRetake }: { blob: Blob; onRetake: () => void }) {
  const url = URL.createObjectURL(blob)
  return (
    <div className="relative h-full w-full">
      <img src={url} alt="Captured" className="h-full w-full object-cover" />
      <button
        className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-5 py-2.5 text-xs font-semibold backdrop-blur"
        onClick={onRetake}
      >
        ↺ Retake
      </button>
    </div>
  )
}
