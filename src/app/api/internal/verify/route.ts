import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * INTERNAL — used by the CALL socket mini-service to verify room/live roles.
 * The socket service has no database access, so it calls this endpoint
 * (guarded by the shared internal relay secret) instead of trusting
 * client-provided roles.
 *
 * POST { kind: 'room' | 'live', id, userId }
 *  room → { ok, exists, role, canModerate, blocked }
 *  live → { ok, exists, isLive, isHost, isParticipant }
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

    return NextResponse.json({ ok: false, error: 'bad_kind' }, { status: 400 })
  } catch {
    return NextResponse.json({ ok: false, error: 'verify_failed' }, { status: 500 })
  }
}
