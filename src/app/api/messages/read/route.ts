import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/callapp/server'
import { getOrCreateConversation } from '@/lib/callapp/conv'

/** POST: mark all messages from a peer as read { peerId }. */
export async function POST(req: Request) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { peerId } = await req.json()
    if (!peerId) return NextResponse.json({ error: 'Missing peerId' }, { status: 400 })
    const conv = await getOrCreateConversation(me.id, String(peerId))
    const res = await db.message.updateMany({
      where: { conversationId: conv.id, senderId: String(peerId), readAt: null },
      data: { readAt: new Date() },
    })
    return NextResponse.json({ ok: true, updated: res.count })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
