'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Send, X, Crop, Scissors, ZoomIn, Play, Pause, Check } from 'lucide-react'
import { toast } from 'sonner'

export interface ComposedMedia {
  blob: Blob
  ext: string
  durationSec?: number
}

/**
 * WhatsApp-style media composer shown BEFORE a photo/video is sent.
 *  - photo: live preview with PAN + ZOOM crop (Full / 1:1 / 4:5 outputs)
 *  - video: preview with a real TRIM (start/end) — the selected segment is
 *    re-recorded client-side (canvas captureStream + WebAudio), falling back
 *    to the original file when the browser can't re-encode.
 */
export function MediaComposer({
  file,
  kind,
  onSend,
  onClose,
}: {
  file: File
  kind: 'image' | 'video'
  /** receives the (possibly cropped/trimmed) blob ready for upload */
  onSend: (media: ComposedMedia) => Promise<void>
  onClose: () => void
}) {
  const [busy, setBusy] = useState(false)
  const url = useMemoObjectUrl(file)

  /* ---------------- photo crop ---------------- */
  const [ratio, setRatio] = useState<'full' | '1:1' | '4:5'>('full')
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const frameRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null)

  /* ---------------- video trim ---------------- */
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [duration, setDuration] = useState(0)
  const [trimStart, setTrimStart] = useState(0)
  const [trimEnd, setTrimEnd] = useState(0)
  const [playing, setPlaying] = useState(false)
  const audioCtxRef = useRef<AudioContext | null>(null)

  useEffect(() => {
    return () => {
      void audioCtxRef.current?.close().catch(() => {})
    }
  }, [])

  /* clamp pan so the image always covers the crop frame */
  const clampOffset = useCallback(
    (ox: number, oy: number, frame: { w: number; h: number }, nat: { w: number; h: number }, z: number) => {
      const base = Math.max(frame.w / nat.w, frame.h / nat.h)
      const d = base * z
      const maxX = Math.max(0, (nat.w * d - frame.w) / 2)
      const maxY = Math.max(0, (nat.h * d - frame.h) / 2)
      return { x: Math.min(maxX, Math.max(-maxX, ox)), y: Math.min(maxY, Math.max(-maxY, oy)) }
    },
    []
  )

  const frameSize = (): { w: number; h: number } | null => {
    const el = frameRef.current
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { w: r.width, h: r.height }
  }

  const onImgLoad = () => {
    const img = imgRef.current
    const frame = frameSize()
    if (!img || !frame) return
    const nat = { w: img.naturalWidth, h: img.naturalHeight }
    setNatural(nat)
    setOffset({ x: 0, y: 0 })
    setZoom(1)
    void frame
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (ratio === 'full') return
    dragRef.current = { px: e.clientX, py: e.clientY, ox: offset.x, oy: offset.y }
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current
    const frame = frameSize()
    if (!drag || !frame || !natural) return
    const next = clampOffset(drag.ox + (e.clientX - drag.px), drag.oy + (e.clientY - drag.py), frame, natural, zoom)
    setOffset(next)
  }
  const onPointerUp = () => {
    dragRef.current = null
  }

  const changeZoom = (z: number) => {
    const frame = frameSize()
    if (!frame || !natural) return
    const cl = clampOffset(offset.x, offset.y, frame, natural, z)
    setZoom(z)
    setOffset(cl)
  }

  /** render the cropped region to a canvas blob (full → original file untouched) */
  const cropToBlob = async (): Promise<Blob | null> => {
    const img = imgRef.current
    const frame = frameSize()
    if (!img || !frame || !natural || ratio === 'full') return null
    const base = Math.max(frame.w / natural.w, frame.h / natural.h)
    const d = base * zoom
    const dispW = natural.w * d
    const dispH = natural.h * d
    const sx = Math.max(0, (dispW - frame.w) / 2 - offset.x) / d
    const sy = Math.max(0, (dispH - frame.h) / 2 - offset.y) / d
    const sw = Math.min(natural.w - sx, frame.w / d)
    const sh = Math.min(natural.h - sy, frame.h / d)
    // cap output size for reasonable upload sizes
    const outW = Math.min(1600, Math.round(sw))
    const outH = Math.round(sh * (outW / sw))
    const canvas = document.createElement('canvas')
    canvas.width = outW
    canvas.height = outH
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH)
    return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.9))
  }

  /** real client-side trim: re-records the selected segment into a webm blob */
  const trimToBlob = async (): Promise<{ blob: Blob; durationSec: number } | null> => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return null
    const start = trimStart
    const end = Math.max(trimStart + 0.5, trimEnd)
    const supports =
      typeof MediaRecorder !== 'undefined' &&
      typeof HTMLCanvasElement.prototype.captureStream === 'function'
    if (!supports || end - start >= duration - 0.15) return null // full-length → send original
    try {
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) return null
      const canvasStream = canvas.captureStream(30)
      // tap the element audio (routed through WebAudio so mute doesn't kill it)
      try {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        const ac = audioCtxRef.current ?? new AC()
        audioCtxRef.current = ac
        const src = ac.createMediaElementSource(video)
        const dest = ac.createMediaStreamDestination()
        src.connect(dest)
        dest.stream.getAudioTracks().forEach((t) => canvasStream.addTrack(t))
      } catch {}
      const mime =
        ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find((m) =>
          MediaRecorder.isTypeSupported(m)
        ) || ''
      const rec = new MediaRecorder(canvasStream, mime ? { mimeType: mime } : undefined)
      const chunks: Blob[] = []
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data)
      }
      const stopped = new Promise<void>((resolve) => {
        rec.onstop = () => resolve()
      })
      // seek to the trim start
      await new Promise<void>((resolve) => {
        const onSeek = () => {
          video.removeEventListener('seeked', onSeek)
          resolve()
        }
        video.addEventListener('seeked', onSeek)
        video.currentTime = start
      })
      rec.start(200)
      await video.play()
      await new Promise<void>((resolve) => {
        const tick = () => {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          if (video.currentTime >= end || video.ended) {
            resolve()
            return
          }
          requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      })
      video.pause()
      rec.stop()
      await stopped
      const blob = new Blob(chunks, { type: (rec.mimeType || 'video/webm').split(';')[0] })
      if (!blob.size) return null
      return { blob, durationSec: Math.max(1, Math.round(end - start)) }
    } catch {
      return null
    }
  }

  /** MediaRecorder webm files report duration=Infinity — force-resolve it */
  const resolveDuration = (v: HTMLVideoElement) => {
    const apply = (d: number) => {
      if (!isFinite(d) || d <= 0) return
      setDuration(d)
      setTrimEnd(d)
    }
    if (isFinite(v.duration) && v.duration > 0) {
      apply(v.duration)
      return
    }
    const onTick = () => {
      if (isFinite(v.duration) && v.duration > 0 && v.duration < 1e6) {
        v.removeEventListener('timeupdate', onTick)
        try {
          v.currentTime = 0
        } catch {}
        apply(v.duration)
      }
    }
    v.addEventListener('timeupdate', onTick)
    try {
      v.currentTime = 1e7 // seek far ahead → browser exposes the real duration
    } catch {}
  }

  const send = async () => {
    setBusy(true)
    try {
      if (kind === 'image') {
        const cropped = await cropToBlob()
        if (cropped) {
          await onSend({ blob: cropped, ext: 'jpg' })
        } else {
          await onSend({ blob: file, ext: extOf(file.type, 'jpg') })
        }
      } else {
        const trimmed = await trimToBlob()
        if (trimmed) {
          await onSend({ blob: trimmed.blob, ext: 'webm', durationSec: trimmed.durationSec })
        } else {
          await onSend({ blob: file, ext: extOf(file.type, 'mp4'), durationSec: Math.round(duration) })
        }
      }
      onClose()
    } catch (e) {
      toast.error((e as Error).message || 'Could not process the media')
    } finally {
      setBusy(false)
    }
  }

  const frameClass =
    ratio === 'full' ? '' : ratio === '1:1' ? 'aspect-square' : 'aspect-[4/5]'

  return (
    <div className="fixed inset-0 z-[96] flex flex-col bg-black" role="dialog" aria-modal="true" aria-label="Edit media">
      {/* header */}
      <div className="flex items-center justify-between px-4 pb-3 pt-[max(env(safe-area-inset-top),14px)] text-white">
        <button className="rounded-full bg-white/10 p-2.5" onClick={onClose} aria-label="Close editor">
          <X size={19} />
        </button>
        <p className="flex items-center gap-1.5 text-[14px] font-bold">
          {kind === 'image' ? <Crop size={16} /> : <Scissors size={16} />}
          {kind === 'image' ? 'Crop photo' : 'Trim video'}
        </p>
        <button
          className="flex h-10 items-center gap-1.5 rounded-full bg-gradient-to-r from-[#F59E0B] to-[#E1306C] px-4 text-[13px] font-bold disabled:opacity-50"
          disabled={busy}
          onClick={() => void send()}
          aria-label="Send media"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Send
        </button>
      </div>

      {/* preview area */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-4">
        {kind === 'image' ? (
          <div
            ref={frameRef}
            className={`relative max-h-full overflow-hidden rounded-[18px] bg-[#0c0e16] ${frameClass || 'flex max-h-full items-center justify-center'}`}
            style={ratio === 'full' ? undefined : { width: 'min(100%, 520px)' }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          >
            <img
              ref={imgRef}
              src={url}
              alt="Selected"
              draggable={false}
              className={`max-h-full max-w-full select-none object-contain ${ratio === 'full' ? '' : 'absolute inset-0 h-full w-full cursor-move object-cover'}`}
              style={
                ratio === 'full'
                  ? undefined
                  : {
                      transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                      left: '50%',
                      top: '50%',
                      width: '100%',
                      height: '100%',
                    }
              }
              onLoad={onImgLoad}
            />
          </div>
        ) : (
          <div className="relative max-h-full w-full max-w-[520px]">
            <video
              ref={videoRef}
              src={url}
              className="max-h-[52vh] w-full rounded-[18px] bg-black object-contain"
              playsInline
              muted={false}
              onLoadedMetadata={(e) => void resolveDuration(e.currentTarget)}
              onTimeUpdate={(e) => {
                if (!playing) return
                if (e.currentTarget.currentTime >= (trimEnd || duration)) {
                  e.currentTarget.pause()
                  setPlaying(false)
                }
              }}
              onEnded={() => setPlaying(false)}
            />
            {/* play preview between the handles */}
            <button
              className="absolute bottom-3 left-3 flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur"
              aria-label={playing ? 'Pause preview' : 'Play preview'}
              onClick={() => {
                const v = videoRef.current
                if (!v) return
                if (playing) {
                  v.pause()
                  setPlaying(false)
                } else {
                  if (v.currentTime < trimStart || v.currentTime >= trimEnd) v.currentTime = trimStart
                  void v.play()
                  setPlaying(true)
                }
              }}
            >
              {playing ? <Pause size={19} /> : <Play size={19} />}
            </button>
          </div>
        )}
        {busy && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/70 text-white">
            <Loader2 size={30} className="animate-spin" />
            <p className="text-[13.5px] font-bold">{kind === 'video' ? 'Processing trimmed video…' : 'Preparing photo…'}</p>
          </div>
        )}
      </div>

      {/* controls */}
      {kind === 'image' ? (
        <div className="space-y-3 px-5 pb-[max(env(safe-area-inset-bottom),18px)] pt-4 text-white">
          <div className="flex justify-center gap-2">
            {(['full', '1:1', '4:5'] as const).map((r) => (
              <button
                key={r}
                className={`rounded-full px-4 py-2 text-[12.5px] font-bold transition ${ratio === r ? 'bg-white text-black' : 'bg-white/10 text-white/70'}`}
                onClick={() => {
                  setRatio(r)
                  setOffset({ x: 0, y: 0 })
                  setZoom(1)
                }}
              >
                {r === 'full' ? 'Full photo' : r}
              </button>
            ))}
          </div>
          {ratio !== 'full' && (
            <div className="flex items-center gap-3">
              <ZoomIn size={18} className="flex-none text-white/70" />
              <input
                type="range"
                min={1}
                max={4}
                step={0.02}
                value={zoom}
                onChange={(e) => changeZoom(Number(e.target.value))}
                className="w-full accent-[#E1306C]"
                aria-label="Zoom"
              />
            </div>
          )}
          <p className="text-center text-[11.5px] text-white/50">
            {ratio === 'full' ? 'Sending the full photo — pick a crop ratio to trim edges' : 'Drag the photo to reposition · pinch/zoom slider to fit'}
          </p>
        </div>
      ) : (
        <div className="space-y-3 px-5 pb-[max(env(safe-area-inset-bottom),18px)] pt-4 text-white">
          <div>
            <div className="flex items-center justify-between text-[12px] font-bold text-white/80">
              <span>Start {fmt(trimStart)}</span>
              <span>
                Trimmed {fmt(Math.max(0.5, trimEnd - trimStart))}
              </span>
              <span>End {fmt(trimEnd)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={Math.max(0.1, isFinite(duration) ? duration : 0.1)}
              step={0.1}
              value={trimStart}
              onChange={(e) => {
                const v = Math.min(Number(e.target.value), trimEnd - 0.5)
                setTrimStart(Math.max(0, isFinite(v) ? v : 0))
                if (videoRef.current) videoRef.current.currentTime = Math.max(0, isFinite(v) ? v : 0)
              }}
              className="mt-1.5 w-full accent-[#E1306C]"
              aria-label="Trim start"
            />
            <input
              type="range"
              min={0}
              max={Math.max(0.1, isFinite(duration) ? duration : 0.1)}
              step={0.1}
              value={trimEnd}
              onChange={(e) => {
                const v = Math.max(Number(e.target.value), trimStart + 0.5)
                setTrimEnd(Math.min(duration, isFinite(v) ? v : duration))
              }}
              className="w-full accent-[#F59E0B]"
              aria-label="Trim end"
            />
          </div>
          <p className="flex items-center justify-center gap-1.5 text-center text-[11.5px] text-white/50">
            <Check size={12} /> Only the selected segment is sent (full video sent if your browser can&apos;t trim)
          </p>
        </div>
      )}
    </div>
  )
}

function fmt(sec: number) {
  const s = Math.max(0, Math.floor(sec))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function extOf(mime: string, fallback: string): string {
  if (mime.includes('png')) return 'png'
  if (mime.includes('webp')) return 'webp'
  if (mime.includes('webm')) return 'webm'
  if (mime.includes('quicktime')) return 'mov'
  if (mime.includes('mp4')) return 'mp4'
  if (mime.includes('jpeg')) return 'jpg'
  return fallback
}

function useMemoObjectUrl(file: File): string {
  const [url] = useState(() => URL.createObjectURL(file))
  useEffect(() => () => URL.revokeObjectURL(url), [url])
  return url
}
