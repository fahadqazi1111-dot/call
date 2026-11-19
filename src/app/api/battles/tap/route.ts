import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, rateLimit } from '@/lib/callapp/server'
import { relayToLive } from '@/lib/callapp/relay'

/**
 * POST { battleId, side } — TikTok-style double-tap scoring.
 * Any viewer (or participant) can tap for a team; each tap adds 1 point to
 * that side's team total. Gifts remain the heavy booster (price × 100).
 * The authoritative team total is returned and relayed to the whole live.
 */
export async function POST(req: Request) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!rateLimit(`battletap:${me.id}`, 40, 10_000)) {
    return NextResponse.json({ error: 'Too many taps — slow down' }, { status: 429 })
  }
  try {
    const body = (await req.json()) as { battleId?: string; side?: number }
    const battleId = String(body.battleId || '')
    const side = body.side === 1 ? 1 : 0
    const battle = await db.battle.findUnique({ where: { id: battleId } })
    if (!battle || battle.status !== 'live') {
      return NextResponse.json({ error: 'Battle is not live' }, { status: 400 })
    }
    const pointsField = side === 0 ? 'sideAPoints' : 'sideBPoints'
    const updated = await db.battle.update({
      where: { id: battle.id },
      data: { [pointsField]: { increment: 1 } },
    })
    const total = Math.round(side === 0 ? updated.sideAPoints : updated.sideBPoints)

    // relay to everyone watching this live so all score bars move together
    if (battle.liveId) {
      void relayToLive(battle.liveId, 'battle:score', {
        battleId: battle.id,
        side,
        added: 1,
        total,
      })
    }
    return NextResponse.json({ ok: true, side, total })
  } catch {
    return NextResponse.json({ error: 'Tap failed' }, { status: 500 })
  }
}
