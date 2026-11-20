import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/callapp/server'

/**
 * DELETE /api/messages/[id]?scope=everyone|me
 *
 * scope=everyone ("unsend"): sender only — wipes the content and leaves a
 * tombstone so BOTH sides see "message unsent". The client relays
 * `msg:deleted` over the socket for realtime removal.
 *
 * scope=me: hides the message only for me (MessageHide tombstone). The peer
 * keeps their copy. Hidden messages are excluded from history, chat previews
 * and unread counts.
 */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params
  const scope = new URL(req.url).searchParams.get('scope') === 'me' ? 'me' : 'everyone'

  const msg = await db.message.findUnique({
    where: { id },
    include: { conversation: { select: { userAId: true, userBId: true } } },
  })
  if (!msg || !msg.conversation) return NextResponse.json({ error: 'Message not found' }, { status: 404 })

  // Only participants of the conversation may touch the message.
  const isParticipant = msg.conversation.userAId === me.id || msg.conversation.userBId === me.id
  if (!isParticipant) return NextResponse.json({ error: 'Message not found' }, { status: 404 })

  if (scope === 'me') {
    await db.messageHide.upsert({
      where: { userId_messageId: { userId: me.id, messageId: id } },
      create: { userId: me.id, messageId: id },
      update: {},
    })
    return NextResponse.json({ ok: true, scope })
  }

  // scope=everyone — only the sender may unsend
  if (msg.senderId !== me.id) {
    return NextResponse.json({ error: 'You can only unsend your own messages' }, { status: 403 })
  }
  if (msg.deletedAt) return NextResponse.json({ ok: true, scope })
  const deletedAt = new Date()
  await db.message.update({
    where: { id },
    data: { deletedAt, content: '' },
  })
  return NextResponse.json({ ok: true, scope, deletedAt: deletedAt.toISOString() })
}
