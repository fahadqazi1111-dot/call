import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, getSetting, rateLimit } from '@/lib/callapp/server'

const RELAY_SECRET = 'call-internal-relay-v1'
// Default to the MAIN server's relay path. In production the relay is mounted
// on the same http server as Next.js (Hostinger: ONE port per process), so the
// relay base is http://127.0.0.1:${PORT}. When CALL_RELAY_URL is set (dev mode
// -> call-service on 3003), that takes precedence.
const RELAY_BASE = (
  process.env.CALL_RELAY_URL || `http://127.0.0.1:${process.env.PORT || '3000'}/internal/relay`
).replace('/internal/relay', '')

/**
 * Ghost-broadcast sweep: a live session whose host socket is no longer
 * connected (tab closed, camera failed, crash) would otherwise stay
 * `status: 'live'` forever and every viewer joining it would hang on an
 * endless preloader. The socket service is the source of truth for which
 * lives actually have a connected publisher — sessions without one (and
 * past the startup grace window) are ended here and their stale viewers
 * receive `live:ended` so their screens close gracefully.
 */
async function sweepGhostLives(): Promise<void> {
  try {
    const res = await fetch(`${RELAY_BASE}/internal/live-hosts`, {
      headers: { 'x-internal-secret': RELAY_SECRET },
      cache: 'no-store',
      signal: AbortSignal.timeout(2500),
    })
    if (!res.ok) return
    const data = (await res.json()) as { liveIds?: string[] }
    const hosted = new Set(data.liveIds ?? [])
    const stale = await db.liveSession.findMany({
      where: { status: 'live', startedAt: { lt: new Date(Date.now() - 45_000) } },
      select: { id: true },
    })
    const dead = stale.filter((s) => !hosted.has(s.id))
    if (!dead.length) return
    const ids = dead.map((s) => s.id)
    const now = new Date()
    await db.liveSession.updateMany({
      where: { id: { in: ids }, status: 'live' },
      data: { status: 'ended', endedAt: now },
    })
    for (const id of ids) {
      // release viewers stranded on the ghost broadcast
      await fetch(`${RELAY_BASE}/internal/relay`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-internal-secret': RELAY_SECRET },
        body: JSON.stringify({ targets: [`live:${id}`], event: 'internal:live_ended', data: { liveId: id } }),
        cache: 'no-store',
        signal: AbortSignal.timeout(2500),
      }).catch(() => {})
    }
  } catch {
    // socket service down — leave sessions alone, the next pass retries
  }
}

/** GET: live sessions currently broadcasting. */
export async function GET(req: Request) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await sweepGhostLives()
  const sessions = await db.liveSession.findMany({
    where: { status: 'live' },
    orderBy: { startedAt: 'desc' },
    take: 50,
    include: { host: { select: { id: true, name: true, avatarKey: true, avatarUrl: true } } },
  })
  const cfg = await getSetting<{ maxViewers: number; allowBattles: boolean; battleDurations: number[] }>('live', {
    maxViewers: 25,
    allowBattles: true,
    battleDurations: [60, 120, 180],
  })
  return NextResponse.json({
    sessions: sessions.map((s) => ({
      id: s.id,
      title: s.title,
      mode: s.mode,
      viewerCount: s.viewerCount,
      peakViewers: s.peakViewers,
      startedAt: s.startedAt.toISOString(),
      host: s.host,
      isMine: s.hostId === me.id,
    })),
    settings: cfg,
  })
}

/** POST { title, mode } — open a live session (host then starts publishing via socket). */
export async function POST(req: Request) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!rateLimit(`livecreate:${me.id}`, 5, 60_000)) {
    return NextResponse.json({ error: 'Too many sessions' }, { status: 429 })
  }
  try {
    const body = await req.json()
    const title = String(body.title || 'Live').trim().slice(0, 60) || 'Live'
    const mode = ['solo', 'battle'].includes(body.mode) ? body.mode : 'solo'
    const existing = await db.liveSession.findFirst({ where: { hostId: me.id, status: 'live' } })
    if (existing) {
      return NextResponse.json({ ok: true, session: { id: existing.id, mode: existing.mode }, resumed: true })
    }
    const session = await db.liveSession.create({ data: { hostId: me.id, title, mode } })
    return NextResponse.json({ ok: true, session: { id: session.id, mode: session.mode } })
  } catch {
    return NextResponse.json({ error: 'Create failed' }, { status: 500 })
  }
}
