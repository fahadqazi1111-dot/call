import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, publicUserForViewer } from '@/lib/callapp/server'
import { getOrCreateConversation } from '@/lib/callapp/conv'

/** GET: message history with a peer. Also touches my lastSeen. */
export async function GET(req: Request, ctx: { params: Promise<{ peerId: string }> }) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { peerId } = await ctx.params
  const peer = await db.user.findUnique({ where: { id: peerId } })
  if (!peer) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const conv = await getOrCreateConversation(me.id, peerId)
  // per-user "clear chat": anything sent before my clearedBeforeAt stays hidden for me
  const myState = await db.conversationState.findUnique({
    where: { conversationId_userId: { conversationId: conv.id, userId: me.id } },
    select: { clearedBeforeAt: true },
  })

  // ---- disappearing messages cleanup ----
  // 1) Hard-delete any message whose `expiresAt` is in the past (24h mode).
  // 2) Hard-delete any `viewOnce` message that has already been read by the
  //    recipient (readAt != null). Once read, it should never be re-fetched.
  //    The sender keeps it visible until they reload — the tombstone stays
  //    gone for everyone because the content is wiped from the DB.
  const now = new Date()
  try {
    await db.message.deleteMany({
      where: {
        conversationId: conv.id,
        OR: [
          { expiresAt: { lt: now } },
          { viewOnce: true, readAt: { not: null } },
        ],
      },
    })
  } catch {
    // best-effort cleanup — never block the read
  }

  const messages = await db.message.findMany({
    where: {
      conversationId: conv.id,
      // "delete for me" tombstones stay invisible on my device
      hides: { none: { userId: me.id } },
      ...(myState?.clearedBeforeAt ? { createdAt: { gt: myState.clearedBeforeAt } } : {}),
    },
    orderBy: { createdAt: 'asc' },
    take: 300,
  })
  await db.user.update({ where: { id: me.id }, data: { lastSeen: new Date() } })

  // Peer profile is filtered through the privacy gate (last seen / photo /
  // about / phone) based on whether I am in their contact book.
  const peerPublic = await publicUserForViewer(peer, { id: me.id, phone: me.phone })

  return NextResponse.json({
    conversationId: conv.id,
    peer: peerPublic,
    messages: messages.map((m) => ({
      id: m.id,
      type: m.type,
      content: m.content,
      duration: m.duration,
      createdAt: m.createdAt.toISOString(),
      deliveredAt: m.deliveredAt ? m.deliveredAt.toISOString() : null,
      readAt: m.readAt ? m.readAt.toISOString() : null,
      deletedAt: m.deletedAt ? m.deletedAt.toISOString() : null,
      forwarded: m.forwarded,
      expiresAt: m.expiresAt ? m.expiresAt.toISOString() : null,
      viewOnce: m.viewOnce,
      mine: m.senderId === me.id,
    })),
  })
}
