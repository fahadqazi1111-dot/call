import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/callapp/server'

/** GET: battles I participated in (history + leaderboard data comes from scores). */
export async function GET(req: Request) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const parts = await db.battleParticipant.findMany({
    where: { userId: me.id },
    orderBy: { id: 'desc' },
    take: 30,
    include: { battle: { include: { participants: true } } },
  })
  const battles = parts.map((p) => {
    const b = p.battle
    const sideScores = [0, 1].map((side) =>
      b.participants.filter((x) => x.side === side).reduce((n, x) => n + x.score, 0)
    )
    return {
      id: b.id,
      mode: b.mode,
      status: b.status,
      winnerSide: b.winnerSide,
      mySide: p.side,
      won: b.winnerSide === p.side,
      sideScores,
      startedAt: b.startedAt?.toISOString() ?? null,
      endedAt: b.endedAt?.toISOString() ?? null,
      participants: b.participants.map((x) => ({
        userId: x.userId,
        name: x.name,
        avatarKey: x.avatarKey,
        avatarUrl: x.avatarUrl,
        side: x.side,
        score: x.score,
      })),
    }
  })
  return NextResponse.json({ battles })
}

/** GET /api/battles?id=… detail */
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
    const sideScores = [0, 1].map((side) =>
      battle.participants.filter((x) => x.side === side).reduce((n, x) => n + x.score, 0)
    )
    return NextResponse.json({
      battle: {
        id: battle.id,
        mode: battle.mode,
        status: battle.status,
        winnerSide: battle.winnerSide,
        sideScores,
        startedAt: battle.startedAt?.toISOString() ?? null,
        endsAt: battle.endsAt?.toISOString() ?? null,
        participants: battle.participants.map((x) => ({
          userId: x.userId,
          name: x.name,
          avatarKey: x.avatarKey,
          avatarUrl: x.avatarUrl,
          side: x.side,
          slot: x.slot,
          accepted: x.accepted,
          score: x.score,
        })),
      },
    })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
