import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, rateLimit } from '@/lib/callapp/server'

/** GET ?limit=50: recent room chat history (for joiners). */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params
  const limit = Math.min(100, Math.max(1, Number(new URL(req.url).searchParams.get('limit')) || 50))
  const msgs = await db.roomMessage.findMany({ where: { roomId: id }, orderBy: { createdAt: 'desc' }, take: limit })
  return NextResponse.json({ messages: msgs.reverse() })
}

/** POST { text }: persist a room chat message (realtime copy goes over the socket). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!rateLimit(`roommsg:${me.id}`, 30, 60_000)) {
    return NextResponse.json({ error: 'Chatting too fast' }, { status: 429 })
  }
  const { id } = await ctx.params
  try {
    const body = await req.json()
    const text = String(body.text || '').trim().slice(0, 300)
    if (!text) return NextResponse.json({ error: 'Empty message' }, { status: 400 })
    const msg = await db.roomMessage.create({
      data: { roomId: id, userId: me.id, name: me.name, text },
    })
    return NextResponse.json({
      message: { id: msg.id, roomId: id, userId: me.id, name: me.name, text, createdAt: msg.createdAt.toISOString() },
    })
  } catch {
    return NextResponse.json({ error: 'Send failed' }, { status: 500 })
  }
}
