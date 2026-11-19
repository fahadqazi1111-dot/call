import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, rateLimit } from '@/lib/callapp/server'

/**
 * POST /api/groups/<id>/members { memberIds[] } — owner/admin adds members
 * PATCH /api/groups/<id>/members { userId, role } — owner promotes/demotes
 *   roles: 'admin' | 'member' (ownership transfers through the leave flow)
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params
  try {
    const body = (await req.json()) as { memberIds?: string[] }
    const group = await db.group.findUnique({
      where: { id },
      include: { members: { select: { userId: true, role: true } } },
    })
    if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    const mine = group.members.find((m) => m.userId === me.id)
    if (!mine || (mine.role !== 'owner' && mine.role !== 'admin')) {
      return NextResponse.json({ error: 'Only the owner or admins can add members' }, { status: 403 })
    }
    const existing = new Set(group.members.map((m) => m.userId))
    const toAdd = (body.memberIds || []).filter((x) => x && !existing.has(x)).slice(0, 50)
    const users = await db.user.findMany({ where: { id: { in: toAdd } }, select: { id: true, name: true } })
    for (const u of users) {
      await db.groupMember.create({ data: { groupId: id, userId: u.id, role: 'member' } })
    }
    if (users.length) {
      await db.groupMessage.create({
        data: {
          groupId: id,
          senderId: me.id,
          type: 'system',
          content: `${me.name} added ${users.map((u) => u.name).join(', ')}`,
        },
      })
      await db.group.update({ where: { id }, data: { updatedAt: new Date() } })
    }
    return NextResponse.json({ ok: true, added: users.length })
  } catch {
    return NextResponse.json({ error: 'Could not add members' }, { status: 500 })
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params
  try {
    const body = (await req.json()) as { userId?: string; role?: string }
    const userId = String(body.userId || '')
    const role = body.role === 'admin' ? 'admin' : 'member'
    const group = await db.group.findUnique({
      where: { id },
      include: { members: { select: { userId: true, role: true, id: true } } },
    })
    if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    if (group.ownerId !== me.id) {
      return NextResponse.json({ error: 'Only the owner can change roles' }, { status: 403 })
    }
    const target = group.members.find((m) => m.userId === userId)
    if (!target || target.role === 'owner') {
      return NextResponse.json({ error: 'Member not found' }, { status: 400 })
    }
    await db.groupMember.update({ where: { id: target.id }, data: { role } })
    if (role === 'admin') {
      await db.groupMessage.create({
        data: { groupId: id, senderId: me.id, type: 'system', content: `${me.name} made ${target.userId === me.id ? 'themselves' : 'a member'} an admin` },
      })
    }
    return NextResponse.json({ ok: true, role })
  } catch {
    return NextResponse.json({ error: 'Could not update the role' }, { status: 500 })
  }
}
