'use client'

/**
 * Gift media preloader — kills the "gift animation lags / sound comes late"
 * problem on the host + listener side.
 *
 *  - VIDEOS: the cinematic MP4 clips are 1.4-5MB. `GiftVideoScene` used to
 *    mount the <video> only when the choreography delay fired, so the first
 *    gift had to DOWNLOAD the clip before anything appeared (the "lag").
 *    Now the download starts the moment the gift payload arrives
 *    (ensureGiftVideo, called from animFromPayload) — the clip is fetched
 *    DURING the TikTok banner-then-animation pause and plays from a blob URL
 *    with zero wait. preloadGiftMedia() additionally warm-caches every clip
 *    sequentially (lowest priority) while a live/room screen is open.
 *
 *  - SOUNDS: soundKit.primeGiftSfx() (fired here + on the first user gesture)
 *    fetches + decodes every gift SFX into AudioBuffers, so playback is
 *    instant and immune to the HTMLAudio autoplay rejection that made the
 *    host/listeners hear the wrong (synthesized) effect.
 */

export const GIFT_VIDEOS: Record<string, string> = {
  lion: '/gifts/videos/lion.mp4',
  superlion: '/gifts/videos/superlion.mp4',
  galaxy: '/gifts/videos/galaxy.mp4',
  car: '/gifts/videos/car.mp4',
  dragon: '/gifts/videos/dragon.mp4',
  rocket: '/gifts/videos/rocket.mp4',
  fireworks: '/gifts/videos/fireworks.mp4',
  crown: '/gifts/videos/crown.mp4',
  castle: '/gifts/videos/castle.mp4',
  heart: '/gifts/videos/heart.mp4',
  rose: '/gifts/videos/rose.mp4',
}

export const VIDEO_CLIP_MS = 5400

export function giftVideoFor(kind: string): string | null {
  return GIFT_VIDEOS[kind] ?? null
}

/* ---------------- video blob cache ---------------- */

const videoUrls = new Map<string, string>()
const videoInflight = new Map<string, Promise<string>>()

/** Resolved (blob) URL if the clip finished downloading — sync peek, no I/O. */
export function preloadedGiftVideoUrl(kind: string): string | null {
  return videoUrls.get(kind) ?? null
}

/**
 * Start (or join) the download for one gift clip and resolve to a blob URL.
 * Safe to call many times — in-flight downloads are shared, results cached
 * for the whole session. HTTP cache (force-cache) keeps repeat fetches free.
 */
export function ensureGiftVideo(kind: string): Promise<string> {
  const cached = videoUrls.get(kind)
  if (cached) return Promise.resolve(cached)
  const src = GIFT_VIDEOS[kind]
  if (!src) return Promise.reject(new Error(`no video for gift kind: ${kind}`))
  const inflight = videoInflight.get(kind)
  if (inflight) return inflight
  const p = (async () => {
    try {
      const res = await fetch(src, { cache: 'force-cache' })
      if (!res.ok) throw new Error(`gift video fetch failed: ${res.status}`)
      const url = URL.createObjectURL(await res.blob())
      videoUrls.set(kind, url)
      return url
    } finally {
      videoInflight.delete(kind)
    }
  })()
  videoInflight.set(kind, p)
  return p
}

/** Most-used clips first so the warm-up helps the common gifts earliest. */
const WARM_ORDER = ['lion', 'galaxy', 'rose', 'heart', 'fireworks', 'car', 'crown', 'dragon', 'rocket', 'castle', 'superlion']

let warmStarted = false

/**
 * Background warm-up for a live/room screen: decode every gift SFX into
 * AudioBuffers, then fetch the video clips ONE at a time (lowest priority —
 * never competes with the broadcast for bandwidth for more than one file).
 * Failures are silent — every consumer falls back to the raw path / synth.
 */
export function preloadGiftMedia(): void {
  if (typeof window === 'undefined') return
  // sounds first (small, instantly useful)
  void import('./sound').then((m) => m.soundKit.primeGiftSfx()).catch(() => {})
  if (warmStarted) return
  warmStarted = true
  const warmNext = async () => {
    for (const kind of WARM_ORDER) {
      if (!GIFT_VIDEOS[kind] || videoUrls.has(kind)) continue
      try {
        await ensureGiftVideo(kind)
      } catch {
        /* keep warming the rest */
      }
      // let the network breathe between heavy clips
      await new Promise((r) => window.setTimeout(r, 250))
    }
  }
  // start after the broadcast pipeline has settled
  window.setTimeout(() => void warmNext(), 1500)
}
