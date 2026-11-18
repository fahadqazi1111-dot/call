import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/callapp/server'

/**
 * GET ?context=room&roomId=… | ?context=live&liveId=… | ?context=battle&battleId=…[&battleSide=]
 * Returns the ELIGIBLE gift recipients for the current viewer — always
 * excludes the viewer themself (self-gifting prevention at the UI layer,
 * enforced again server-side at checkout time).
 */
export async function GET(req: Request) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const url = new URL(req.url)
  const context = url.searchParams.get('context') || 'live'

  interface Recipient {
    id: string
    name: string
    avatarKey: number
    avatarUrl: string | null
    role: string
    side: number | null
    score: number
  }
  const out: Recipient[] = []
  const pushUser = (id: string, name: string, role: string, side: number | null = null, score = 0) => {
    if (id === me.id) return
    out.push({ id, name, avatarKey: 0, avatarUrl: null, role, side, score })
  }

  if (context === 'room') {
    const roomId = url.searchParams.get('roomId') || ''
    const parts = await db.roomParticipant.findMany({
      where: { roomId, role: { in: ['host', 'cohost'] } },
      select: { userId: true, role: true },
    })
    const users = await db.user.findMany({
      where: { id: { in: parts.map((p) => p.userId) } },
      select: { id: true, name: true, avatarKey: true, avatarUrl: true },
    })
    for (const p of parts) {
      const u = users.find((x) => x.id === p.userId)
      if (u) pushUser(u.id, u.name, p.role)
    }
  } else if (context === 'battle') {
    const battleId = url.searchParams.get('battleId') || ''
    const parts = await db.battleParticipant.findMany({
      where: { battleId },
      select: { userId: true, name: true, avatarKey: true, avatarUrl: true, side: true, score: true },
    })
    for (const p of parts) pushUser(p.userId, p.name, 'battle', p.side, p.score)
  } else {
    const liveId = url.searchParams.get('liveId') || ''
    const live = await db.liveSession.findUnique({ where: { id: liveId }, select: { hostId: true } })
    if (live) {
      const host = await db.user.findUnique({
        where: { id: live.hostId },
        select: { id: true, name: true, avatarKey: true, avatarUrl: true },
      })
      if (host) pushUser(host.id, host.name, 'host')
    }
  }

  // fill avatar info for battle participants
  const ids = out.filter((r) => r.avatarUrl === null && r.avatarKey === 0).map((r) => r.id)
  if (ids.length) {
    const users = await db.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, avatarKey: true, avatarUrl: true },
    })
    for (const r of out) {
      const u = users.find((x) => x.id === r.id)
      if (u) {
        r.avatarKey = u.avatarKey
        r.avatarUrl = u.avatarUrl
      }
    }
  }

  return NextResponse.json({ recipients: out })
}
