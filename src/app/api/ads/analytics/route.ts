import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/callapp/server'

/**
 * GET /api/ads/analytics — advertiser performance dashboard data.
 * Advertisers can ONLY see their own campaigns (ownerId = me).
 * Returns totals (impressions / clicks / CTR / spend), a per-campaign
 * breakdown and a 14-day daily series computed from the deduped AdEvent log.
 */
export async function GET(req: Request) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const since = new Date(Date.now() - 13 * 24 * 60 * 60 * 1000)
  since.setHours(0, 0, 0, 0)

  const [campaigns, events] = await Promise.all([
    db.ad.findMany({
      where: { ownerId: me.id, isUserAd: true },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        status: true,
        placements: true,
        budget: true,
        totalCost: true,
        impressions: true,
        clicks: true,
        startsAt: true,
        endsAt: true,
        createdAt: true,
        rejectionReason: true,
      },
    }),
    db.adEvent.findMany({
      where: { ad: { ownerId: me.id }, createdAt: { gte: since } },
      select: { adId: true, kind: true, dayKey: true, createdAt: true },
    }),
  ])

  // live totals from the deduped event log (authoritative)
  const totalsEvents = await db.adEvent.groupBy({
    by: ['kind'],
    where: { ad: { ownerId: me.id } },
    _count: { _all: true },
  })
  const impressions = totalsEvents.find((e) => e.kind === 'impression')?._count._all ?? 0
  const clicks = totalsEvents.find((e) => e.kind === 'click')?._count._all ?? 0
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0
  const spend = campaigns.reduce((s, c) => s + (c.totalCost || 0), 0)
  const activeCampaigns = campaigns.filter((c) => c.status === 'active' || c.status === 'approved').length

  const perCampaign = new Map<string, { impressions: number; clicks: number }>()
  for (const e of events) {
    const agg = perCampaign.get(e.adId) ?? { impressions: 0, clicks: 0 }
    if (e.kind === 'impression') agg.impressions++
    else if (e.kind === 'click') agg.clicks++
    perCampaign.set(e.adId, agg)
  }

  const daily: { day: string; impressions: number; clicks: number }[] = []
  for (let i = 0; i < 14; i++) {
    const d = new Date(since.getTime() + i * 24 * 60 * 60 * 1000)
    const key = d.toISOString().slice(0, 10)
    daily.push({ day: key, impressions: 0, clicks: 0 })
  }
  const dailyMap = new Map(daily.map((d) => [d.day, d]))
  for (const e of events) {
    const row = dailyMap.get(e.createdAt.toISOString().slice(0, 10))
    if (row) {
      if (e.kind === 'impression') row.impressions++
      else if (e.kind === 'click') row.clicks++
    }
  }

  return NextResponse.json({
    totals: { impressions, clicks, ctr, spend, activeCampaigns, campaigns: campaigns.length },
    campaigns: campaigns.map((c) => {
      const agg = perCampaign.get(c.id)
      const imp14 = agg?.impressions ?? 0
      const clk14 = agg?.clicks ?? 0
      return {
        ...c,
        ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0,
        last14Days: { impressions: imp14, clicks: clk14 },
      }
    }),
    daily,
  })
}
