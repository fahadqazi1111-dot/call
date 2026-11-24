/**
 * Server-side relay to the CALL socket service (mini-services/call-service).
 * Next.js API routes cannot emit socket events directly — this posts to the
 * service's internal HTTP relay which fans events out to users / rooms /
 * live sessions. Failures are swallowed: the app still works, the realtime
 * animation/notification simply arrives on the next sync.
 */

const RELAY_SECRET = 'call-internal-relay-v1'
// Default to the MAIN server's relay path (http://127.0.0.1:${PORT}/internal/relay).
// In production PORT is the single port the whole process listens on (the relay
// is mounted on the same http server as Next.js + socket.io — Hostinger shared
// hosting only allows ONE port per process). When CALL_RELAY_URL is set
// explicitly (dev mode -> call-service on 3003), that takes precedence.
//
// DEV FALLBACK: in the sandbox the call-service runs on its own port (3003) and
// Next.js runs on 3000, so `http://127.0.0.1:3000/internal/relay` returns 404.
// Without this dev-mode default every relaySend (room:closed, internal:room_sync,
// internal:room_closed, room:gift, …) silently fails — voice-room moderation,
// end-room fan-out and gift broadcasts all break. Detect dev mode and target the
// call-service port directly.
const DEV_RELAY_URL = 'http://127.0.0.1:3003/internal/relay'
const RELAY_URL =
  process.env.CALL_RELAY_URL ||
  (process.env.NODE_ENV === 'production'
    ? `http://127.0.0.1:${process.env.PORT || '3000'}/internal/relay`
    : DEV_RELAY_URL)

/** targets: ['user:<id>', 'room:<id>', 'live:<id>', 'all'] */
export async function relaySend(targets: string[], event: string, data: unknown): Promise<boolean> {
  if (!targets.length || !event) return false
  try {
    const res = await fetch(RELAY_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-internal-secret': RELAY_SECRET },
      body: JSON.stringify({ targets, event, data }),
      cache: 'no-store',
      signal: AbortSignal.timeout(2500),
    })
    if (!res.ok) {
      console.error(`relay FAILED (${res.status}) event=${event} targets=${targets.join(',')} — is the call-service running?`)
      return false
    }
    return true
  } catch (e) {
    console.error(`relay FAILED event=${event} targets=${targets.join(',')}:`, e instanceof Error ? e.message : e, '— is the call-service running?')
    return false
  }
}

export function relayToUser(userId: string, event: string, data: unknown) {
  return relaySend([`user:${userId}`], event, data)
}

export function relayToRoom(roomId: string, event: string, data: unknown) {
  return relaySend([`room:${roomId}`], event, data)
}

export function relayToLive(liveId: string, event: string, data: unknown) {
  return relaySend([`live:${liveId}`], event, data)
}
