import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/callapp/server'

/** GET: moderation lists — live rooms, live sessions, recent stories. */
export async function GET(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const [rooms, lives, stories] = await Promise.all([
    db.voiceRoom.findMany({
      where: { status: 'live' },
      include: { host: { select: { name: true } }, _count: { select: { participants: { where: { leftAt: null } } } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    db.liveSession.findMany({
      where: { status: 'live' },
      include: { host: { select: { name: true } } },
      orderBy: { startedAt: 'desc' },
      take: 50,
    }),
    db.story.findMany({ orderBy: { createdAt: 'desc' }, take: 50, include: { author: { select: { name: true } } } }),
  ])
  return NextResponse.json({
    rooms: rooms.map((r) => ({
      id: r.id, title: r.title, isPaid: r.isPaid, entryFee: r.entryFee,
      host: r.host.name, participants: r._count.participants, createdAt: r.createdAt.toISOString(),
    })),
    lives: lives.map((s) => ({
      id: s.id, title: s.title, mode: s.mode, viewerCount: s.viewerCount,
      host: s.host.name, startedAt: s.startedAt.toISOString(),
    })),
    stories: stories.map((s) => ({
      id: s.id, kind: s.kind, user: s.author.name, privacy: s.privacy, createdAt: s.createdAt.toISOString(),
    })),
  })
}

/** POST { type: 'room'|'live'|'story', id } — force end / delete. */
export async function POST(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  try {
    const body = await req.json()
    const type = String(body.type || '')
    const id = String(body.id || '')
    if (type === 'room') {
      await db.voiceRoom.update({ where: { id }, data: { status: 'ended', endedAt: new Date() } })
      await db.roomParticipant.updateMany({ where: { roomId: id, leftAt: null }, data: { leftAt: new Date() } })
    } else if (type === 'live') {
      await db.liveSession.update({ where: { id }, data: { status: 'ended', endedAt: new Date() } })
    } else if (type === 'story') {
      await db.story.delete({ where: { id } })
    } else {
      return NextResponse.json({ error: 'Unknown type' }, { status: 400 })
    }
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Action failed' }, { status: 500 })
  }
}
