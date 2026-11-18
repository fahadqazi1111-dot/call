import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, getSetting, rateLimit } from '@/lib/callapp/server'

interface InviteBody {
  liveId: string
  mode: '1v1' | '2v2'
  targetIds: string[]
  durationSec?: number
}

/**
 * POST — host invites users to a battle on their live.
 * Creates Battle (inviting) + participant rows. Side 0 slot 0 = inviter.
 * Targets receive battle_invites notifications; realtime invite goes via socket.
 */
export async function POST(req: Request) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!rateLimit(`battleinvite:${me.id}`, 10, 60_000)) {
    return NextResponse.json({ error: 'Too many invites' }, { status: 429 })
  }
  try {
    const body = (await req.json()) as InviteBody
    const live = await db.liveSession.findUnique({ where: { id: String(body.liveId || '') } })
    if (!live || live.status !== 'live' || live.hostId !== me.id) {
      return NextResponse.json({ error: 'You must be the live host to invite' }, { status: 403 })
    }
    const cfg = await getSetting<{ allowBattles: boolean; battleDurations: number[] }>('live', {
      allowBattles: true,
      battleDurations: [60, 120, 180],
    })
    if (!cfg.allowBattles) return NextResponse.json({ error: 'Battles are disabled by the admin' }, { status: 400 })
    const mode = body.mode === '2v2' ? '2v2' : '1v1'
    const needed = mode === '1v1' ? 1 : 3
    const targets = (body.targetIds || []).filter((t) => t && t !== me.id).slice(0, needed)
    if (targets.length !== needed) {
      return NextResponse.json({ error: `${mode} battle needs ${needed} invitee(s)` }, { status: 400 })
    }
    const durationSec = cfg.battleDurations.includes(Number(body.durationSec)) ? Number(body.durationSec) : 120

    const battle = await db.battle.create({
      data: { liveId: live.id, mode, durationSec, status: 'inviting' },
    })
    await db.battleParticipant.create({
      data: {
        battleId: battle.id,
        userId: me.id,
        side: 0,
        slot: 0,
        name: me.name,
        avatarKey: me.avatarKey,
        avatarUrl: me.avatarUrl,
        accepted: true,
      },
    })
    for (let i = 0; i < targets.length; i++) {
      const u = await db.user.findUnique({ where: { id: targets[i] } })
      if (!u) continue
      // 2v2 seating: inviter=side0/slot0; targets[0] joins their team (side0/slot1);
      // targets[1] and targets[2] form the opposing team (side1, slots 0/1).
      const side = mode === '1v1' ? 1 : i === 0 ? 0 : 1
      const slot = mode === '1v1' ? 0 : i === 0 ? 1 : i === 1 ? 0 : 1
      await db.battleParticipant.create({
        data: {
          battleId: battle.id,
          userId: u.id,
          side,
          slot,
          name: u.name,
          avatarKey: u.avatarKey,
          avatarUrl: u.avatarUrl,
          accepted: false,
        },
      })
      await db.notification.create({
        data: {
          userId: u.id,
          kind: 'battle_invite',
          title: `${me.name} invited you to a ${mode} live battle`,
          refType: 'battle',
          refId: battle.id,
        },
      })
    }
    await db.liveSession.update({ where: { id: live.id }, data: { mode: 'battle', battleId: battle.id } })
    return NextResponse.json({
      ok: true,
      battle: { id: battle.id, mode, durationSec, status: battle.status },
    })
  } catch {
    return NextResponse.json({ error: 'Invite failed' }, { status: 500 })
  }
}
