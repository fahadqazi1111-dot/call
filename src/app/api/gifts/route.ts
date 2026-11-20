import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, getFinance, getCoinSettings } from '@/lib/callapp/server'

/** GET ?context=room|live — active gift catalog (admin-configured money + coin prices). */
export async function GET(req: Request) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const context = new URL(req.url).searchParams.get('context') || 'room'
  const [gifts, finance, coinSettings] = await Promise.all([
    db.gift.findMany({
      where: { active: true, OR: [{ category: context }, { category: 'both' }] },
      orderBy: { sortOrder: 'asc' },
    }),
    getFinance(),
    getCoinSettings(),
  ])
  return NextResponse.json({
    // priceCoins is exposed on every gift (0 = not purchasable with coins)
    gifts: gifts.map((g) => ({
      id: g.id,
      name: g.name,
      emoji: g.emoji,
      imageUrl: g.imageUrl,
      description: g.description,
      animKind: g.animKind,
      sound: g.sound,
      category: g.category,
      priceUsd: g.priceUsd,
      priceCoins: g.priceCoins,
      currency: g.currency,
      durationMs: g.durationMs,
      sortOrder: g.sortOrder,
    })),
    platformCommission: finance.platformCommission,
    currency: finance.currency,
    coinSettings: {
      coinsPerUsd: coinSettings.coinsPerUsd,
      coinsEnabled: coinSettings.coinsEnabled,
    },
  })
}
