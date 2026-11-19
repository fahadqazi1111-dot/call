import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/callapp/server'
import { getOrCreateConversation } from '@/lib/callapp/conv'

/**
 * POST { userId } — restrict a user in OUR conversation only.
 * Restriction mutes their notifications AND stops their calls from reaching me
 * (checked by the call verifier), but does NOT stop them from sending messages.
 */
export async function POST(req: Request) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await req.json()
    const userId = String(body.userId || '')
    if (!userId || userId === me.id) return NextResponse.json({ error: 'Invalid user' }, { status: 400 })
    const target = await db.user.findUnique({ where: { id: userId }, select: { id: true } })
    if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    const conv = await getOrCreateConversation(me.id, userId)
    await db.conversationState.upsert({
      where: { conversationId_userId: { conversationId: conv.id, userId: me.id } },
      update: { restricted: true, muted: true },
      create: { conversationId: conv.id, userId: me.id, restricted: true, muted: true },
    })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
