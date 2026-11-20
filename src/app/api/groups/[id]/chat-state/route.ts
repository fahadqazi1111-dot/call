import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, rateLimit } from '@/lib/callapp/server'

/**
 * POST /api/groups/<id>/chat-state { action: 'clear' | 'delete' }
 * WhatsApp-style per-user chat state — only affects the caller's own view:
 *  - clear  → hide every message sent before now (chat stays in the list)
 *  - delete → hide the group from my list; it re-appears when someone
 *             sends a new message after this moment (history also cleared)
 * Other members see nothing — the group and its messages stay intact for them.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params
  if (!rateLimit(`groupstate:${me.id}`, 20, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }
  try {
    const body = (await req.json()) as { action?: string }
    const action = String(body.action || '')
    const membership = await db.groupMember.findUnique({
      where: { groupId_userId: { groupId: id, userId: me.id } },
      select: { id: true },
    })
    if (!membership) return NextResponse.json({ error: 'Not a member of this group' }, { status: 403 })
    const now = new Date()
    if (action === 'clear') {
      await db.groupMember.update({ where: { id: membership.id }, data: { clearedBeforeAt: now } })
    } else if (action === 'delete') {
      await db.groupMember.update({
        where: { id: membership.id },
        data: { deletedAt: now, clearedBeforeAt: now },
      })
    } else {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
    return NextResponse.json({ ok: true, action })
  } catch {
    return NextResponse.json({ error: 'Could not update chat state' }, { status: 500 })
  }
}
