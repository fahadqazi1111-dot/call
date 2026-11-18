import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/callapp/server'
import { relayRoomSync, relayRoomUser } from '@/lib/callapp/roomSync'

/**
 * POST { action, targetId } — room moderation, authoritative on the server.
 * After every mutation the whole room is re-synced from the DB (internal sync
 * → room:state broadcast), so clients can never forge roles or permissions.
 *
 * Host/co-host only: promote | cohost | demote | mute | unmute | kick | block | hand_ok | hand_no
 * Self (any participant):   hand_up | hand_down   (mic request / cancel)
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params
  try {
    const body = await req.json()
    const action = String(body.action || '')
    const targetId = String(body.targetId || '')
    const room = await db.voiceRoom.findUnique({ where: { id } })
    if (!room || room.status !== 'live') return NextResponse.json({ error: 'Room not available' }, { status: 404 })

    const mine = await db.roomParticipant.findUnique({ where: { roomId_userId: { roomId: id, userId: me.id } } })
    if (!mine || mine.leftAt) return NextResponse.json({ error: 'You are not in this room' }, { status: 403 })

    const isHost = room.hostId === me.id
    const canModerate = isHost || mine.role === 'cohost' || me.role === 'admin'

    // self mic-request actions need no moderation rights
    if (action === 'hand_up' || action === 'hand_down') {
      if (targetId !== me.id) return NextResponse.json({ error: 'You can only manage your own hand' }, { status: 403 })
      if (mine.role === 'listener' ? action === 'hand_down' : true) {
        // speakers don't need to raise hands
        if (mine.role !== 'listener') return NextResponse.json({ ok: true })
      }
      await db.roomParticipant.update({
        where: { id: mine.id },
        data: { handRaised: action === 'hand_up' },
      })
      await relayRoomSync(id)
      return NextResponse.json({ ok: true })
    }

    if (!canModerate) return NextResponse.json({ error: 'Only host/co-host can moderate' }, { status: 403 })
    if (!targetId) return NextResponse.json({ error: 'targetId required' }, { status: 400 })
    if (room.hostId === targetId && me.id !== room.hostId) {
      return NextResponse.json({ error: 'Cannot moderate the host' }, { status: 403 })
    }

    switch (action) {
      case 'promote':
        await db.roomParticipant.updateMany({
          where: { roomId: id, userId: targetId, leftAt: null },
          data: { role: 'speaker', handRaised: false, stageInvite: false, invitedAt: null },
        })
        break
      case 'cohost':
        await db.roomParticipant.updateMany({
          where: { roomId: id, userId: targetId, leftAt: null },
          data: { role: 'cohost', handRaised: false, stageInvite: false, invitedAt: null },
        })
        break
      case 'demote':
        await db.roomParticipant.updateMany({
          where: { roomId: id, userId: targetId, leftAt: null },
          data: { role: 'listener', handRaised: false, stageInvite: false, invitedAt: null, muted: false },
        })
        break
      case 'mute':
        await db.roomParticipant.updateMany({ where: { roomId: id, userId: targetId, leftAt: null }, data: { muted: true } })
        break
      case 'unmute':
        await db.roomParticipant.updateMany({ where: { roomId: id, userId: targetId, leftAt: null }, data: { muted: false } })
        break
      case 'kick':
        await db.roomParticipant.updateMany({
          where: { roomId: id, userId: targetId },
          data: { leftAt: new Date(), role: 'listener', handRaised: false, stageInvite: false, invitedAt: null },
        })
        await relayRoomUser(targetId, 'room:removed', { roomId: id, reason: 'kick' })
        break
      case 'block':
        await db.roomParticipant.updateMany({
          where: { roomId: id, userId: targetId },
          data: { leftAt: new Date(), role: 'listener', blocked: true, handRaised: false, stageInvite: false, invitedAt: null },
        })
        await relayRoomUser(targetId, 'room:removed', { roomId: id, reason: 'block' })
        break
      case 'hand_ok':
        await db.roomParticipant.updateMany({
          where: { roomId: id, userId: targetId, leftAt: null },
          data: { role: 'speaker', handRaised: false, stageInvite: false, invitedAt: null },
        })
        break
      case 'hand_no':
        await db.roomParticipant.updateMany({
          where: { roomId: id, userId: targetId, leftAt: null },
          data: { handRaised: false },
        })
        break
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
    // authoritative re-sync of the whole room from the DB
    await relayRoomSync(id)
    return NextResponse.json({ ok: true, action, targetId })
  } catch {
    return NextResponse.json({ error: 'Moderation failed' }, { status: 500 })
  }
}
