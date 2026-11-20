import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/callapp/server'

/**
 * POST { battleId, accept } — invitee accepts or rejects a battle invitation.
 * When every participant has accepted, the battle flips to `countdown`
 * (startedAt=now, endsAt=now+duration+countdown handled client-side timing via
 * socket). Returns the full battle state.
 */
export async function POST(req: Request) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await req.json()
    const battleId = String(body.battleId || '')
    const accept = !!body.accept
    const battle = await db.battle.findUnique({ where: { id: battleId }, include: { participants: true } })
    if (!battle) return NextResponse.json({ error: 'Battle not found' }, { status: 404 })
    if (battle.status !== 'inviting') {
      return NextResponse.json({ error: 'Battle already started or ended' }, { status: 400 })
    }
    const mine = battle.participants.find((p) => p.userId === me.id)
    if (!mine) return NextResponse.json({ error: 'Not a participant' }, { status: 403 })

    if (!accept) {
      // rejection cancels the battle; host must re-invite
      await db.battle.update({ where: { id: battle.id }, data: { status: 'ended', endedAt: new Date(), winnerSide: null } })
      await db.notification.create({
        data: {
          userId: battle.participants.find((p) => p.side === 0 && p.slot === 0)?.userId ?? me.id,
          kind: 'battle_result',
          title: `${me.name} declined the battle`,
          refType: 'battle',
          refId: battle.id,
        },
      })
      return NextResponse.json({ ok: true, status: 'declined' })
    }

    await db.battleParticipant.update({ where: { id: mine.id }, data: { accepted: true } })
    const fresh = await db.battle.findUnique({ where: { id: battle.id }, include: { participants: true } })
    if (!fresh) return NextResponse.json({ error: 'Battle missing' }, { status: 500 })
    const allAccepted = fresh.participants.every((p) => p.accepted)
    if (allAccepted) {
      await db.battle.update({
        where: { id: fresh.id },
        data: { status: 'countdown', startedAt: new Date() },
      })
      return NextResponse.json({ ok: true, status: 'countdown', startedAt: new Date().toISOString() })
    }
    return NextResponse.json({ ok: true, status: 'inviting' })
  } catch {
    return NextResponse.json({ error: 'Respond failed' }, { status: 500 })
  }
}
