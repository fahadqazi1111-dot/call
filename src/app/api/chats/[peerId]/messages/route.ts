import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, publicUser } from '@/lib/callapp/server'
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

  return NextResponse.json({
    conversationId: conv.id,
    peer: publicUser(peer),
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
      mine: m.senderId === me.id,
    })),
  })
}
