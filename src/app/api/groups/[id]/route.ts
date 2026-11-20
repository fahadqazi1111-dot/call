import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, rateLimit } from '@/lib/callapp/server'

/**
 * GET  /api/groups/<id>  — details + members + recent messages (auto marks read)
 * PATCH  /api/groups/<id>  { name?, avatarUrl? } — owner updates the group profile
 * DELETE /api/groups/<id>  — leave the group. If the OWNER leaves, ownership is
 *                            transferred (first admin, else earliest member) —
 *                            the group survives. A group with no members dissolves.
 */

const MEMBER_INCLUDE = {
  members: {
    include: { user: { select: { id: true, name: true, username: true, avatarKey: true, avatarUrl: true } } },
  },
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params
  const membership = await db.groupMember.findUnique({
    where: { groupId_userId: { groupId: id, userId: me.id } },
  })
  if (!membership) return NextResponse.json({ error: 'Not a member of this group' }, { status: 403 })

  const [group, messages] = await Promise.all([
    db.group.findUnique({ where: { id }, include: MEMBER_INCLUDE }),
    db.groupMessage.findMany({
      where: {
        groupId: id,
        // "Clear chat" is per-user: hide everything sent before my clear moment
        ...(membership.clearedBeforeAt ? { createdAt: { gt: membership.clearedBeforeAt } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 60,
      include: { sender: { select: { id: true, name: true, avatarKey: true, avatarUrl: true } } },
    }),
  ])
  if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 })

  // mark read up to now
  await db.groupMember.update({ where: { id: membership.id }, data: { lastReadAt: new Date() } })

  return NextResponse.json({
    group: {
      id: group.id,
      name: group.name,
      avatarKey: group.avatarKey,
      avatarUrl: group.avatarUrl ?? null,
      ownerId: group.ownerId,
      myRole: membership.role,
      members: group.members.map((mm) => ({
        id: mm.user.id,
        name: mm.user.name,
        username: mm.user.username,
        avatarKey: mm.user.avatarKey,
        avatarUrl: mm.user.avatarUrl ?? null,
        role: mm.role,
      })),
    },
    messages: messages
      .reverse()
      .map((m) => ({
        id: m.id,
        type: m.type,
        content: m.content,
        mediaId: m.mediaId ?? null,
        duration: m.duration ?? null,
        mine: m.senderId === me.id,
        sender: { id: m.sender.id, name: m.sender.name, avatarKey: m.sender.avatarKey, avatarUrl: m.sender.avatarUrl ?? null },
        createdAt: m.createdAt.toISOString(),
      })),
  })
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params
  const group = await db.group.findUnique({ where: { id } })
  if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 })
  if (group.ownerId !== me.id) {
    return NextResponse.json({ error: 'Only the owner can edit the group' }, { status: 403 })
  }
  try {
    const body = (await req.json()) as { name?: string; avatarUrl?: string | null }
    const data: { name?: string; avatarUrl?: string | null } = {}
    if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim().slice(0, 60)
    if (body.avatarUrl !== undefined) data.avatarUrl = body.avatarUrl
    const updated = await db.group.update({ where: { id }, data })
    return NextResponse.json({ ok: true, name: updated.name, avatarUrl: updated.avatarUrl ?? null })
  } catch {
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params
  const group = await db.group.findUnique({
    where: { id },
    include: { members: { orderBy: { joinedAt: 'asc' }, include: { user: { select: { name: true } } } } },
  })
  if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 })
  const membership = group.members.find((m) => m.userId === me.id)
  if (!membership) return NextResponse.json({ error: 'Not a member' }, { status: 403 })

  if (group.ownerId === me.id) {
    // owner leaving → hand the group over (first admin, else earliest member)
    const others = group.members.filter((m) => m.userId !== me.id)
    if (others.length === 0) {
      await db.group.delete({ where: { id } })
      return NextResponse.json({ ok: true, dissolved: true })
    }
    const nextOwner = others.find((m) => m.role === 'admin') ?? others[0]
    await db.$transaction([
      db.groupMember.update({ where: { id: nextOwner.id }, data: { role: 'owner' } }),
      db.group.update({ where: { id }, data: { ownerId: nextOwner.userId } }),
      db.groupMember.delete({ where: { id: membership.id } }),
    ])
    await db.groupMessage.create({
      data: {
        groupId: id,
        senderId: me.id,
        type: 'system',
        content: `${me.name} left — ${nextOwner.user?.name || 'a member'} is the new owner`,
      },
    })
    return NextResponse.json({ ok: true, dissolved: false, newOwner: nextOwner.userId })
  }

  await db.groupMember.delete({ where: { id: membership.id } })
  await db.groupMessage.create({
    data: { groupId: id, senderId: me.id, type: 'system', content: `${me.name} left the group` },
  })
  return NextResponse.json({ ok: true, dissolved: false })
}
