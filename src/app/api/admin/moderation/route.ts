import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, requireStaff } from '@/lib/callapp/server'

/** GET: moderation lists — live rooms, live sessions, recent stories + user reports queue. */
export async function GET(req: Request) {
  const admin = await requireStaff(req)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const [rooms, lives, stories, reports] = await Promise.all([
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
    // every open report + reports closed in the last 7 days
    db.userReport.findMany({
      where: {
        OR: [{ status: 'open' }, { resolvedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }],
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        reporter: { select: { id: true, name: true, username: true, blocked: true } },
        reported: { select: { id: true, name: true, username: true, blocked: true } },
      },
    }),
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
    reports: reports.map((r) => ({
      id: r.id,
      reporter: { id: r.reporter.id, name: r.reporter.name, username: r.reporter.username, blocked: r.reporter.blocked },
      reported: { id: r.reported.id, name: r.reported.name, username: r.reported.username, blocked: r.reported.blocked },
      reason: r.reason,
      details: r.details,
      messageId: r.messageId,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    })),
  })
}

/** POST { type: 'room'|'live'|'story'|'report', id, action?, note? } — force end / delete / moderate. */
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
    } else if (type === 'report') {
      const action = String(body.action || '')
      const note = typeof body.note === 'string' && body.note ? body.note : null
      const report = await db.userReport.findUnique({ where: { id } })
      if (!report) return NextResponse.json({ error: 'Report not found' }, { status: 404 })
      if (action === 'resolve' || action === 'dismiss') {
        await db.userReport.update({
          where: { id },
          data: {
            status: action === 'resolve' ? 'resolved' : 'dismissed',
            adminNote: note,
            resolvedBy: admin.id,
            resolvedAt: new Date(),
          },
        })
      } else if (action === 'ban') {
        // ban the reported user AND close the report as resolved
        await db.user.update({ where: { id: report.reportedId }, data: { blocked: true } })
        await db.userReport.update({
          where: { id },
          data: {
            status: 'resolved',
            adminNote: note,
            resolvedBy: admin.id,
            resolvedAt: new Date(),
          },
        })
      } else {
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
      }
    } else {
      return NextResponse.json({ error: 'Unknown type' }, { status: 400 })
    }
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Action failed' }, { status: 500 })
  }
}
