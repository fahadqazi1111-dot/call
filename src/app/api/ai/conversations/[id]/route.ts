import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, mediaUrl } from '@/lib/callapp/server'

/** GET: full conversation (messages with signed media urls). */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params
  const conv = await db.aiConversation.findUnique({
    where: { id },
    include: { messages: { orderBy: { createdAt: 'asc' }, take: 200 } },
  })
  if (!conv || conv.userId !== me.id) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({
    conversation: {
      id: conv.id,
      title: conv.title,
      messages: conv.messages.map((m) => ({
        id: m.id,
        role: m.role,
        kind: m.kind,
        text: m.text,
        mediaUrl: mediaUrl(m.mediaId, me.id),
        createdAt: m.createdAt.toISOString(),
      })),
    },
  })
}

/** DELETE: remove a conversation. */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params
  const conv = await db.aiConversation.findUnique({ where: { id } })
  if (!conv || conv.userId !== me.id) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await db.aiConversation.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
