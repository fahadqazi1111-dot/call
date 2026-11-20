import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  requireUser,
  rateLimit,
  round2,
  ensureCoinWallet,
  applyCoinLedgerDelta,
  getFinance,
  getCoinSettings,
} from '@/lib/callapp/server'
import { deliverGift, giftRecipientEligible } from '@/lib/callapp/finance'

interface CoinGiftBody {
  giftId: string
  toUserId: string
  context: 'room' | 'live' | 'battle'
  roomId?: string
  liveId?: string
  battleId?: string
  battleSide?: number
  clientKey?: string
}

/**
 * POST — send a gift paid with COINS (the in-app currency).
 *
 *   1. validate gift + recipient against the SAME eligibility rules used by
 *      card checkout and wallet spend — the gift must have priceCoins > 0
 *   2. balance check on the sender's CoinWallet, then idempotent coin debit
 *      (kind 'coin_spend') so retries never double-charge
 *   3. compute the USD equivalent of the spent coins for the recipient's
 *      earnings split (grossUsd = priceCoins / coinsPerUsd)
 *   4. deliver through deliverGift() — THE single delivery path — so the
 *      GiftSend row records paymentMethod='coins' + grossCoins, the recipient
 *      gets the USD credit (commission - 0 payment fee), the animation
 *      plays, the notification fires, and battle scoring moves
 *   5. on delivery failure, refund the coins so a partial failure never
 *      burns the sender's balance
 */
export async function POST(req: Request) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!rateLimit(`coinsend:${me.id}`, 30, 60_000)) {
    return NextResponse.json({ error: 'Too many gift attempts' }, { status: 429 })
  }
  const settings = await getCoinSettings()
  if (!settings.coinsEnabled) {
    return NextResponse.json({ error: 'Coin purchases are currently disabled' }, { status: 403 })
  }
  try {
    const body = (await req.json()) as CoinGiftBody
    if (!body?.giftId || !body?.toUserId) {
      return NextResponse.json({ error: 'Gift and recipient required' }, { status: 400 })
    }

    // ---- validate gift ----
    const gift = await db.gift.findUnique({ where: { id: String(body.giftId) } })
    if (!gift || !gift.active) {
      return NextResponse.json({ error: 'Gift unavailable' }, { status: 400 })
    }
    const priceCoins = Math.max(0, Math.floor(gift.priceCoins || 0))
    if (priceCoins <= 0) {
      return NextResponse.json({ error: 'This gift cannot be purchased with coins' }, { status: 400 })
    }

    // ---- validate recipient (same rules as card/wallet) ----
    const toUserId = String(body.toUserId)
    if (toUserId === me.id) {
      return NextResponse.json({ error: 'You cannot send a gift to yourself' }, { status: 400 })
    }
    const recipient = await db.user.findUnique({
      where: { id: toUserId },
      select: { id: true, name: true, avatarKey: true, avatarUrl: true },
    })
    if (!recipient) return NextResponse.json({ error: 'Recipient not found' }, { status: 404 })

    const context = ['room', 'live', 'battle'].includes(body.context) ? body.context : 'live'
    const eligible = await giftRecipientEligible(me.id, context, body, recipient.id)
    if (!eligible) {
      return NextResponse.json({ error: 'This user is not an eligible gift recipient here' }, { status: 400 })
    }

    // ---- sender record for notifications + realtime payload ----
    const sender = await db.user.findUnique({
      where: { id: me.id },
      select: { id: true, name: true, avatarKey: true, avatarUrl: true },
    })
    if (!sender) return NextResponse.json({ error: 'Account error — please re-login' }, { status: 400 })

    // ---- balance check + idempotent coin debit ----
    const coinWallet = await ensureCoinWallet(me.id)
    if (coinWallet.coins < priceCoins) {
      return NextResponse.json({ error: 'Not enough coins' }, { status: 400 })
    }
    const clientKey = String(body.clientKey || '').slice(0, 80) || `coinsend:${Date.now()}`
    const idemKey = `coinspend:${clientKey}`
    const spendNote = `Spent ${priceCoins} coins on ${gift.name} → ${recipient.name} (${context})`

    const spend = await applyCoinLedgerDelta(
      me.id,
      'coin_spend',
      { coins: -priceCoins, totals: { totalSpent: priceCoins } },
      spendNote,
      'gift_send',
      undefined,
      idemKey
    )

    if (!spend.applied) {
      // retry of an already-charged send — delivery below would also dedupe
      return NextResponse.json({
        ok: true,
        alreadyProcessed: true,
        sendId: null,
        coinWallet: spend.wallet,
      })
    }

    // ---- USD value of the spent coins (the creator's gross earnings) ----
    const finance = await getFinance()
    const coinsPerUsd = Math.max(1, settings.coinsPerUsd) // guard against div-by-zero
    const grossUsd = round2(priceCoins / coinsPerUsd)

    const result = await deliverGift({
      gift: {
        id: gift.id,
        name: gift.name,
        emoji: gift.emoji,
        animKind: gift.animKind,
        sound: gift.sound,
        durationMs: gift.durationMs,
        priceUsd: gift.priceUsd,
        priceCoins: gift.priceCoins,
        currency: gift.currency || 'USD',
        imageUrl: gift.imageUrl,
      },
      sender,
      recipient,
      context,
      roomId: body.roomId || null,
      liveId: body.liveId || null,
      battleId: body.battleId || null,
      battleSide: typeof body.battleSide === 'number' ? body.battleSide : null,
      gross: grossUsd,
      grossCoins: priceCoins,
      feeAmount: 0, // coin payments have no card processing fee
      commissionPercent: finance.platformCommission,
      paymentMethod: 'coins',
      paymentId: null,
      isTest: false,
      idempotencyTag: `giftcredit:coins:${clientKey}`,
    })

    if (!result.ok) {
      // refund the coins so a delivery failure never burns the sender
      await applyCoinLedgerDelta(
        me.id,
        'coin_refund',
        { coins: priceCoins, totals: { totalSpent: -priceCoins } },
        `Refund — gift ${gift.name} could not be delivered — ${priceCoins} coins`,
        'gift_send',
        undefined,
        `coinrefund:${clientKey}`
      )
    }

    const finalWallet = await ensureCoinWallet(me.id)
    return NextResponse.json({
      ok: true,
      sendId: result.sendId ?? null,
      alreadyProcessed: !!result.alreadyProcessed,
      coinWallet: finalWallet,
    })
  } catch (err) {
    console.error('coin gift error', err)
    return NextResponse.json({ error: 'Could not send the gift' }, { status: 500 })
  }
}
