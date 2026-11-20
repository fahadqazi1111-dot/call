import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/callapp/server'

const RELAY_SECRET = 'call-internal-relay-v1'
// Default to the MAIN server's relay path. In production the relay is mounted
// on the same http server as Next.js (Hostinger: ONE port per process), so the
// relay base is http://127.0.0.1:${PORT}. When CALL_RELAY_URL is set (dev mode
// -> call-service on 3003), that takes precedence.
const RELAY_BASE = (
  process.env.CALL_RELAY_URL || `http://127.0.0.1:${process.env.PORT || '3000'}/internal/relay`
).replace('/internal/relay', '')

/**
 * GET /api/live/<id>/viewers — the live audience list for the host's
 * "pick from audience" battle sheet. Sourced from the socket service's
 * in-memory viewer map (real people currently connected to this live).
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const me = await requireUser(_req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const live = await db.liveSession.findUnique({ where: { id }, select: { hostId: true } })
  if (!live) return NextResponse.json({ error: 'Live not found' }, { status: 404 })
  if (live.hostId !== me.id && me.role !== 'admin') {
    return NextResponse.json({ error: 'Only the host can see the audience' }, { status: 403 })
  }
  try {
    const res = await fetch(`${RELAY_BASE}/internal/live-viewers?liveId=${encodeURIComponent(id)}`, {
      headers: { 'x-internal-secret': RELAY_SECRET },
      cache: 'no-store',
      signal: AbortSignal.timeout(3000),
    })
    if (res.ok) {
      const data = (await res.json()) as { viewers?: Array<{ userId: string; name: string; avatarKey: number; avatarUrl: string | null }> }
      return NextResponse.json({
        viewers: (data.viewers ?? []).filter((v) => v.userId !== me.id),
      })
    }
  } catch {}
  return NextResponse.json({ viewers: [] })
}
