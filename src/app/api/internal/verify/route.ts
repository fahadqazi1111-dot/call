import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * INTERNAL — used by the CALL socket mini-service to verify room/live roles and
 * to gate 1:1 calls (user safety). The socket service has no database access,
 * so it calls this endpoint (guarded by the shared internal relay secret)
 * instead of trusting client-provided roles.
 *
 * POST { kind: 'room' | 'live' | 'call', id, userId }
 *  room → { ok, exists, role, canModerate, blocked }
 *  live → { ok, exists, isLive, isHost, isParticipant }
 *  call → { ok, reason?: 'banned' | 'blocked' | 'restricted' }
 *         id = target user, userId = caller. ok=false when the target is
 *         banned, a block exists in either direction, or the target has
 *         restricted the caller.
 */
export async function POST(req: Request) {
  if (req.headers.get('x-internal-secret') !== 'call-internal-relay-v1') {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  }
  try {
    const body = (await req.json()) as { kind?: string; id?: string; userId?: string }
    const kind = String(body.kind || '')
    const id = String(body.id || '')
    const userId = String(body.userId || '')
    if (!id || !userId) return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 })

    if (kind === 'room') {
      const room = await db.voiceRoom.findUnique({ where: { id } })
      if (!room || room.status !== 'live') {
        return NextResponse.json({ ok: true, exists: false, role: null, canModerate: false, blocked: false })
      }
      const part = await db.roomParticipant.findUnique({
        where: { roomId_userId: { roomId: id, userId } },
      })
      if (!part || part.leftAt) {
        return NextResponse.json({ ok: true, exists: false, role: null, canModerate: false, blocked: false })
      }
      const isHost = room.hostId === userId
      const role = isHost ? 'host' : part.role
      const canModerate = isHost || role === 'cohost'
      return NextResponse.json({ ok: true, exists: true, role, canModerate, blocked: part.blocked })
    }

    if (kind === 'live') {
      const live = await db.liveSession.findUnique({ where: { id } })
      if (!live || live.status !== 'live') {
        return NextResponse.json({ ok: true, exists: false, isLive: false, isHost: false, isParticipant: false })
      }
      const isHost = live.hostId === userId
      const participant = await db.battleParticipant.findFirst({
        where: { battle: { liveId: id }, userId, accepted: true },
        select: { id: true },
      })
      return NextResponse.json({
        ok: true,
        exists: true,
        isLive: true,
        isHost,
        isParticipant: !!participant,
      })
    }

    if (kind === 'call') {
      // call gating: id = the user being called, userId = the caller
      const target = await db.user.findUnique({ where: { id }, select: { id: true, blocked: true } })
      if (!target || target.blocked) {
        return NextResponse.json({ ok: false, reason: 'banned' })
      }
      const block = await db.userBlock.findFirst({
        where: {
          OR: [
            { blockerId: userId, blockedId: id },
            { blockerId: id, blockedId: userId },
          ],
        },
        select: { id: true },
      })
      if (block) return NextResponse.json({ ok: false, reason: 'blocked' })
      const [userAId, userBId] = id < userId ? [id, userId] : [userId, id]
      const conv = await db.conversation.findUnique({
        where: { userAId_userBId: { userAId, userBId } },
        select: { id: true },
      })
      if (conv) {
        const st = await db.conversationState.findUnique({
          where: { conversationId_userId: { conversationId: conv.id, userId: id } },
          select: { restricted: true },
        })
        if (st?.restricted) return NextResponse.json({ ok: false, reason: 'restricted' })
      }
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ ok: false, error: 'bad_kind' }, { status: 400 })
  } catch {
    return NextResponse.json({ ok: false, error: 'verify_failed' }, { status: 500 })
  }
}
