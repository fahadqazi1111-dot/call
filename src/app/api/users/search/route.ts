import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/callapp/server'

/**
 * GET /api/users/search?q=<name or username>
 * Registered-user search used by the battle invite / group creation /
 * invite popups — searches EVERY account, not just saved contacts.
 */
export async function GET(req: Request) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const q = (new URL(req.url).searchParams.get('q') || '').trim().toLowerCase()
  if (q.length < 1) return NextResponse.json({ users: [] })
  const users = await db.user.findMany({
    where: {
      blocked: false,
      id: { not: me.id },
      OR: [
        { name: { contains: q } },
        { username: { contains: q } },
      ],
    },
    select: { id: true, name: true, username: true, avatarKey: true, avatarUrl: true, role: true, isOfficial: true },
    orderBy: { name: 'asc' },
    take: 20,
  })
  return NextResponse.json({ users })
}
