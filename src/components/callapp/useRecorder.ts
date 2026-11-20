'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

export interface RecorderHandle {
  status: 'idle' | 'recording'
  seconds: number
  bars: number[]
  start: () => Promise<void>
  stop: () => Promise<{ blob: Blob; durationSec: number } | null>
  cancel: () => void
}

/** MediaRecorder-based voice note recorder with a live amplitude waveform. */
export function useRecorder(): RecorderHandle {
  const [status, setStatus] = useState<'idle' | 'recording'>('idle')
  const [seconds, setSeconds] = useState(0)
  const [bars, setBars] = useState<number[]>([])

  const recRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const ctxRef = useRef<AudioContext | null>(null)
  const rafRef = useRef<number | null>(null)
  const timerRef = useRef<number | null>(null)
  const startedAtRef = useRef(0)

  const cleanup = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    if (timerRef.current) window.clearInterval(timerRef.current)
    timerRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    void ctxRef.current?.close().catch(() => {})
    ctxRef.current = null
    chunksRef.current = []
    recRef.current = null
    setStatus('idle')
    setSeconds(0)
    setBars([])
  }, [])

  const start = useCallback(async () => {
    if (recRef.current) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      })
      streamRef.current = stream
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : ''
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      recRef.current = rec
      chunksRef.current = []
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      rec.start(250)
      startedAtRef.current = Date.now()

      // live waveform
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const ctx = new AC()
      ctxRef.current = ctx
      const src = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      src.connect(analyser)
      const buf = new Uint8Array(analyser.frequencyBinCount)
      const tick = () => {
        analyser.getByteTimeDomainData(buf)
        let sum = 0
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128
          sum += v * v
        }
        const rms = Math.sqrt(sum / buf.length)
        const h = Math.min(26, Math.max(5, Math.round(rms * 90)))
        setBars((prev) => [...prev.slice(-39), h])
        rafRef.current = requestAnimationFrame(() => window.setTimeout(tick, 80))
      }
      tick()

      timerRef.current = window.setInterval(() => {
        const s = Math.floor((Date.now() - startedAtRef.current) / 1000)
        setSeconds(s)
        if (s >= 300) {
          // auto-stop at 5 min handled by caller via stop()
        }
      }, 250)
      setStatus('recording')
    } catch {
      toast.error('Microphone permission is required to record voice messages.')
      cleanup()
    }
  }, [cleanup])

  const stop = useCallback(async (): Promise<{ blob: Blob; durationSec: number } | null> => {
    const rec = recRef.current
    if (!rec) return null
    const durationSec = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000))
    const done = new Promise<void>((resolve) => {
      if (rec.state === 'inactive') resolve()
      else {
        rec.onstop = () => resolve()
        rec.stop()
      }
    })
    await done
    await new Promise((r) => window.setTimeout(r, 120))
    const rawType = (rec.mimeType || 'audio/webm').split(';')[0]
    const blob = new Blob(chunksRef.current, { type: rawType })
    cleanup()
    if (!blob.size) return null
    return { blob, durationSec }
  }, [cleanup])

  const cancel = useCallback(() => {
    const rec = recRef.current
    if (rec && rec.state !== 'inactive') {
      rec.onstop = null
      try {
        rec.stop()
      } catch {}
    }
    cleanup()
  }, [cleanup])

  useEffect(() => cleanup, [cleanup])

  return { status, seconds, bars, start, stop, cancel }
}
