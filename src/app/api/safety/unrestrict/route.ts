import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/callapp/server'
import { getOrCreateConversation } from '@/lib/callapp/conv'

/** POST { userId } — lift the restriction on a user (muted flag stays as-is). */
export async function POST(req: Request) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await req.json()
    const userId = String(body.userId || '')
    if (!userId) return NextResponse.json({ error: 'Invalid user' }, { status: 400 })
    const target = await db.user.findUnique({ where: { id: userId }, select: { id: true } })
    if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    const conv = await getOrCreateConversation(me.id, userId)
    await db.conversationState.upsert({
      where: { conversationId_userId: { conversationId: conv.id, userId: me.id } },
      update: { restricted: false },
      create: { conversationId: conv.id, userId: me.id, restricted: false },
    })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
