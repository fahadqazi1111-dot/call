import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, getSetting, rateLimit } from '@/lib/callapp/server'

/** GET: live sessions currently broadcasting. */
export async function GET(req: Request) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
