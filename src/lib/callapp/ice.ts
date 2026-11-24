'use client'

/**
 * Shared WebRTC ICE / media-permission helpers used by every call manager
 * (1:1 calls, conferences, voice rooms, video live).
 *
 * Why this exists:
 *  - every manager used to hardcode its own ICE server list. They now share a
 *    single source of truth that is configurable at deploy time via env var,
 *    so a production deploy behind strict NAT can plug in a private TURN
 *    without touching code.
 *  - getUserMedia failures used to be swallowed as a generic "permission
 *    needed" toast. The helpers below surface the real DOMException name so
 *    the UI can show actionable guidance (padlock icon / device busy / etc.).
 */

/**
 * ICE servers used by every RTCPeerConnection.
 *
 * ORDER OF PREFERENCE:
 *   1. process.env.NEXT_PUBLIC_CALL_ICE_SERVERS (explicit override — for
 *      production scale, plug in your own dedicated TURN relay)
 *   2. Built-in FREE public STUN + TURN servers that work out of the box:
 *        - Google public STUN (fast, free, but STUN-only = same-network only)
 *        - OpenRelay public TURN (free, no signup required, crosses NAT)
 *
 * The OpenRelay TURN servers (openrelay.metered.ca) are a free public service
 * provided by Metered. They require NO signup, NO API key, and work on any
 * port (80, 443, TCP, UDP). This means calls work cross-network out of the box
 * — mobile 4G/5G users can call each other without any extra configuration.
 *
 * For production at scale, set your own TURN in .env to avoid rate limits:
 *   NEXT_PUBLIC_CALL_ICE_SERVERS='[{"urls":"stun:stun.l.google.com:19302"},{"urls":"turn:your-turn.com:3478","username":"u","credential":"c"}]'
 *
 * NOTE: NEXT_PUBLIC_* values are baked into the client bundle at build time.
 */
let cachedIceServers: RTCIceServer[] | null = null

export function getIceServers(): RTCIceServer[] {
  if (cachedIceServers) return cachedIceServers
  const raw = process.env.NEXT_PUBLIC_CALL_ICE_SERVERS
  if (raw) {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) {
        cachedIceServers = parsed as RTCIceServer[]
        return cachedIceServers
      }
    } catch (e) {
      // Bad env value must NEVER silently strand calls on no servers.
      console.warn('[callapp] NEXT_PUBLIC_CALL_ICE_SERVERS is set but is not valid JSON — falling back to default STUN+TURN.', e)
    }
  }
  // Defaults include FREE public TURN (OpenRelay by Metered) so calls work
  // cross-network out of the box. STUN is fast for same-network; TURN relays
  // traffic when STUN can't traverse symmetric NAT / CGNAT (mobile networks).
  cachedIceServers = [
    // Google public STUN — fast, free, works for same-network & cone NAT
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    // OpenRelay free public TURN — no signup required, crosses NAT/CGNAT.
    // UDP first (lower latency), then TCP (works through restrictive firewalls)
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ]
  return cachedIceServers
}

/** Full RTCConfiguration ready to pass straight into `new RTCPeerConnection`. */
export function getIceConfig(): RTCConfiguration {
  return {
    iceServers: getIceServers(),
    iceCandidatePoolSize: 4,
  }
}

/**
 * Coarse category of why a getUserMedia request failed, used by the live-broadcast
 * preflight (`liveManager.preflightCamera`) so the UI can render a SPECIFIC,
 * actionable error message instead of the old generic "no camera or microphone
 * was found" toast.
 *
 *   - 'camera'     → no camera device matched the request (mic is fine)
 *   - 'mic'        → no microphone device matched the request (camera is fine)
 *   - 'both'       → neither device could be opened (handled before probing,
 *                    or both probes failed)
 *   - 'permission' → user denied permission / iframe blocked the request
 *   - 'busy'       → NotReadableError / TrackStartError — another app holds it
 *   - 'unknown'    → AbortError, TypeError (no mediaDevices API in this
 *                    context), or anything else we don't recognise
 */
export type PreflightErrorKind = 'camera' | 'mic' | 'both' | 'permission' | 'busy' | 'unknown'

/**
 * Map a raw DOMException `.name` from a failed getUserMedia call to one of the
 * coarse `PreflightErrorKind` categories. Synchronous — does NOT probe each
 * device separately. When this returns `'both'`, the caller is expected to
 * probe audio-only and video-only to refine the kind to `'camera' | 'mic' | 'both'`.
 */
export function classifyMediaErrorName(name: string): PreflightErrorKind {
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
    case 'PermissionDeniedError':
      return 'permission'
    case 'NotReadableError':
    case 'TrackStartError':
      return 'busy'
    case 'NotFoundError':
    case 'OverconstrainedError':
    case 'DevicesNotFoundError':
      return 'both'
    default:
      return 'unknown'
  }
}

/**
 * Custom Error thrown by `liveManager.startPublishing` when getUserMedia fails
 * mid-broadcast-startup. It carries the original DOMException `name` (so the
 * legacy switch statements that inspect `e.name` keep working) PLUS a coarse
 * `kind` field for the new specific message rendering in LiveHostScreen.
 */
export class MediaFailure extends Error {
  kind: PreflightErrorKind
  constructor(name: string, kind: PreflightErrorKind) {
    super(name)
    this.name = name
    this.kind = kind
  }
}

/**
 * Translate a `PreflightErrorKind` (optionally refined by probing) into a
 * SPECIFIC user-facing { title, hint } pair for the Live broadcast screens.
 *
 * Used by both `LiveTab.GoLiveSheet` (the "Go live" sheet that runs preflight)
 * and `LiveHostScreen.startBroadcast` (which catches `MediaFailure` thrown by
 * `startPublishing` if the warm stream died between preflight and start).
 *
 * The strings here are intentionally short and actionable — they tell the
 * user exactly which device is missing or which browser control to click,
 * instead of the old generic "No camera or microphone was found on this device".
 */
export function describeLiveMediaError(
  kind: PreflightErrorKind,
  opts?: { embedded?: boolean }
): { title: string; hint: string } {
  const embedded = opts?.embedded ?? (typeof window !== 'undefined' && window.self !== window.top)
  switch (kind) {
    case 'camera':
      return {
        title: 'Camera not found',
        hint: "Check your device has a camera and it's not in use by another app.",
      }
    case 'mic':
      return {
        title: 'Microphone not found',
        hint: 'Check your device has a microphone.',
      }
    case 'both':
      return {
        title: 'Camera & microphone not found',
        hint: 'Connect a working camera and microphone, then try again.',
      }
    case 'permission':
      return {
        title: 'Camera & microphone permission denied',
        hint: embedded
          ? 'Embedded preview panes can block the camera even when the site permission is granted. Open CALL in its own browser tab and try again.'
          : 'Click the padlock icon in the address bar to allow camera + microphone for this site, then try again.',
      }
    case 'busy':
      return {
        title: 'Camera or microphone is busy',
        hint: 'Another app (Zoom / Meet / another tab) is using it. Close that app and try again.',
      }
    case 'unknown':
    default:
      return {
        title: 'Camera & microphone unavailable',
        hint: embedded
          ? 'Open CALL in its own browser tab and try again.'
          : 'Reload the page or open CALL in a new tab, then try again.',
      }
  }
}

/**
 * Translate a getUserMedia failure into a user-facing { title, hint } pair.
 *
 * Returns null for unknown / non-DOMException errors so the caller can show a
 * generic fallback. The strings here are intentionally short — callers pipe
 * them into `toast.error(title, { description: hint })`.
 */
export function describeMediaError(e: unknown, kind: 'audio' | 'video' | 'both'): { title: string; hint: string } | null {
  const name = e instanceof DOMException ? e.name : e instanceof Error ? e.name : ''
  const what = kind === 'video' ? 'camera and microphone' : kind === 'audio' ? 'microphone' : 'media devices'
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return {
        title: `${kind === 'video' ? 'Camera & microphone' : 'Microphone'} permission denied`,
        hint:
          'Click the padlock icon in the address bar, allow camera + microphone for this site, then reload the page and try again.',
      }
    case 'NotFoundError':
    case 'OverconstrainedError':
      return {
        title: `No ${kind === 'video' ? 'camera or microphone' : 'microphone'} found`,
        hint: 'Plug in a working device and try again. Some browsers also need a page reload after plugging it in.',
      }
    case 'NotReadableError':
    case 'TrackStartError':
      return {
        title: `${kind === 'video' ? 'Camera' : 'Microphone'} is busy`,
        hint: 'Another app (Zoom / Meet / another tab) is using it. Close that app and try again.',
      }
    case 'AbortError':
      return {
        title: `Could not start ${what}`,
        hint: 'The device started then stopped unexpectedly. Try again, or reload the page.',
      }
    default:
      return null
  }
}
