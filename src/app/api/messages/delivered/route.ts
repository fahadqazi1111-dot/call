import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/callapp/server'

/**
 * POST { ids: string[] } — DELIVERY receipts. The receiving device calls this
 * (batched, debounced) for incoming message ids; only messages addressed to
 * me can be marked delivered. The sender's UI then shows:
 *   ✓ sent   ✓✓ delivered (grey)   ✓✓ read (blue)
 */
export async function POST(req: Request) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await req.json()
    const ids: string[] = Array.isArray(body.ids) ? body.ids.filter((x: unknown) => typeof x === 'string').slice(0, 100) : []
    if (!ids.length) return NextResponse.json({ ok: true, updated: 0 })
    // only mark messages that were sent TO me (senderId !== me) and not yet delivered
    const res = await db.message.updateMany({
      where: { id: { in: ids }, deliveredAt: null, senderId: { not: me.id } },
      data: { deliveredAt: new Date() },
    })
    return NextResponse.json({ ok: true, updated: res.count })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
