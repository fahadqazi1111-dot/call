import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/callapp/server'

/**
 * POST /api/groups/<id>/members { memberIds[] } — owner/admin adds members
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
      return NextResponse.json({ error: 'Only the owner can add members' }, { status: 403 })
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
