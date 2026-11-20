import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/callapp/server'

/** POST { userId } — remove a block I issued. Idempotent. */
export async function POST(req: Request) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await req.json()
    const userId = String(body.userId || '')
    if (!userId) return NextResponse.json({ error: 'Invalid user' }, { status: 400 })
    await db.userBlock.deleteMany({ where: { blockerId: me.id, blockedId: userId } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
