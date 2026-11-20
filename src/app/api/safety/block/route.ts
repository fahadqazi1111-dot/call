import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/callapp/server'

/**
 * POST { userId } — block a user. Blocking is mutual-effect: once either side
 * blocks, messaging and calls fail in BOTH directions (enforced server-side in
 * /api/messages and the call verifier). Duplicate blocks are ignored.
 */
export async function POST(req: Request) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await req.json()
    const userId = String(body.userId || '')
    if (!userId || userId === me.id) return NextResponse.json({ error: 'Invalid user' }, { status: 400 })
    const target = await db.user.findUnique({ where: { id: userId }, select: { id: true } })
    if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    await db.userBlock.upsert({
      where: { blockerId_blockedId: { blockerId: me.id, blockedId: userId } },
      update: {},
      create: { blockerId: me.id, blockedId: userId },
    })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
