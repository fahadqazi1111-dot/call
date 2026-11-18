import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/callapp/server'
import { getOrCreateConversation } from '@/lib/callapp/conv'

/**
 * POST: send a message { to, type: 'text'|'voice'|'call', content, duration?, callMeta? }
 * Returns the persisted message; the client then pushes it over the socket.
 */
export async function POST(req: Request) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await req.json()
    const to = String(body.to || '')
    const type = ['text', 'voice', 'call'].includes(body.type) ? body.type : 'text'
    let content = String(body.content ?? '')
    if (!to || !content) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const peer = await db.user.findUnique({ where: { id: to } })
    if (!peer) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    // CALL Official is one-way: it messages users, users can never reply to it.
    if (peer.isOfficial) {
      return NextResponse.json(
        { error: 'You cannot reply to CALL Official. Messages from the CALL team are one-way.' },
        { status: 403 }
      )
    }
    // The official account itself never sends user-to-user messages from the app.
    if (me.isOfficial) {
      return NextResponse.json({ error: 'The official account cannot send chat messages' }, { status: 403 })
    }

    if (type === 'text' && content.length > 4000) content = content.slice(0, 4000)
    const duration = typeof body.duration === 'number' ? Math.max(0, Math.round(body.duration)) : null

    const conv = await getOrCreateConversation(me.id, to)
    const msg = await db.message.create({
      data: {
        conversationId: conv.id,
        senderId: me.id,
        type,
        content,
        duration,
      },
    })
    await db.conversation.update({ where: { id: conv.id }, data: { lastMessageAt: msg.createdAt } })
    await db.user.update({ where: { id: me.id }, data: { lastSeen: new Date() } })

    return NextResponse.json({
      message: {
        id: msg.id,
        type: msg.type,
        content: msg.content,
        duration: msg.duration,
        createdAt: msg.createdAt.toISOString(),
        readAt: null,
        mine: true,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
