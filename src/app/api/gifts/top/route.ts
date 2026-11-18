import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, round2 } from '@/lib/callapp/server'

/**
 * GET ?roomId=… | ?liveId=… — gift session stats:
 *  - host session earnings (gross / commission / net)
 *  - top gifters leaderboard (ranked by VERIFIED gift money)
 *  - recent gift activity
 */
export async function GET(req: Request) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const url = new URL(req.url)
  const roomId = url.searchParams.get('roomId') || ''
  const liveId = url.searchParams.get('liveId') || ''
  if (!roomId && !liveId) return NextResponse.json({ error: 'roomId or liveId required' }, { status: 400 })

  // Session stats include sandbox/test gifts so hosts see activity during test
  // mode — the ADMIN financial dashboard separately reports real money only.
  const where = roomId ? { roomId } : { liveId }
  const sends = await db.giftSend.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      gift: { select: { name: true, emoji: true, priceUsd: true } },
      sender: { select: { id: true, name: true, avatarKey: true, avatarUrl: true } },
    },
  })

  const totals = sends.reduce(
    (acc, s) => ({
      gross: acc.gross + s.grossAmount,
      commission: acc.commission + s.commission,
      net: acc.net + s.netAmount,
      count: acc.count + 1,
    }),
    { gross: 0, commission: 0, net: 0, count: 0 }
  )

  // top gifters (verified money per sender)
  const bySender = new Map<string, { name: string; avatarKey: number; avatarUrl: string | null; total: number; count: number }>()
  for (const s of sends) {
    const cur = bySender.get(s.senderId) ?? { name: s.sender.name, avatarKey: s.sender.avatarKey, avatarUrl: s.sender.avatarUrl, total: 0, count: 0 }
    cur.total = round2(cur.total + s.grossAmount)
    cur.count += 1
    bySender.set(s.senderId, cur)
  }
  const topGifters = Array.from(bySender.entries())
    .map(([id, v]) => ({ userId: id, ...v }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)

  return NextResponse.json({
    totals: {
      gross: round2(totals.gross),
      commission: round2(totals.commission),
      net: round2(totals.net),
      count: totals.count,
    },
    topGifters,
    recent: sends.slice(0, 25).map((s) => ({
      id: s.id,
      gift: { name: s.gift.name, emoji: s.gift.emoji },
      from: { id: s.sender.id, name: s.sender.name, avatarKey: s.sender.avatarKey, avatarUrl: s.sender.avatarUrl },
      amount: s.grossAmount,
      isTest: s.isTest,
      createdAt: s.createdAt.toISOString(),
    })),
  })
}
