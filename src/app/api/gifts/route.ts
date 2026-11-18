import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, getFinance } from '@/lib/callapp/server'

/** GET ?context=room|live — active gift catalog (admin-configured money prices). */
export async function GET(req: Request) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const context = new URL(req.url).searchParams.get('context') || 'room'
  const gifts = await db.gift.findMany({
    where: { active: true, OR: [{ category: context }, { category: 'both' }] },
    orderBy: { sortOrder: 'asc' },
  })
  const finance = await getFinance()
  return NextResponse.json({
    gifts,
    platformCommission: finance.platformCommission,
    currency: finance.currency,
  })
}
