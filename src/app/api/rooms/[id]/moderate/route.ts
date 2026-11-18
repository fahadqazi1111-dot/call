import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/callapp/server'

/**
 * POST { action, targetId, value } — host/co-host moderation, persisted then
 * broadcast by the client over the socket (room:moderate).
 * actions: promote | demote | mute | unmute | kick | block | hand_ok | hand_no
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
    const canModerate = room.hostId === me.id || mine?.role === 'cohost' || me.role === 'admin'
    if (!canModerate) return NextResponse.json({ error: 'Only host/co-host can moderate' }, { status: 403 })
    if (!targetId) return NextResponse.json({ error: 'targetId required' }, { status: 400 })
    if (room.hostId === targetId && me.id !== room.hostId) {
      return NextResponse.json({ error: 'Cannot moderate the host' }, { status: 403 })
    }

    switch (action) {
      case 'promote':
        await db.roomParticipant.updateMany({
          where: { roomId: id, userId: targetId },
          data: { role: 'speaker', handRaised: false },
        })
        break
      case 'cohost':
        await db.roomParticipant.updateMany({
          where: { roomId: id, userId: targetId },
          data: { role: 'cohost', handRaised: false },
        })
        break
      case 'demote':
        await db.roomParticipant.updateMany({
          where: { roomId: id, userId: targetId },
          data: { role: 'listener', handRaised: false },
        })
        break
      case 'mute':
        await db.roomParticipant.updateMany({ where: { roomId: id, userId: targetId }, data: { muted: true } })
        break
      case 'unmute':
        await db.roomParticipant.updateMany({ where: { roomId: id, userId: targetId }, data: { muted: false } })
        break
      case 'kick':
        await db.roomParticipant.updateMany({
          where: { roomId: id, userId: targetId },
          data: { leftAt: new Date(), role: 'listener', handRaised: false },
        })
        break
      case 'block':
        await db.roomParticipant.updateMany({
          where: { roomId: id, userId: targetId },
          data: { leftAt: new Date(), role: 'listener', blocked: true, handRaised: false },
        })
        break
      case 'hand_ok':
        await db.roomParticipant.updateMany({
          where: { roomId: id, userId: targetId },
          data: { role: 'speaker', handRaised: false },
        })
        break
      case 'hand_no':
        await db.roomParticipant.updateMany({
          where: { roomId: id, userId: targetId },
          data: { handRaised: false },
        })
        break
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
    return NextResponse.json({ ok: true, action, targetId })
  } catch {
    return NextResponse.json({ error: 'Moderation failed' }, { status: 500 })
  }
}
