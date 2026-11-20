import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/callapp/server'

/**
 * POST { battleId } — finalize a battle: winner computed from participant
 * scores (gift-based), persisted, notifications sent. Host (or admin) calls it
 * when the battle timer ends.
 */
export async function POST(req: Request) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await req.json()
    const battle = await db.battle.findUnique({
      where: { id: String(body.battleId || '') },
      include: { participants: true },
    })
    if (!battle) return NextResponse.json({ error: 'Battle not found' }, { status: 404 })
    if (battle.status === 'ended') {
      return NextResponse.json({ ok: true, alreadyEnded: true, winnerSide: battle.winnerSide })
    }
    const isParticipant = battle.participants.some((p) => p.userId === me.id)
    if (!isParticipant && me.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const sideScores = [
      Math.round(battle.sideAPoints),
      Math.round(battle.sideBPoints),
    ]
    const winnerSide = sideScores[0] === sideScores[1] ? null : sideScores[0] > sideScores[1] ? 0 : 1
    await db.battle.update({
      where: { id: battle.id },
      data: { status: 'ended', endedAt: new Date(), winnerSide },
    })
    for (const p of battle.participants) {
      const won = winnerSide === p.side
      const tie = winnerSide === null
      await db.notification.create({
        data: {
          userId: p.userId,
          kind: 'battle_result',
          title: tie ? 'Battle ended in a draw' : won ? 'You WON the battle! 🏆' : 'Battle lost — better luck next time',
          body: `Final points: ${sideScores[0]} — ${sideScores[1]}`,
          refType: 'battle',
          refId: battle.id,
        },
      })
    }
    return NextResponse.json({ ok: true, winnerSide, sideScores })
  } catch {
    return NextResponse.json({ error: 'Finish failed' }, { status: 500 })
  }
}
