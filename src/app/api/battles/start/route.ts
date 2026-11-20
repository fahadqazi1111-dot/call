import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/callapp/server'

/**
 * POST { battleId } — the host's countdown finished: mark the battle LIVE in
 * the DB. Without this row status the tap route (status === 'live' required)
 * rejected EVERY double-tap and the battle score never moved.
 * Only a battle participant (the host drives) or an admin may start it.
 */
export async function POST(req: Request) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = (await req.json()) as { battleId?: string }
    const battle = await db.battle.findUnique({
      where: { id: String(body.battleId || '') },
      include: { participants: true },
    })
    if (!battle) return NextResponse.json({ error: 'Battle not found' }, { status: 404 })
    if (battle.status === 'ended') {
      return NextResponse.json({ error: 'Battle already ended' }, { status: 400 })
    }
    const isParticipant = battle.participants.some((p) => p.userId === me.id)
    if (!isParticipant && me.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (battle.status !== 'live') {
      await db.battle.update({
        where: { id: battle.id },
        // re-anchor the clock at the LIVE phase start so late-joiners
        // computing endsAt = startedAt + durationSec match the host broadcast
        data: { status: 'live', startedAt: new Date() },
      })
    }
    return NextResponse.json({
      ok: true,
      battleId: battle.id,
      sideScores: [Math.round(battle.sideAPoints), Math.round(battle.sideBPoints)],
    })
  } catch {
    return NextResponse.json({ error: 'Start failed' }, { status: 500 })
  }
}
