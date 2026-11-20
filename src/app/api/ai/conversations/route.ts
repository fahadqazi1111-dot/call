import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/callapp/server'

/** GET: my AI conversations (history list). */
export async function GET(req: Request) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const conversations = await db.aiConversation.findMany({
    where: { userId: me.id },
    orderBy: { updatedAt: 'desc' },
    take: 50,
    include: { _count: { select: { messages: true } } },
  })
  return NextResponse.json({
    conversations: conversations.map((c) => ({
      id: c.id,
      title: c.title,
      messages: c._count.messages,
      updatedAt: c.updatedAt.toISOString(),
    })),
  })
}

/** POST { id? } — no-op create placeholder (real conversation starts on first chat). */
export async function POST(req: Request) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const conv = await db.aiConversation.create({
    data: { userId: me.id, title: String(body?.title || 'New conversation').slice(0, 40) },
  })
  return NextResponse.json({ conversation: { id: conv.id, title: conv.title, messages: 0 } })
}
