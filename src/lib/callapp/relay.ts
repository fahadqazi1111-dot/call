/**
 * Server-side relay to the CALL socket service (mini-services/call-service).
 * Next.js API routes cannot emit socket events directly — this posts to the
 * service's internal HTTP relay which fans events out to users / rooms /
 * live sessions. Failures are swallowed: the app still works, the realtime
 * animation/notification simply arrives on the next sync.
 */

const RELAY_SECRET = 'call-internal-relay-v1'
const RELAY_URL = process.env.CALL_RELAY_URL || 'http://127.0.0.1:3004/internal/relay'

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
    return res.ok
  } catch {
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
