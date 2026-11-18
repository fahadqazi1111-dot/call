import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSetting } from '@/lib/callapp/server'

/**
 * GET ?placement=chats|rooms|profile — active ads for a placement.
 * Serves BOTH admin house ads and user campaigns that are ACTIVE AND PAID.
 * Unpaid campaigns (pending_payment) can never appear here. Ads are
 * lightweight banner cards rendered only in LIST screens — never overlaid on
 * active calls, chat conversations, voice rooms or live streams.
 */
export async function GET(req: Request) {
  const placement = new URL(req.url).searchParams.get('placement') || 'chats'
  const cfg = await getSetting<{ enabled: boolean; placements: string[] }>('ads', {
    enabled: true,
    placements: ['chats', 'rooms', 'profile'],
  })
  if (!cfg.enabled || !cfg.placements.includes(placement)) {
    return NextResponse.json({ ads: [], enabled: false })
  }
  const now = new Date()
  const ads = await db.ad.findMany({
    where: {
      status: 'active',
      placements: { contains: placement },
      OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      AND: [{ OR: [{ endsAt: null }, { endsAt: { gt: now } }] }],
    },
    orderBy: { weight: 'desc' },
    take: 5,
  })
  return NextResponse.json({
    enabled: true,
    ads: ads.map((a) => ({ id: a.id, title: a.title, body: a.body, imageUrl: a.imageUrl, linkUrl: a.linkUrl })),
  })
}
