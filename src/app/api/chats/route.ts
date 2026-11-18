import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, publicUser } from '@/lib/callapp/server'

/** GET: all chat conversations for me with peer info, last message and unread counts. */
export async function GET(req: Request) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const convs = await db.conversation.findMany({
    where: { OR: [{ userAId: me.id }, { userBId: me.id }] },
    orderBy: { lastMessageAt: 'desc' },
    include: { userA: true, userB: true },
  })

  const result: Array<{
    conversationId: string
    peer: ReturnType<typeof publicUser>
    lastMessage: { id: string; type: string; content: string; duration: number | null; createdAt: string; mine: boolean; senderName: string } | null
    unread: number
    lastActivity: string
  }> = []
  for (const conv of convs) {
    const peer = conv.userAId === me.id ? conv.userB : conv.userA
    const [lastMsg, unread] = await Promise.all([
      db.message.findFirst({
        where: { conversationId: conv.id },
        orderBy: { createdAt: 'desc' },
        include: { sender: { select: { id: true, name: true } } },
      }),
      db.message.count({
        where: { conversationId: conv.id, senderId: peer.id, readAt: null },
      }),
    ])
    result.push({
      conversationId: conv.id,
      peer: publicUser(peer),
      lastMessage: lastMsg
        ? {
            id: lastMsg.id,
            type: lastMsg.type,
            content: lastMsg.content,
            duration: lastMsg.duration,
            createdAt: lastMsg.createdAt.toISOString(),
            mine: lastMsg.senderId === me.id,
            senderName: lastMsg.sender.name,
          }
        : null,
      unread,
      lastActivity: conv.lastMessageAt.toISOString(),
    })
  }
  return NextResponse.json({ chats: result })
}
