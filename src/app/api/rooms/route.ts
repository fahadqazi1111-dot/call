import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, getSetting, mediaUrl, rateLimit } from '@/lib/callapp/server'

/** GET: live voice rooms with participant counts. */
export async function GET(req: Request) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const rooms = await db.voiceRoom.findMany({
    where: { status: 'live' },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      _count: { select: { participants: { where: { leftAt: null } } } },
      host: { select: { id: true, name: true, avatarKey: true, avatarUrl: true } },
    },
  })
  const roomsCfg = await getSetting<{ maxEntryFee: number; allowPaidRooms: boolean; maxSpeakers: number }>('rooms', {
    maxSpeakers: 5,
    maxEntryFee: 5000,
    allowPaidRooms: true,
  })
  return NextResponse.json({
    rooms: rooms.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      coverUrl: mediaUrl(r.coverUrl, me.id),
      isPaid: r.isPaid,
      entryFee: r.entryFee,
      host: r.host,
      participants: r._count.participants,
      createdAt: r.createdAt.toISOString(),
    })),
    settings: roomsCfg,
  })
}

/** POST: create a voice room (free or paid). */
export async function POST(req: Request) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!rateLimit(`roomcreate:${me.id}`, 5, 60_000)) {
    return NextResponse.json({ error: 'Too many rooms created' }, { status: 429 })
  }
  try {
    const body = await req.json()
    const title = String(body.title || '').trim().slice(0, 60)
    const description = String(body.description || '').trim().slice(0, 200)
    const isPaid = !!body.isPaid
    const entryFee = Math.round((Number(body.entryFee) || 0) * 100) / 100
    if (!title) return NextResponse.json({ error: 'Room name required' }, { status: 400 })

    const cfg = await getSetting<{ maxSpeakers: number; maxEntryFee: number; allowPaidRooms: boolean }>('rooms', {
      maxSpeakers: 5,
      maxEntryFee: 50,
      allowPaidRooms: true,
    })
    if (isPaid && !cfg.allowPaidRooms) {
      return NextResponse.json({ error: 'Paid rooms are disabled by the admin' }, { status: 400 })
    }
    if (isPaid && (entryFee <= 0 || entryFee > cfg.maxEntryFee)) {
      return NextResponse.json(
        { error: `Entry fee must be between $0.50 and $${cfg.maxEntryFee}` },
        { status: 400 }
      )
    }

    const room = await db.voiceRoom.create({
      data: {
        hostId: me.id,
        title,
        description,
        isPaid,
        entryFee: isPaid ? entryFee : 0,
      },
    })
    await db.roomParticipant.create({
      data: { roomId: room.id, userId: me.id, role: 'host' },
    })
    return NextResponse.json({ ok: true, room: { id: room.id, title: room.title } })
  } catch {
    return NextResponse.json({ error: 'Create room failed' }, { status: 500 })
  }
}
