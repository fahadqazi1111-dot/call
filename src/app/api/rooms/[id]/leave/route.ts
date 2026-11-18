import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/callapp/server'

/** POST: leave the room (participant record closed; paid fee is not refunded). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params
  await db.roomParticipant.updateMany({
    where: { roomId: id, userId: me.id, leftAt: null },
    data: { leftAt: new Date(), role: 'listener', handRaised: false },
  })
  return NextResponse.json({ ok: true })
}
