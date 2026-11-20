import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/callapp/server'

/** GET: the users I blocked (safety list). */
export async function GET(req: Request) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const blocks = await db.userBlock.findMany({
    where: { blockerId: me.id },
    orderBy: { createdAt: 'desc' },
    include: { blocked: { select: { id: true, name: true, username: true, avatarKey: true, avatarUrl: true } } },
  })
  return NextResponse.json({
    blocked: blocks.map((b) => ({
      id: b.blocked.id,
      name: b.blocked.name,
      username: b.blocked.username,
      avatarKey: b.blocked.avatarKey,
      avatarUrl: b.blocked.avatarUrl,
    })),
  })
}
