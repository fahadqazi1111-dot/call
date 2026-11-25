import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, publicUser } from '@/lib/callapp/server'

/**
 * GET: all chat conversations for me with peer info, last message and unread counts.
 * Honors per-user ConversationState: deleted chats are always hidden, archived
 * chats are hidden unless ?archived=1 (which returns ONLY archived). Cleared
 * history (clearedBeforeAt) applies to the last-message preview and unread count.
 * Each chat also carries safety flags: archived, muted, restricted, blocked
 * (I blocked the peer) and blockedMe (peer blocked me).
 */
export async function GET(req: Request) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const archivedOnly = new URL(req.url).searchParams.get('archived') === '1'

  const convs = await db.conversation.findMany({
    where: { OR: [{ userAId: me.id }, { userBId: me.id }] },
    orderBy: { lastMessageAt: 'desc' },
    include: { userA: true, userB: true },
  })

  const convIds = convs.map((c) => c.id)
  const peerIds = convs.map((c) => (c.userAId === me.id ? c.userBId : c.userAId))

  // Batch the per-user states + both-direction blocks — 2 queries, no N+1.
  const states = convIds.length
    ? await db.conversationState.findMany({ where: { userId: me.id, conversationId: { in: convIds } } })
    : []
  const blocks = peerIds.length
    ? await db.userBlock.findMany({
        where: {
          OR: [
            { blockerId: me.id, blockedId: { in: peerIds } },
            { blockedId: me.id, blockerId: { in: peerIds } },
          ],
        },
      })
    : []

  const stateByConv = new Map(states.map((s) => [s.conversationId, s]))
  const iBlocked = new Set<string>()
  const blockedMe = new Set<string>()
  for (const b of blocks) {
    if (b.blockerId === me.id) iBlocked.add(b.blockedId)
    else blockedMe.add(b.blockerId)
  }

  /* ---------- privacy: batch-resolve which peers have me in their contacts ----------
   * A peer's "contacts"-level privacy (last seen / photo / about) only grants
   * access when MY phone is saved in THEIR contact book. One query for the
   * whole chat list — no per-conversation DB round-trip. */
  const contactOwners = peerIds.length
    ? await db.contact.findMany({
        where: { ownerId: { in: peerIds }, phone: me.phone },
        select: { ownerId: true },
      })
    : []
  const isContactOfPeer = new Set(contactOwners.map((c) => c.ownerId))

  const result: Array<{
    conversationId: string
    peer: ReturnType<typeof publicUser>
    lastMessage: { id: string; type: string; content: string; duration: number | null; createdAt: string; mine: boolean; senderName: string; deletedAt: string | null; forwarded: boolean } | null
    unread: number
    lastActivity: string
    archived: boolean
    muted: boolean
    restricted: boolean
    blocked: boolean
    blockedMe: boolean
  }> = []
  for (const conv of convs) {
    const peer = conv.userAId === me.id ? conv.userB : conv.userA
    const st = stateByConv.get(conv.id)
    if (st?.deleted) continue
    // default view excludes archived; ?archived=1 returns only archived
    if (archivedOnly ? !st?.archived : st?.archived) continue

    // after "clear chat" only newer messages exist for me
    const recentOnly: { createdAt?: { gt: Date } } = st?.clearedBeforeAt ? { createdAt: { gt: st.clearedBeforeAt } } : {}
    const [lastMsg, unread] = await Promise.all([
      db.message.findFirst({
        where: { conversationId: conv.id, ...recentOnly, hides: { none: { userId: me.id } } },
        orderBy: { createdAt: 'desc' },
        include: { sender: { select: { id: true, name: true } } },
      }),
      db.message.count({
        where: { conversationId: conv.id, ...recentOnly, senderId: peer.id, readAt: null, deletedAt: null, hides: { none: { userId: me.id } } },
      }),
    ])
    result.push({
      conversationId: conv.id,
      peer: publicUser(peer, { id: me.id, isContact: isContactOfPeer.has(peer.id) }),
      lastMessage: lastMsg
        ? {
            id: lastMsg.id,
            type: lastMsg.type,
            content: lastMsg.content,
            duration: lastMsg.duration,
            createdAt: lastMsg.createdAt.toISOString(),
            mine: lastMsg.senderId === me.id,
            senderName: lastMsg.sender.name,
            deletedAt: lastMsg.deletedAt ? lastMsg.deletedAt.toISOString() : null,
            forwarded: lastMsg.forwarded,
          }
        : null,
      unread,
      lastActivity: conv.lastMessageAt.toISOString(),
      archived: st?.archived ?? false,
      muted: st?.muted ?? false,
      restricted: st?.restricted ?? false,
      blocked: iBlocked.has(peer.id),
      blockedMe: blockedMe.has(peer.id),
    })
  }
  return NextResponse.json({ chats: result })
}
