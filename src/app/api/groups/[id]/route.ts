import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/callapp/server'

/**
 * GET    /api/groups/<id>  — details + members + recent messages (auto marks read)
 * DELETE /api/groups/<id>  — leave the group (owner leaves → group deleted)
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params
  const membership = await db.groupMember.findUnique({
    where: { groupId_userId: { groupId: id, userId: me.id } },
  })
  if (!membership) return NextResponse.json({ error: 'Not a member of this group' }, { status: 403 })

  const [group, messages] = await Promise.all([
    db.group.findUnique({
      where: { id },
      include: {
        members: {
          include: { user: { select: { id: true, name: true, username: true, avatarKey: true, avatarUrl: true } } },
        },
      },
    }),
    db.groupMessage.findMany({
      where: { groupId: id },
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
        mine: m.senderId === me.id,
        sender: { id: m.sender.id, name: m.sender.name, avatarKey: m.sender.avatarKey, avatarUrl: m.sender.avatarUrl ?? null },
        createdAt: m.createdAt.toISOString(),
      })),
  })
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params
  const group = await db.group.findUnique({ where: { id }, include: { members: true } })
  if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 })
  const membership = group.members.find((m) => m.userId === me.id)
  if (!membership) return NextResponse.json({ error: 'Not a member' }, { status: 403 })

  if (group.ownerId === me.id) {
    // owner leaving dissolves the group
    await db.group.delete({ where: { id } })
    return NextResponse.json({ ok: true, dissolved: true })
  }
  await db.groupMember.delete({ where: { id: membership.id } })
  await db.groupMessage.create({
    data: { groupId: id, senderId: me.id, type: 'system', content: `${me.name} left the group` },
  })
  return NextResponse.json({ ok: true, dissolved: false })
}
