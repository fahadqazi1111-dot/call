import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSetting } from '@/lib/callapp/server'

export interface AdsSettings {
  enabled: boolean
  placements: string[]
  /** show an ad in a chat after this many messages */
  chatAdFirstAfter: number
  /** then show the next ad after this many further messages */
  chatAdInterval: number
  /** effective CPM (USD per 1000 impressions) used for budget-based impression caps */
  cpmUsd: number
}

export const ADS_DEFAULTS: AdsSettings = {
  enabled: true,
  placements: ['chats', 'rooms', 'profile'],
  chatAdFirstAfter: 10,
  chatAdInterval: 20,
  cpmUsd: 2.5,
}

/**
 * GET ?placement=chats|rooms|profile
 *
 * Ad-serving with FAIR ROTATION: eligible ads are scored by
 *   score = weight × hoursSinceLastServed (never-served ads get a bonus)
 * and one winner is drawn weighted by score — heavier weights serve more
 * often, but every eligible ad rotates instead of one ad dominating.
 * The same ad is not returned twice for the same viewer request when other
 * eligible ads exist (`exclude` param).
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const placement = url.searchParams.get('placement') || 'chats'
  const exclude = (url.searchParams.get('exclude') || '').split(',').filter(Boolean)
  const cfg = await getSetting<AdsSettings>('ads', ADS_DEFAULTS)

  const merged: AdsSettings = { ...ADS_DEFAULTS, ...cfg }
  if (!merged.enabled || !merged.placements.includes(placement)) {
    return NextResponse.json({
      ads: [],
      enabled: false,
      chatAd: { firstAfter: merged.chatAdFirstAfter, interval: merged.chatAdInterval },
    })
  }
  const now = new Date()
  const ads = await db.ad.findMany({
    where: {
      status: 'active',
      placements: { contains: placement },
      OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      AND: [{ OR: [{ endsAt: null }, { endsAt: { gt: now } }] }],
    },
  })

  // budget guard: a paid campaign with a budget stops serving once it has
  // delivered the impressions its budget covers (budget / CPM × 1000)
  const cpm = Math.max(0.1, merged.cpmUsd || 2.5)
  const eligible = ads.filter((a) => {
    if (exclude.includes(a.id)) return false
    if (a.budget > 0) {
      const maxImpressions = Math.floor((a.budget / cpm) * 1000)
      if (a.impressions >= maxImpressions) return false
    }
    return true
  })
  if (eligible.length === 0) {
    return NextResponse.json({
      ads: [],
      enabled: true,
      chatAd: { firstAfter: merged.chatAdFirstAfter, interval: merged.chatAdInterval },
    })
  }

  // ---- weighted least-recently-served rotation ----
  const scored = eligible.map((a) => {
    const hours = a.lastServedAt ? (now.getTime() - a.lastServedAt.getTime()) / 3_600_000 : 72
    const weight = Math.max(1, a.weight || 1)
    return { ad: a, score: weight * Math.max(0.5, hours) }
  })
  const total = scored.reduce((s, x) => s + x.score, 0)
  let roll = Math.random() * total
  let picked = scored[scored.length - 1].ad
  for (const s of scored) {
    roll -= s.score
    if (roll <= 0) {
      picked = s.ad
      break
    }
  }

  // record serve for the rotation clock (best-effort)
  void db.ad
    .update({ where: { id: picked.id }, data: { lastServedAt: new Date(), serves: { increment: 1 } } })
    .catch(() => {})

  return NextResponse.json({
    ads: [
      {
        id: picked.id,
        title: picked.title,
        body: picked.body,
        imageUrl: picked.imageUrl,
        mediaKind: picked.mediaKind,
        linkUrl: picked.linkUrl,
      },
    ],
    enabled: true,
    chatAd: { firstAfter: merged.chatAdFirstAfter, interval: merged.chatAdInterval },
  })
}
