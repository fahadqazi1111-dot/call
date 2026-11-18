'use client'

import { useEffect, useRef, useState } from 'react'
import { Pause, Play } from 'lucide-react'
import { barsFromSeed, fmtDuration } from '@/lib/callapp/utils'
import type { Message } from '@/lib/callapp/types'

export function VoiceBubble({ msg, mine }: { msg: Message; mine: boolean }) {
  const url = `/api/media/${msg.content}`
  const bars = barsFromSeed(msg.id, 26)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [audioDuration, setAudioDuration] = useState<number | null>(null)
  const duration = audioDuration ?? msg.duration ?? 0

  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    const onTime = () => {
      if (el.duration && isFinite(el.duration) && el.duration > 0) {
        setProgress(el.currentTime / el.duration)
        if (!audioDuration) setAudioDuration(el.duration)
      } else {
        setProgress((t) => t)
      }
    }
    const onEnd = () => {
      setPlaying(false)
      setProgress(0)
      el.currentTime = 0
    }
    const onMeta = () => {
      if (isFinite(el.duration) && el.duration > 0) setAudioDuration(el.duration)
    }
    el.addEventListener('timeupdate', onTime)
    el.addEventListener('ended', onEnd)
    el.addEventListener('loadedmetadata', onMeta)
    return () => {
      el.removeEventListener('timeupdate', onTime)
      el.removeEventListener('ended', onEnd)
      el.removeEventListener('loadedmetadata', onMeta)
    }
  }, [audioDuration])

  const toggle = () => {
    const el = audioRef.current
    if (!el) return
    if (playing) {
      el.pause()
      setPlaying(false)
    } else {
      void el.play()
      setPlaying(true)
    }
  }

  const filled = Math.round(progress * bars.length)

  return (
    <div className="flex items-center gap-2.5" style={{ width: 236 }}>
      <button
        onClick={toggle}
        aria-label={playing ? 'Pause voice message' : 'Play voice message'}
        className={`flex h-10 w-10 flex-none items-center justify-center rounded-full ${
          mine ? 'bg-white text-cbrand' : 'bg-cbrand text-white'
        }`}
      >
        {playing ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" className="ml-0.5" />}
      </button>
      <div className="flex h-8 flex-1 items-center gap-[2.5px]">
        {bars.map((h, i) => (
          <span
            key={i}
            className="w-[3px] rounded-sm"
            style={{
              height: h,
              background: 'currentColor',
              opacity: i < filled ? 1 : 0.35,
              transition: 'opacity 0.1s linear',
            }}
          />
        ))}
      </div>
      <span className="min-w-[34px] text-right text-xs font-semibold opacity-85">{fmtDuration(duration)}</span>
      <audio ref={audioRef} src={url} preload="metadata" className="hidden" />
    </div>
  )
}
