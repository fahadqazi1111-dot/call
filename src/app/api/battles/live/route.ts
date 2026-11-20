import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/callapp/server'

/**
 * GET ?liveId=… — the ACTIVE battle for a live session (status countdown or
 * live), with participants and current team points. Viewers joining mid-
 * battle used to start at score 0-0 with battleId '' — they only caught up
 * on the NEXT score relay. Now they see real scores instantly on join.
 */
export async function GET(req: Request) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const liveId = new URL(req.url).searchParams.get('liveId') || ''
  if (!liveId) return NextResponse.json({ error: 'liveId required' }, { status: 400 })
  const battle = await db.battle.findFirst({
    where: { liveId, status: { in: ['countdown', 'live'] } },
    orderBy: { id: 'desc' },
    include: { participants: true },
  })
  if (!battle) return NextResponse.json({ battle: null })
  const endsAt =
    battle.status === 'live' && battle.startedAt
      ? battle.startedAt.getTime() + battle.durationSec * 1000
      : null
  return NextResponse.json({
    battle: {
      id: battle.id,
      status: battle.status,
      mode: battle.mode,
      endsAt,
      sideScores: [Math.round(battle.sideAPoints), Math.round(battle.sideBPoints)],
      participants: battle.participants.map((p) => ({
        userId: p.userId,
        name: p.name,
        avatarKey: p.avatarKey,
        avatarUrl: p.avatarUrl,
        side: p.side,
        slot: p.slot,
        accepted: p.accepted,
        score: Math.round(p.score),
      })),
    },
  })
}
