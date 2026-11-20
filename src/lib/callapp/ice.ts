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
