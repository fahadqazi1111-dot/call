import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, applyWalletDelta, rateLimit } from '@/lib/callapp/server'

/**
 * POST { packageId } — purchase a coin package.
 * Zero-cost build: there is no live payment gateway, so checkout runs in
 * clearly-labeled SANDBOX mode (store-compliance note: real money purchases
 * on mobile stores must use Google Play Billing / Apple IAP; this API is
 * structured so a billing adapter can be added later without changing the
 * wallet accounting below).
 */
export async function POST(req: Request) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!rateLimit(`purchase:${me.id}`, 6, 60_000)) {
    return NextResponse.json({ error: 'Too many purchase attempts' }, { status: 429 })
  }
  try {
    const body = await req.json()
    const pkg = await db.coinPackage.findUnique({ where: { id: String(body.packageId || '') } })
    if (!pkg || !pkg.active) return NextResponse.json({ error: 'Package unavailable' }, { status: 400 })
    const totalCoins = pkg.coins + pkg.bonus
    const key = `purchase:${me.id}:${pkg.id}:${Date.now()}`
    const res = await applyWalletDelta(
      me.id,
      'purchase',
      { coins: totalCoins },
      `Sandbox purchase — ${pkg.name} (${pkg.coins}${pkg.bonus ? ` +${pkg.bonus} bonus` : ''} coins) $${pkg.priceUsd}`,
      pkg.id,
      key
    )
    if (!res.applied) return NextResponse.json({ error: 'Duplicate purchase ignored' }, { status: 409 })
    return NextResponse.json({ ok: true, wallet: res.wallet, credited: totalCoins })
  } catch {
    return NextResponse.json({ error: 'Purchase failed' }, { status: 500 })
  }
}
