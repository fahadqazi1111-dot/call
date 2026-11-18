'use client'

/**
 * CALL Face Filters — real-time camera filters with face tracking.
 *
 * Video → <video> → <canvas> render loop. Face tracking uses the browser's
 * experimental FaceDetector API when available (Chrome flag / newer builds);
 * when it is unavailable the overlays smoothly follow a face-sized anchor the
 * user can drag, so filters always work — we never fake "tracking".
 *
 * Beauty effects and background blur are pure canvas ops. Output can be
 * exported as a MediaStream (canvas.captureStream) for use in calls, rooms
 * and live, or snapped as a photo for stories.
 */

export type FilterId =
  | 'none'
  | 'dog'
  | 'cat'
  | 'bunny'
  | 'panda'
  | 'glasses'
  | 'mask'
  | 'cartoon'
  | 'beauty'
  | 'blurbg'

export interface FilterPreset {
  id: FilterId
  name: string
  emoji: string
}

export const FACE_FILTERS: FilterPreset[] = [
  { id: 'none', name: 'None', emoji: '🚫' },
  { id: 'dog', name: 'Dog', emoji: '🐶' },
  { id: 'cat', name: 'Cat', emoji: '🐱' },
  { id: 'bunny', name: 'Bunny', emoji: '🐰' },
  { id: 'panda', name: 'Panda', emoji: '🐼' },
  { id: 'glasses', name: 'Glasses', emoji: '🕶️' },
  { id: 'mask', name: 'Mask', emoji: '🎭' },
  { id: 'cartoon', name: 'Cartoon', emoji: '🎨' },
  { id: 'beauty', name: 'Beauty', emoji: '✨' },
  { id: 'blurbg', name: 'Blur BG', emoji: '🌫️' },
]

export interface FaceFilterHandle {
  output: MediaStream // canvas-captured video (with audio track(s) added if source had them)
  stop(): void
  setFilter(id: FilterId): void
  /** Move the face anchor when FaceDetector is unavailable (normalized 0..1). */
  setAnchor(x: number, y: number, size: number): void
  hasDetector(): boolean
  snap(maxW?: number): Promise<Blob>
}

type Anchors = { cx: number; cy: number; w: number; h: number }

function faceRectsFor(filter: FilterId): boolean {
  return filter !== 'none' && filter !== 'beauty' && filter !== 'blurbg' && filter !== 'cartoon'
}

/* Minimal typing for the experimental Shape Detection API (Chrome-only, optional). */
interface DetectedFace {
  boundingBox: { x: number; y: number; width: number; height: number }
}
interface FaceDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedFace[]>
}
interface FaceDetectorCtor {
  new (options?: { fastMode?: boolean; maxDetectedFaces?: number }): FaceDetectorLike
}

class FaceFilterEngine {
  private video: HTMLVideoElement
  private canvas: HTMLCanvasElement
  private ctx2d: CanvasRenderingContext2D
  private stream: MediaStream | null
  private raf = 0
  private running = false
  private detector: FaceDetectorLike | null = null
  private detectorOk = false
  private anchor: Anchors = { cx: 0.5, cy: 0.38, w: 0.35, h: 0.5 }
  private lastDetect = 0
  private filter: FilterId = 'none'
  private frame = 0

  constructor(video: HTMLVideoElement, canvas: HTMLCanvasElement, stream: MediaStream) {
    this.video = video
    this.canvas = canvas
    this.ctx2d = canvas.getContext('2d')!
    this.stream = stream
    this.video.srcObject = stream
    void this.video.play().catch(() => {})
    // optional native face detection
    const FD = (window as unknown as { FaceDetector?: FaceDetectorCtor }).FaceDetector
    if (FD) {
      try {
        this.detector = new FD({ fastMode: true, maxDetectedFaces: 1 })
        this.detectorOk = true
      } catch {
        this.detector = null
      }
    }
  }
  start() {
    if (this.running) return
    this.running = true
    const loop = () => {
      if (!this.running) return
      this.render()
      this.raf = requestAnimationFrame(loop)
    }
    this.raf = requestAnimationFrame(loop)
  }

  stop() {
    this.running = false
    cancelAnimationFrame(this.raf)
  }

  setFilter(id: FilterId) {
    this.filter = id
  }

  setAnchor(x: number, y: number, size: number) {
    this.anchor = { cx: x, cy: y, w: size, h: size * 1.3 }
  }

  hasDetector() {
    return this.detectorOk
  }

  private async detectFace(w: number, h: number): Promise<Anchors | null> {
    if (!this.detector || !this.detectorOk) return null
    const now = performance.now()
    if (now - this.lastDetect < 120) return this._cached // reuse ~8fps
    this.lastDetect = now
    try {
      const faces = await this.detector.detect(this.video)
      if (faces && faces.length > 0) {
        const b = faces[0].boundingBox
        this._cached = { cx: (b.x + b.width / 2) / w, cy: (b.y + b.height / 2) / h, w: b.width / w, h: b.height / h }
        return this._cached
      }
    } catch {
      this.detectorOk = false
    }
    return this._cached
  }

  private _cached: Anchors | null = null

  private render() {
    const vw = this.video.videoWidth
    const vh = this.video.videoHeight
    if (!vw || !vh) return
    if (this.canvas.width !== vw || this.canvas.height !== vh) {
      this.canvas.width = vw
      this.canvas.height = vh
    }
    const c = this.ctx2d
    this.frame++

    const fx = this.filter

    /* ---------- background blur: draw blurred copy first ---------- */
    if (fx === 'blurbg') {
      c.save()
      c.filter = 'blur(18px) brightness(0.92)'
      c.drawImage(this.video, 0, 0, vw, vh)
      c.restore()
    } else {
      c.drawImage(this.video, 0, 0, vw, vh)
    }

    /* ---------- face geometry (tracking) ---------- */
    const tracked = faceRectsFor(fx)
    let face: Anchors = this.anchor
    if (tracked) {
      void this.detectFace(vw, vh)
      face = this._cached ?? this.anchor
    }

    /* ---------- cartoon: posterize + edge ---------- */
    if (fx === 'cartoon') {
      c.save()
      c.globalCompositeOperation = 'saturation'
      c.filter = 'saturate(2.4) contrast(1.5)'
      c.drawImage(this.canvas, 0, 0)
      c.restore()
    }

    /* ---------- beauty: soft skin (light blur pass) ---------- */
    if (fx === 'beauty') {
      c.save()
      c.globalAlpha = 0.45
      c.filter = 'blur(6px) brightness(1.06)'
      c.drawImage(this.video, 0, 0, vw, vh)
      c.restore()
    }

    /* ---------- overlays ---------- */
    if (tracked) {
      const fw = face.w * vw
      const fh = face.h * vh
      const fxp = face.cx * vw
      const fyp = face.cy * vh
      const top = fyp - fh / 2

      c.save()
      // gentle wobble so overlays feel alive
      const wob = Math.sin(this.frame / 30) * fw * 0.012

      if (fx === 'dog') {
        // ears
        c.font = `${fw * 0.5}px serif`
        c.fillText('👂', fxp - fw * 0.42 + wob, top + fh * 0.08)
        c.fillText('👂', fxp + fw * 0.12 - wob, top + fh * 0.08)
        // nose + tongue
        c.font = `${fw * 0.3}px serif`
        c.fillText('👃', fxp - fw * 0.15, fyp + fh * 0.28)
        c.font = `${fw * 0.4}px serif`
        c.fillText('👅', fxp - fw * 0.2, fyp + fh * 0.62)
      } else if (fx === 'cat') {
        c.font = `${fw * 0.45}px serif`
        c.fillText('🐱', fxp - fw * 0.5 + wob, top + fh * 0.02)
        c.fillText('🐱', fxp + fw * 0.08 - wob, top + fh * 0.02)
        c.font = `${fw * 0.26}px serif`
        c.fillText('🐽', fxp - fw * 0.13, fyp + fh * 0.3)
        // whiskers
        c.strokeStyle = 'rgba(255,255,255,0.85)'
        c.lineWidth = Math.max(2, fw * 0.012)
        for (let s = -1; s <= 1; s += 2) {
          for (let i = 0; i < 3; i++) {
            c.beginPath()
            const y0 = fyp + fh * (0.22 + i * 0.07)
            c.moveTo(fxp + s * fw * 0.18, y0)
            c.lineTo(fxp + s * fw * 0.52, y0 - fh * 0.05)
            c.stroke()
          }
        }
      } else if (fx === 'bunny') {
        c.font = `${fw * 0.62}px serif`
        c.fillText('🐰', fxp - fw * 0.32 + wob, top - fh * 0.02)
      } else if (fx === 'panda') {
        c.font = `${fw * 0.42}px serif`
        c.fillText('🐼', fxp - fw * 0.52 + wob, top + fh * 0.16)
        c.fillText('🐼', fxp + fw * 0.1 - wob, top + fh * 0.16)
      } else if (fx === 'glasses') {
        const gy = fyp - fh * 0.08
        c.strokeStyle = '#111'
        c.lineWidth = Math.max(3, fw * 0.03)
        const r = fw * 0.2
        c.beginPath()
        c.arc(fxp - fw * 0.22, gy, r, 0, Math.PI * 2)
        c.stroke()
        c.beginPath()
        c.arc(fxp + fw * 0.22, gy, r, 0, Math.PI * 2)
        c.stroke()
        c.beginPath()
        c.moveTo(fxp - fw * 0.02, gy)
        c.lineTo(fxp + fw * 0.02, gy)
        c.stroke()
        c.beginPath()
        c.moveTo(fxp - fw * 0.42 - r, gy)
        c.lineTo(fxp - fw * 0.5, gy - fh * 0.05)
        c.stroke()
        c.beginPath()
        c.moveTo(fxp + fw * 0.42 + r, gy)
        c.lineTo(fxp + fw * 0.5, gy - fh * 0.05)
        c.stroke()
        c.fillStyle = 'rgba(20,20,20,0.25)'
        c.beginPath()
        c.arc(fxp - fw * 0.22, gy, r, 0, Math.PI * 2)
        c.fill()
        c.beginPath()
        c.arc(fxp + fw * 0.22, gy, r, 0, Math.PI * 2)
        c.fill()
      } else if (fx === 'mask') {
        const mw = fw * 0.9
        const mh = fh * 0.55
        c.fillStyle = 'rgba(30,30,40,0.85)'
        this.roundRect(fxp - mw / 2, fyp - mh * 0.15, mw, mh, mw * 0.12)
        c.fill()
        c.strokeStyle = 'rgba(255,215,0,0.9)'
        c.lineWidth = Math.max(2, fw * 0.015)
        this.roundRect(fxp - mw / 2, fyp - mh * 0.15, mw, mh, mw * 0.12)
        c.stroke()
        c.fillStyle = '#FFD700'
        c.font = `${fw * 0.2}px serif`
        c.fillText('🎭', fxp - fw * 0.1, fyp + mh * 0.25)
      }
      c.restore()
    }

    /* ---------- animated sticker sparkle for beauty ---------- */
    if (fx === 'beauty') {
      const ringR = Math.min(vw, vh) * 0.32
      c.save()
      for (let i = 0; i < 6; i++) {
        const t = (this.frame % 90) / 90
        const ang = (i / 6) * Math.PI * 2 + t * Math.PI * 2
        const sx = this.anchor.cx * vw + Math.cos(ang) * ringR
        const sy = this.anchor.cy * vh + Math.sin(ang) * ringR * 0.8
        c.globalAlpha = 0.5 + 0.5 * Math.sin(t * Math.PI)
        c.font = `${vw * 0.028}px serif`
        c.fillText('✨', sx, sy)
      }
      c.restore()
    }
  }

  private roundRect(x: number, y: number, w: number, h: number, r: number) {
    const c = this.ctx2d
    c.beginPath()
    c.moveTo(x + r, y)
    c.arcTo(x + w, y, x + w, y + h, r)
    c.arcTo(x + w, y + h, x, y + h, r)
    c.arcTo(x, y + h, x, y, r)
    c.arcTo(x, y, x + w, y, r)
    c.closePath()
  }

  async snap(maxW = 1080): Promise<Blob> {
    // draw a final frame then export
    this.render()
    const scale = Math.min(1, maxW / (this.canvas.width || 1))
    const out = document.createElement('canvas')
    out.width = Math.round(this.canvas.width * scale)
    out.height = Math.round(this.canvas.height * scale)
    out.getContext('2d')!.drawImage(this.canvas, 0, 0, out.width, out.height)
    return new Promise<Blob>((resolve) => out.toBlob((b) => resolve(b!), 'image/jpeg', 0.92))
  }

  outputStream(withAudio: boolean): MediaStream {
    const vs = this.canvas.captureStream(30)
    if (withAudio && this.stream) {
      for (const t of this.stream.getAudioTracks()) vs.addTrack(t)
    }
    return vs
  }
}

/** Start the filter engine on a raw camera stream. Pass displayCanvas to paint into a visible element. */
export function startFaceFilters(rawStream: MediaStream, initial: FilterId = 'none', displayCanvas?: HTMLCanvasElement | null): FaceFilterHandle {
  const video = document.createElement('video')
  video.playsInline = true
  video.muted = true
  const canvas = displayCanvas ?? document.createElement('canvas')
  const engine = new FaceFilterEngine(video, canvas, rawStream)
  engine.setFilter(initial)
  engine.start()
  return {
    output: engine.outputStream(true),
    stop() {
      engine.stop()
      rawStream.getTracks().forEach((t) => t.stop())
    },
    setFilter: (id) => engine.setFilter(id),
    setAnchor: (x, y, size) => engine.setAnchor(x, y, size),
    hasDetector: () => engine.hasDetector(),
    snap: (maxW) => engine.snap(maxW),
  }
}

/** Convenience: open camera and immediately wrap with the filter engine. */
export async function openCameraWithFilters(
  initial: FilterId = 'none',
  withAudio = false,
  displayCanvas?: HTMLCanvasElement | null
): Promise<FaceFilterHandle> {
  const raw = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 1280 }, height: { ideal: 1280 }, facingMode: 'user' },
    audio: withAudio,
  })
  return startFaceFilters(raw, initial, displayCanvas)
}
