import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, mediaUrl } from '@/lib/callapp/server'
import { relayToRoom, relaySend } from '@/lib/callapp/roomSync'

/** GET: room detail (meta + my membership). Active participant state comes from the socket service. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params
  const room = await db.voiceRoom.findUnique({
    where: { id },
    include: { host: { select: { id: true, name: true, avatarKey: true, avatarUrl: true } } },
  })
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 })
  const mine = await db.roomParticipant.findUnique({
    where: { roomId_userId: { roomId: id, userId: me.id } },
  })
  return NextResponse.json({
    room: {
      id: room.id,
      title: room.title,
      description: room.description,
      coverUrl: mediaUrl(room.coverUrl, me.id),
      isPaid: room.isPaid,
      entryFee: room.entryFee,
      status: room.status,
      createdAt: room.createdAt.toISOString(),
      host: room.host,
    },
    membership: mine
      ? { role: mine.role, blocked: mine.blocked, entryPaid: !!mine.joinedAt }
      : null,
  })
}

/** DELETE: host (or admin) ends the room. */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params
  const room = await db.voiceRoom.findUnique({ where: { id } })
  if (!room) return NextResponse.json({ ok: true })
  if (room.hostId !== me.id && me.role !== 'admin') {
    return NextResponse.json({ error: 'Only the host can end the room' }, { status: 403 })
  }
  await db.voiceRoom.update({ where: { id }, data: { status: 'ended', endedAt: new Date() } })
  await db.roomParticipant.updateMany({ where: { roomId: id, leftAt: null }, data: { leftAt: new Date() } })
  // everyone in the room (including this host) learns the room ended —
  // server-side only, clients can never fake a room closure
  await relayToRoom(id, 'room:closed', { roomId: id })
  await relaySend([`room:${id}`], 'internal:room_closed', { roomId: id })
  return NextResponse.json({ ok: true })
}
