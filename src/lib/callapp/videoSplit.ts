'use client'

/**
 * Story video splitter — a long video is divided into sequential clips
 * (default max 60s each, whole story up to ~3 minutes), recorded via canvas
 * capture + MediaRecorder, like WhatsApp Status sequencing.
 */

export interface StoryClip {
  blob: Blob
  durationMs: number
  index: number
}

export interface SplitProgress {
  clipIndex: number
  clipCount: number
  clipProgress: number // 0..1
}

export const MAX_CLIP_MS = 60_000
export const MAX_TOTAL_MS = 180_000

/**
 * Split a video file into clips. If duration <= maxClipMs, returns the raw
 * file untouched (no re-encode, original quality preserved).
 */
export async function splitVideoForStory(
  file: File,
  onProgress?: (p: SplitProgress) => void,
  maxClipMs = MAX_CLIP_MS,
  maxTotalMs = MAX_TOTAL_MS
): Promise<StoryClip[]> {
  const url = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.src = url
  video.muted = false
  video.playsInline = true
  video.preload = 'auto'

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve()
    video.onerror = () => reject(new Error('Could not read video'))
  })

  const totalMs = Math.min(maxTotalMs, Math.floor(video.duration * 1000) || 0)
  if (!totalMs) {
    URL.revokeObjectURL(url)
    throw new Error('Unsupported video')
  }
  if (video.duration * 1000 <= maxClipMs) {
    URL.revokeObjectURL(url)
    return [{ blob: file, durationMs: Math.round(video.duration * 1000), index: 0 }]
  }

  const clipCount = Math.ceil(totalMs / maxClipMs)
  const clips: StoryClip[] = []
  const vw = video.videoWidth
  const vh = video.videoHeight
  const scale = Math.min(1, 720 / Math.max(vw, vh))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(vw * scale)
  canvas.height = Math.round(vh * scale)
  const ctx = canvas.getContext('2d')!

  // audio from the element, split per clip
  const Ctx: typeof AudioContext = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  const actx = new Ctx()
  const audioSrc = actx.createMediaElementSource(video)
  const audioDest = actx.createMediaStreamDestination()
  audioSrc.connect(audioDest)

  const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
    ? 'video/webm;codecs=vp9,opus'
    : 'video/webm;codecs=vp8,opus'

  for (let i = 0; i < clipCount; i++) {
    const startMs = i * maxClipMs
    const endMs = Math.min(totalMs, startMs + maxClipMs)
    video.currentTime = startMs / 1000
    await new Promise<void>((resolve) => {
      const onSeek = () => {
        video.removeEventListener('seeked', onSeek)
        resolve()
      }
      video.addEventListener('seeked', onSeek)
    })

    const canvasStream = canvas.captureStream(30)
    for (const t of audioDest.stream.getAudioTracks()) canvasStream.addTrack(t)
    const rec = new MediaRecorder(canvasStream, { mimeType: mime, videoBitsPerSecond: 2_500_000 })
    const chunks: Blob[] = []
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data)
    }
    const done = new Promise<void>((resolve) => {
      rec.onstop = () => resolve()
    })
    rec.start(250)

    // play through the segment, drawing frames
    await new Promise<void>((resolve) => {
      const onTime = () => {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        onProgress?.({
          clipIndex: i,
          clipCount,
          clipProgress: Math.min(1, (video.currentTime * 1000 - startMs) / (endMs - startMs)),
        })
        if (video.currentTime * 1000 >= endMs || video.ended) {
          video.removeEventListener('timeupdate', onTime)
          video.pause()
          resolve()
        }
      }
      video.addEventListener('timeupdate', onTime)
      void video.play().catch(() => {
        video.removeEventListener('timeupdate', onTime)
        resolve()
      })
    })

    rec.stop()
    await done
    clips.push({ blob: new Blob(chunks, { type: 'video/webm' }), durationMs: endMs - startMs, index: i })
  }

  audioSrc.disconnect()
  void actx.close()
  URL.revokeObjectURL(url)
  return clips
}
