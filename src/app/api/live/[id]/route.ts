import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/callapp/server'

/** GET: live session detail. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params
  const s = await db.liveSession.findUnique({
    where: { id },
    include: { host: { select: { id: true, name: true, avatarKey: true, avatarUrl: true } } },
  })
  if (!s) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({
    session: {
      id: s.id,
      title: s.title,
      status: s.status,
      mode: s.mode,
      battleId: s.battleId,
      viewerCount: s.viewerCount,
      peakViewers: s.peakViewers,
      startedAt: s.startedAt.toISOString(),
      host: s.host,
      isMine: s.hostId === me.id,
    },
  })
}

/** POST { viewerCount, peak } — host heartbeat persisting viewer stats from socket truth. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params
  const s = await db.liveSession.findUnique({ where: { id } })
  if (!s || s.hostId !== me.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  try {
    const body = await req.json()
    const viewerCount = Math.max(0, Math.floor(Number(body.viewerCount) || 0))
    await db.liveSession.update({
      where: { id },
      data: {
        viewerCount,
        peakViewers: Math.max(s.peakViewers, viewerCount),
      },
    })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

/** DELETE: end the broadcast (host or admin). */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params
  const s = await db.liveSession.findUnique({ where: { id } })
  if (!s) return NextResponse.json({ ok: true })
  if (s.hostId !== me.id && me.role !== 'admin') {
    return NextResponse.json({ error: 'Only the host can end the live' }, { status: 403 })
  }
  await db.liveSession.update({ where: { id }, data: { status: 'ended', endedAt: new Date() } })
  const battle = s.battleId
    ? await db.battle.findUnique({ where: { id: s.battleId }, include: { participants: true } })
    : null
  if (battle && battle.status !== 'ended') {
    const best = battle.participants.reduce(
      (acc, p) => (acc.side === -1 || p.score > acc.score ? { side: p.side, score: p.score } : acc),
      { side: -1, score: -1 }
    )
    await db.battle.update({
      where: { id: battle.id },
      data: { status: 'ended', endedAt: new Date(), winnerSide: best.side >= 0 ? best.side : null },
    })
  }
  return NextResponse.json({ ok: true })
}
