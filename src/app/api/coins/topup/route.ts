import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  requireUser,
  rateLimit,
  round2,
  providerFeeFor,
  getCoinSettings,
} from '@/lib/callapp/server'
import { createCheckout } from '@/lib/callapp/payments'

interface TopupBody {
  packId?: string
  amountUsd?: number
  clientKey?: string
}

/**
 * POST — buy coins with REAL MONEY through a coin pack or a custom USD amount.
 *
 *   1. resolve the USD amount + coin amount (pack overrides custom if given):
 *        - pack:        coins = pack.coins + pack.bonus,  price = pack.priceUsd
 *        - custom USD:  coins = floor(amountUsd * coinsPerUsd)  (no bonus)
 *   2. lock the coin amount on the Payment.meta so a later change to coin
 *      settings can never retroactively alter what was paid for
 *   3. create a PENDING Payment with purpose 'coin_topup', then hand off to
 *      the same createCheckout() as gifts (Stripe or sandbox test checkout)
 *   4. coins are credited by fulfillCoinTopup() once the webhook / sandbox
 *      confirm flips the payment to successful — idempotent by payment.id
 *
 * Duplicate-safe: a retried request with the same clientKey returns the
 * existing pending payment instead of creating a second charge.
 */
export async function POST(req: Request) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!rateLimit(`cointopup:${me.id}`, 20, 60_000)) {
    return NextResponse.json({ error: 'Too many topup attempts' }, { status: 429 })
  }
  const settings = await getCoinSettings()
  if (!settings.coinsEnabled) {
    return NextResponse.json({ error: 'Coin purchases are currently disabled' }, { status: 403 })
  }
  try {
    const body = (await req.json()) as TopupBody
    const clientKey = String(body.clientKey || '').slice(0, 80) || null

    // ---- resolve pack vs custom amount ----
    let pack: { id: string; coins: number; priceUsd: number; bonus: number; label: string } | null = null
    if (body.packId) {
      pack = settings.coinPacks.find((p) => p.id === body.packId) ?? null
      if (!pack) return NextResponse.json({ error: 'Unknown coin pack' }, { status: 400 })
    }
    let amountUsd: number
    let coins: number
    if (pack) {
      amountUsd = round2(pack.priceUsd)
      coins = Math.max(0, Math.floor(pack.coins + pack.bonus))
    } else {
      amountUsd = round2(Number(body.amountUsd) || 0)
      if (amountUsd < 0.99) return NextResponse.json({ error: 'Minimum topup is $0.99' }, { status: 400 })
      coins = Math.max(0, Math.floor(amountUsd * settings.coinsPerUsd))
    }
    if (coins <= 0) return NextResponse.json({ error: 'Could not compute coin amount' }, { status: 400 })

    // ---- idempotency: same clientKey returns the same payment ----
    if (clientKey) {
      const existing = await db.payment.findUnique({ where: { clientKey } })
      if (existing) {
        const meta = JSON.parse(existing.meta || '{}') as { coins?: number }
        if (existing.status === 'successful') {
          return NextResponse.json({
            ok: true,
            alreadyPaid: true,
            paymentId: existing.id,
            coins: Number(meta.coins || 0),
            amountUsd: existing.amount,
          })
        }
        if (existing.status === 'pending') {
          const info = await createCheckout(existing)
          return NextResponse.json({
            ok: true,
            paymentId: existing.id,
            amount: existing.amount,
            coins: Number(meta.coins || 0),
            amountUsd: existing.amount,
            ...info,
          })
        }
      }
    }

    const fee = await providerFeeFor(amountUsd)
    const meta = JSON.stringify({
      packId: pack?.id ?? null,
      packLabel: pack?.label ?? null,
      coins,
      coinsPerUsd: settings.coinsPerUsd,
    })
    const payment = await db.payment.create({
      data: {
        userId: me.id,
        provider: 'pending',
        purpose: 'coin_topup',
        status: 'pending',
        amount: amountUsd,
        currency: 'USD',
        feeAmount: fee,
        meta,
        isTest: false, // set truthfully by createCheckout below
        clientKey,
      },
    })

    const info = await createCheckout(payment)
    await db.payment.update({
      where: { id: payment.id },
      data: { provider: info.provider, isTest: info.isTest },
    })

    return NextResponse.json({
      ok: true,
      paymentId: payment.id,
      amount: amountUsd,
      currency: payment.currency,
      coins,
      amountUsd,
      ...info,
    })
  } catch (err) {
    console.error('coin topup error', err)
    return NextResponse.json({ error: 'Topup failed' }, { status: 500 })
  }
}
