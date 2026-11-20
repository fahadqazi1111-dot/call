import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, rateLimit } from '@/lib/callapp/server'
import { relayRoomSync, relayRoomUser, relayToRoom } from '@/lib/callapp/roomSync'

/**
 * POST { action, targetId?, muted? } — microphone stage flow, authoritative on
 * the server. Every action persists to the DB and re-syncs the whole room via
 * the socket service, so roles can never be forged client-side.
 *
 * Listener actions (self):
 *  - request_mic    → raise hand / ask the host for the microphone
 *  - cancel_request → withdraw the request
 *  - accept_invite  → accept the host's stage invitation (only then promoted)
 *  - decline_invite → decline the host's stage invitation
 *  - mute_self      → sync my own mic-mute badge to everyone
 *
 * Host / co-host actions:
 *  - invite_mic     → invite a listener onto the microphone (they must accept)
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params
  if (!rateLimit(`roomstage:${me.id}`, 40, 60_000)) {
    return NextResponse.json({ error: 'Too many attempts' }, { status: 429 })
  }
  try {
    const body = await req.json().catch(() => ({}))
    const action = String(body.action || '')
    const room = await db.voiceRoom.findUnique({ where: { id } })
    if (!room || room.status !== 'live') return NextResponse.json({ error: 'Room not available' }, { status: 404 })

    const mine = await db.roomParticipant.findUnique({ where: { roomId_userId: { roomId: id, userId: me.id } } })
    if (!mine || mine.leftAt || mine.blocked) {
      return NextResponse.json({ error: 'You are not an active participant of this room' }, { status: 403 })
    }
    const isHostLike = room.hostId === me.id || mine.role === 'cohost'

    const myPublic = { id: me.id, name: me.name, avatarKey: me.avatarKey, avatarUrl: me.avatarUrl }

    switch (action) {
      /* ---------- listener: ask the host for the mic ---------- */
      case 'request_mic': {
        if (mine.role !== 'listener') {
          return NextResponse.json({ error: 'You are already on stage' }, { status: 400 })
        }
        await db.roomParticipant.update({ where: { id: mine.id }, data: { handRaised: true } })
        // realtime nudge to the room (host UI shows a prompt; state also syncs)
        await relayToRoom(id, 'room:mic_request', { roomId: id, user: myPublic })
        break
      }
      case 'cancel_request': {
        await db.roomParticipant.update({ where: { id: mine.id }, data: { handRaised: false } })
        break
      }

      /* ---------- listener: respond to a host invitation ---------- */
      case 'accept_invite': {
        if (!mine.stageInvite) {
          return NextResponse.json({ error: 'No pending stage invitation' }, { status: 400 })
        }
        await db.roomParticipant.update({
          where: { id: mine.id },
          data: { role: 'speaker', stageInvite: false, invitedAt: null, handRaised: false },
        })
        break
      }
      case 'decline_invite': {
        await db.roomParticipant.update({ where: { id: mine.id }, data: { stageInvite: false, invitedAt: null } })
        break
      }

      /* ---------- host/co-host: invite a listener onto the mic ---------- */
      case 'invite_mic': {
        if (!isHostLike) return NextResponse.json({ error: 'Only the host can invite listeners to the stage' }, { status: 403 })
        const targetId = String(body.targetId || '')
        if (!targetId) return NextResponse.json({ error: 'targetId required' }, { status: 400 })
        if (targetId === me.id) return NextResponse.json({ error: 'Cannot invite yourself' }, { status: 400 })
        const target = await db.roomParticipant.findUnique({
          where: { roomId_userId: { roomId: id, userId: targetId } },
        })
        if (!target || target.leftAt) return NextResponse.json({ error: 'Listener is not in the room' }, { status: 404 })
        if (target.role !== 'listener') return NextResponse.json({ error: 'User is already on stage' }, { status: 400 })
        await db.roomParticipant.update({
          where: { id: target.id },
          data: { stageInvite: true, invitedAt: new Date() },
        })
        // the invited listener must EXPLICITLY accept before being promoted
        await relayRoomUser(targetId, 'room:mic_invite', {
          roomId: id,
          roomTitle: room.title,
          from: { id: me.id, name: me.name },
        })
        break
      }

      /* ---------- speaker: sync my own mute badge ---------- */
      case 'mute_self': {
        if (mine.role === 'listener') {
          return NextResponse.json({ error: 'Listeners have no microphone' }, { status: 400 })
        }
        const muted = !!body.muted
        await db.roomParticipant.update({ where: { id: mine.id }, data: { muted } })
        break
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }

    // authoritative state sync for the whole room
    await relayRoomSync(id)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Stage action failed' }, { status: 500 })
  }
}
