import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/callapp/server'
import { getOrCreateConversation } from '@/lib/callapp/conv'
import { sendPushToUser } from '@/lib/callapp/firebase'

/** GET: call history for me (both directions), newest first. */
export async function GET(req: Request) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const calls = await db.call.findMany({
    where: { OR: [{ callerId: me.id }, { calleeId: me.id }] },
    orderBy: { startedAt: 'desc' },
    take: 120,
    include: { caller: true, callee: true },
  })
  const list = calls.map((c) => {
    const outgoing = c.callerId === me.id
    const peer = outgoing ? c.callee : c.caller
    return {
      id: c.id,
      type: c.type,
      status: c.status,
      outgoing,
      missed: !outgoing && c.status !== 'answered',
      durationSec: c.durationSec,
      startedAt: c.startedAt.toISOString(),
      peer: {
        id: peer.id,
        name: peer.name,
        avatarKey: peer.avatarKey,
        avatarUrl: peer.avatarUrl,
        phone: peer.phone,
      },
    }
  })
  return NextResponse.json({ calls: list })
}

/**
 * POST: log a finished call { peerId, type, status, durationSec, addMessage? }
 * When addMessage is true a call summary bubble is added to the chat.
 */
export async function POST(req: Request) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await req.json()
    const peerId = String(body.peerId || '')
    const type = body.type === 'video' ? 'video' : 'voice'
    const status = ['answered', 'declined', 'missed', 'no-answer'].includes(body.status) ? body.status : 'answered'
    const durationSec = Math.max(0, Math.round(Number(body.durationSec) || 0))
    if (!peerId) return NextResponse.json({ error: 'Missing peerId' }, { status: 400 })
    const peer = await db.user.findUnique({ where: { id: peerId } })
    if (!peer) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const call = await db.call.create({
      data: {
        callerId: me.id,
        calleeId: peerId,
        type,
        status,
        durationSec,
        endedAt: new Date(),
      },
    })

    let message: { id: string; type: string; content: string; duration: number | null; createdAt: string; readAt: null; mine: boolean } | null = null
    if (body.addMessage) {
      const conv = await getOrCreateConversation(me.id, peerId)
      const msg = await db.message.create({
        data: {
          conversationId: conv.id,
          senderId: me.id,
          type: 'call',
          content: JSON.stringify({ callType: type, status, durationSec }),
        },
      })
      await db.conversation.update({ where: { id: conv.id }, data: { lastMessageAt: msg.createdAt } })
      message = {
        id: msg.id,
        type: msg.type,
        content: msg.content,
        duration: msg.duration,
        createdAt: msg.createdAt.toISOString(),
        readAt: null,
        mine: true,
      }
    }

    // FCM push for missed calls only — answered/declined calls already drove
    // the call screen over realtime, so a system notification would just
    // spam the recipient. Missed/no-answer is the one case where the callee
    // needs to be told offline: "X tried to call you".
    if (status === 'missed' || status === 'no-answer') {
      try {
        await sendPushToUser(peerId, {
          title: 'Missed call',
          body: `${me.name} tried to call you`,
          data: { refType: 'call', refId: call.id, callType: type, status },
        })
      } catch {
        // best-effort — never break the call log
      }
    }
    return NextResponse.json({ ok: true, callId: call.id, message })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
