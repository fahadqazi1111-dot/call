import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, rateLimit } from '@/lib/callapp/server'

/**
 * GET  /api/groups — my groups (with last message + unread count)
 * POST /api/groups { name, memberIds[] } — create a group (creator = owner)
 */

interface MemberRow {
  userId: string
  role: string
  user: { id: string; name: string; username: string; avatarKey: number; avatarUrl: string | null }
}

function toGroupItem(
  g: {
    id: string
    name: string
    avatarKey: number
    avatarUrl?: string | null
    ownerId: string
    updatedAt: Date
    members: Array<{ userId: string; role: string; user: { id: string; name: string; username: string; avatarKey: number; avatarUrl: string | null } }>
  },
  myRole: string,
  last: { id: string; content: string; type: string; senderId: string; senderName: string; createdAt: Date } | null,
  unread: number,
  meId: string
) {
  return {
    id: g.id,
    name: g.name,
    avatarKey: g.avatarKey,
    avatarUrl: g.avatarUrl ?? null,
    ownerId: g.ownerId,
    myRole,
    members: g.members.map((mm) => ({
      id: mm.user.id,
      name: mm.user.name,
      username: mm.user.username,
      avatarKey: mm.user.avatarKey,
      avatarUrl: mm.user.avatarUrl ?? null,
      role: mm.role,
    })),
    lastMessage: last
      ? {
          id: last.id,
          type: last.type,
          content: last.type === 'system' ? last.content : last.content.slice(0, 80),
          senderName: last.senderName,
          mine: last.senderId === meId,
          createdAt: last.createdAt.toISOString(),
        }
      : null,
    unread,
    updatedAt: g.updatedAt.toISOString(),
  }
}

export async function GET(req: Request) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const memberships = await db.groupMember.findMany({
    where: { userId: me.id },
    include: {
      group: {
        include: {
          members: {
            include: { user: { select: { id: true, name: true, username: true, avatarKey: true, avatarUrl: true } } },
          },
          messages: { orderBy: { createdAt: 'desc' }, take: 1, include: { sender: { select: { name: true } } } },
        },
      },
    },
  })

  // WhatsApp semantics: a deleted chat stays hidden until a NEW message
  // arrives after the delete moment; cleared messages never come back.
  const visible: typeof memberships = []
  for (const m of memberships) {
    const last = m.group.messages[0] ?? null
    if (m.deletedAt && (!last || last.createdAt <= m.deletedAt)) continue
    visible.push(m)
  }

  // unread counts for groups that have a newer message than my lastReadAt
  // (messages sent before my "clear chat" moment never count)
  const unreadPairs = await Promise.all(
    visible.map((m) => {
      const last = m.group.messages[0]
      const since = m.clearedBeforeAt && m.clearedBeforeAt > m.lastReadAt ? m.clearedBeforeAt : m.lastReadAt
      const hasNew = last && last.senderId !== me.id && last.createdAt > since
      return hasNew
        ? db.groupMessage.count({ where: { groupId: m.groupId, createdAt: { gt: since }, senderId: { not: me.id } } })
        : Promise.resolve(0)
    })
  )

  // for cleared chats the latest VISIBLE message may differ from the latest one
  const lastRows = await Promise.all(
    visible.map((m) => {
      const last = m.group.messages[0] ?? null
      if (!m.clearedBeforeAt || (last && last.createdAt > m.clearedBeforeAt)) return Promise.resolve(last)
      return db.groupMessage.findFirst({
        where: { groupId: m.groupId, createdAt: { gt: m.clearedBeforeAt } },
        orderBy: { createdAt: 'desc' },
        include: { sender: { select: { name: true } } },
      })
    })
  )

  const groups = visible
    .map((m, i) => {
      const g = m.group
      const lastRow = lastRows[i] ?? null
      const last = lastRow
        ? {
            id: lastRow.id,
            content: lastRow.content,
            type: lastRow.type,
            senderId: lastRow.senderId,
            senderName: lastRow.sender.name,
            createdAt: lastRow.createdAt,
          }
        : null
      return toGroupItem(g, m.role, last, Math.min(99, unreadPairs[i] ?? 0), me.id)
    })
    .sort((a, b) => (b.lastMessage?.createdAt ?? b.updatedAt).localeCompare(a.lastMessage?.createdAt ?? a.updatedAt))
  return NextResponse.json({ groups })
}

export async function POST(req: Request) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!rateLimit(`groupcreate:${me.id}`, 8, 60_000)) {
    return NextResponse.json({ error: 'Too many groups created — slow down' }, { status: 429 })
  }
  try {
    const body = (await req.json()) as { name?: string; memberIds?: string[]; avatarUrl?: string | null }
    const name = String(body.name || '').trim().slice(0, 60)
    if (!name) return NextResponse.json({ error: 'Group name is required' }, { status: 400 })
    const memberIds = Array.from(new Set((body.memberIds || []).filter((x) => x && x !== me.id))).slice(0, 50)
    const avatarUrl = typeof body.avatarUrl === 'string' && body.avatarUrl.length < 300 ? body.avatarUrl : null

    const group = await db.group.create({
      data: {
        name,
        ownerId: me.id,
        avatarUrl,
        members: {
          create: [
            { userId: me.id, role: 'owner' },
            ...memberIds.map((uid) => ({ userId: uid, role: 'member' })),
          ],
        },
        messages: {
          create: {
            senderId: me.id,
            type: 'system',
            content: `${me.name} created the group “${name}”`,
          },
        },
      },
      include: { members: { include: { user: { select: { id: true, name: true, username: true, avatarKey: true, avatarUrl: true } } } } },
    })

    return NextResponse.json({
      group: toGroupItem(
        { id: group.id, name: group.name, avatarKey: group.avatarKey, ownerId: group.ownerId, updatedAt: group.updatedAt, members: group.members },
        'owner',
        null,
        0,
        me.id
      ),
    })
  } catch {
    return NextResponse.json({ error: 'Could not create the group' }, { status: 500 })
  }
}

export type { MemberRow }
