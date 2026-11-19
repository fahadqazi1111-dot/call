import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, isContactOf } from '@/lib/callapp/server'
import { getOrCreateConversation } from '@/lib/callapp/conv'

/**
 * POST: send a message { to, type: 'text'|'voice'|'call'|'image', content, duration?, callMeta? }
 * Returns the persisted message; the client then pushes it over the socket.
 *
 * CONTACTS-BASED MESSAGING: a brand-new conversation can only be started with
 * an actual contact (either side has the other saved) or by staff reaching a
 * user. Existing conversations always keep working. Users with the privacy
 * toggle "Allow messages from non-contacts" accept anyone.
 */
export async function POST(req: Request) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await req.json()
    const to = String(body.to || '')
    const type = ['text', 'voice', 'call', 'image'].includes(body.type) ? body.type : 'text'
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

    // SAFETY — blocks cut BOTH ways + banned users can never be messaged.
    // (Restriction only silences calls/notifications — it never blocks messages.)
    const [iBlockedThem, theyBlockedMe] = await Promise.all([
      db.userBlock.findUnique({
        where: { blockerId_blockedId: { blockerId: me.id, blockedId: to } },
        select: { id: true },
      }),
      db.userBlock.findUnique({
        where: { blockerId_blockedId: { blockerId: to, blockedId: me.id } },
        select: { id: true },
      }),
    ])
    if (iBlockedThem) {
      return NextResponse.json({ error: 'You blocked this contact. Unblock to send messages.' }, { status: 403 })
    }
    if (theyBlockedMe || peer.blocked) {
      // never reveal the real reason (block or ban) to the sender
      return NextResponse.json({ error: 'Message not delivered' }, { status: 403 })
    }

    // CONTACTS GATE — hard floor on the backend for NEW conversations only:
    // the INITIATOR must have the recipient saved as a contact (or the
    // recipient allows non-contacts, or the sender is staff).
    const existing = await db.conversation.findFirst({
      where: { OR: [{ userAId: me.id, userBId: to }, { userAId: to, userBId: me.id }] },
      select: { id: true },
    })
    if (!existing) {
      const staffSender = me.role === 'admin' || me.role === 'team'
      const savedByMe = await isContactOf(me.id, peer.phone)
      const allowed = staffSender || peer.allowNonContacts || savedByMe
      if (!allowed) {
        return NextResponse.json(
          { error: 'You can only message people in your contacts. Save them as a contact first — or ask them to message you.' },
          { status: 403 }
        )
      }
    }

    if (type === 'text' && content.length > 4000) content = content.slice(0, 4000)
    const duration = typeof body.duration === 'number' ? Math.max(0, Math.round(body.duration)) : null

    const conv = existing ? { id: existing.id } : await getOrCreateConversation(me.id, to)
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
        deliveredAt: null,
        readAt: null,
        mine: true,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
