import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, rateLimit } from '@/lib/callapp/server'

const MEDIA_TYPES = ['voice', 'image', 'video']
const VALID_TYPES = ['text', ...MEDIA_TYPES]

/**
 * GET  /api/groups/<id>/messages?before=<iso> — paginate older messages
 * POST /api/groups/<id>/messages { type, content, mediaId?, duration? }
 *   text   → content = the text body
 *   media  → content = '' , mediaId = uploaded media id, duration for voice
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params
  const membership = await db.groupMember.findUnique({
    where: { groupId_userId: { groupId: id, userId: me.id } },
    select: { id: true, clearedBeforeAt: true },
  })
  if (!membership) return NextResponse.json({ error: 'Not a member' }, { status: 403 })
  const before = new URL(req.url).searchParams.get('before')
  const messages = await db.groupMessage.findMany({
    where: {
      groupId: id,
      // per-user "Clear chat" — hide everything sent before my clear moment
      ...(membership.clearedBeforeAt ? { createdAt: { gt: membership.clearedBeforeAt } } : {}),
      ...(before ? { createdAt: { lt: new Date(before) } } : {}),
    },
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
        mediaId: m.mediaId ?? null,
        duration: m.duration ?? null,
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
  if (!rateLimit(`groupmsg:${me.id}`, 40, 10_000)) {
    return NextResponse.json({ error: 'Sending too fast' }, { status: 429 })
  }
  try {
    const body = (await req.json()) as { type?: string; content?: string; mediaId?: string; duration?: number }
    const type = VALID_TYPES.includes(String(body.type || '')) ? String(body.type) : 'text'
    const mediaId = String(body.mediaId || '') || null
    const content = type === 'text' ? String(body.content || '').trim().slice(0, 2000) : ''
    if (type === 'text' && !content) {
      return NextResponse.json({ error: 'Message is empty' }, { status: 400 })
    }
    if (MEDIA_TYPES.includes(type) && (!mediaId || !/^[a-f0-9]{32}$/.test(mediaId))) {
      return NextResponse.json({ error: 'Media upload required' }, { status: 400 })
    }
    const membership = await db.groupMember.findUnique({
      where: { groupId_userId: { groupId: id, userId: me.id } },
      select: { id: true },
    })
    if (!membership) return NextResponse.json({ error: 'Not a member' }, { status: 403 })
    const msg = await db.groupMessage.create({
      data: {
        groupId: id,
        senderId: me.id,
        type,
        content,
        mediaId,
        duration: type === 'voice' && Number(body.duration) > 0 ? Math.round(Number(body.duration)) : null,
      },
      include: { sender: { select: { id: true, name: true, avatarKey: true, avatarUrl: true } } },
    })
    // touch the group so list ordering updates
    await db.group.update({ where: { id }, data: { updatedAt: new Date() } })
    return NextResponse.json({
      message: {
        id: msg.id,
        type: msg.type,
        content: msg.content,
        mediaId: msg.mediaId ?? null,
        duration: msg.duration ?? null,
        mine: true,
        sender: { id: msg.sender.id, name: msg.sender.name, avatarKey: msg.sender.avatarKey, avatarUrl: msg.sender.avatarUrl ?? null },
        createdAt: msg.createdAt.toISOString(),
      },
    })
  } catch {
    return NextResponse.json({ error: 'Could not send' }, { status: 500 })
  }
}
