import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, rateLimit } from '@/lib/callapp/server'

/** GET ?limit=60: recent live comments (for joiners). */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params
  const limit = Math.min(100, Math.max(1, Number(new URL(req.url).searchParams.get('limit')) || 60))
  const msgs = await db.liveComment.findMany({ where: { liveId: id }, orderBy: { createdAt: 'desc' }, take: limit })
  return NextResponse.json({ comments: msgs.reverse() })
}

/** POST { text }: persist a live comment (realtime copy goes over the socket). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!rateLimit(`livecomment:${me.id}`, 30, 60_000)) {
    return NextResponse.json({ error: 'Commenting too fast' }, { status: 429 })
  }
  const { id } = await ctx.params
  try {
    const body = await req.json()
    const text = String(body.text || '').trim().slice(0, 200)
    if (!text) return NextResponse.json({ error: 'Empty comment' }, { status: 400 })
    const c = await db.liveComment.create({ data: { liveId: id, userId: me.id, name: me.name, text } })
    return NextResponse.json({
      comment: {
        id: c.id,
        liveId: id,
        userId: me.id,
        name: me.name,
        text,
        avatarKey: me.avatarKey,
        avatarUrl: me.avatarUrl,
        createdAt: c.createdAt.toISOString(),
      },
    })
  } catch {
    return NextResponse.json({ error: 'Send failed' }, { status: 500 })
  }
}
