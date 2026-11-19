import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, rateLimit } from '@/lib/callapp/server'

/**
 * GET  /api/groups/<id>/messages?before=<iso> — paginate older messages
 * POST /api/groups/<id>/messages { content } — send a text message
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params
  const membership = await db.groupMember.findUnique({
    where: { groupId_userId: { groupId: id, userId: me.id } },
    select: { id: true },
  })
  if (!membership) return NextResponse.json({ error: 'Not a member' }, { status: 403 })
  const before = new URL(req.url).searchParams.get('before')
  const messages = await db.groupMessage.findMany({
    where: { groupId: id, ...(before ? { createdAt: { lt: new Date(before) } } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 60,
    include: { sender: { select: { id: true, name: true, avatarKey: true, avatarUrl: true } } },
  })
  return NextResponse.json({
    messages: messages
      .reverse()
      .map((m) => ({
        id: m.id,
        type: m.type,
        content: m.content,
        mine: m.senderId === me.id,
        sender: { id: m.sender.id, name: m.sender.name, avatarKey: m.sender.avatarKey, avatarUrl: m.sender.avatarUrl ?? null },
        createdAt: m.createdAt.toISOString(),
      })),
  })
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params
  if (!rateLimit(`groupmsg:${me.id}`, 30, 10_000)) {
    return NextResponse.json({ error: 'Sending too fast' }, { status: 429 })
  }
  try {
    const body = (await req.json()) as { content?: string }
    const content = String(body.content || '').trim().slice(0, 2000)
    if (!content) return NextResponse.json({ error: 'Message is empty' }, { status: 400 })
    const membership = await db.groupMember.findUnique({
      where: { groupId_userId: { groupId: id, userId: me.id } },
      select: { id: true },
    })
    if (!membership) return NextResponse.json({ error: 'Not a member' }, { status: 403 })
    const msg = await db.groupMessage.create({
      data: { groupId: id, senderId: me.id, type: 'text', content },
      include: { sender: { select: { id: true, name: true, avatarKey: true, avatarUrl: true } } },
    })
    // touch the group so list ordering updates
    await db.group.update({ where: { id }, data: { updatedAt: new Date() } })
    return NextResponse.json({
      message: {
        id: msg.id,
        type: msg.type,
        content: msg.content,
        mine: true,
        sender: { id: msg.sender.id, name: msg.sender.name, avatarKey: msg.sender.avatarKey, avatarUrl: msg.sender.avatarUrl ?? null },
        createdAt: msg.createdAt.toISOString(),
      },
    })
  } catch {
    return NextResponse.json({ error: 'Could not send' }, { status: 500 })
  }
}
