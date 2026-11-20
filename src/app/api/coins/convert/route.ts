import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  requireUser,
  rateLimit,
  round2,
  ensureWallet,
  ensureCoinWallet,
  applyLedgerDelta,
  applyCoinLedgerDelta,
  getCoinSettings,
} from '@/lib/callapp/server'

interface ConvertBody {
  amountUsd: number
  clientKey: string
}

/**
 * POST — convert REAL-MONEY wallet earnings into coins.
 *
 * Coins are NOT withdrawable — only verified USD earnings are. This route lets
 * a creator move some of their available USD balance into coins, gaining the
 * `convertBonusPercent` bonus (default 110 coins per $1 instead of 100).
 *
 * Flow:
 *   1. read CoinSettings: coinsPerUsd + convertBonusPercent
 *   2. balance check on the USD wallet
 *   3. idempotent USD debit (kind 'coin_conversion') — if the clientKey was
 *      already used, we treat it as already-processed and return the current
 *      balances without crediting coins again
 *   4. idempotent coin credit (kind 'coin_convert_in') — linked back to the
 *      USD ledger entry by refId, so the audit trail is complete
 *
 * The two ledger writes use DIFFERENT tables (LedgerEntry vs CoinLedgerEntry)
 * but share the same idempotency-key string, so a retry hits both "already
 * applied" branches and never moves money twice.
 */
export async function POST(req: Request) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!rateLimit(`coinconvert:${me.id}`, 20, 60_000)) {
    return NextResponse.json({ error: 'Too many conversions' }, { status: 429 })
  }
  const settings = await getCoinSettings()
  if (!settings.coinsEnabled) {
    return NextResponse.json({ error: 'Coin conversion is currently disabled' }, { status: 403 })
  }
  try {
    const body = (await req.json()) as ConvertBody
    const amountUsd = round2(Number(body.amountUsd) || 0)
    if (amountUsd < 0.5) {
      return NextResponse.json({ error: 'Minimum conversion is $0.50' }, { status: 400 })
    }
    const clientKey = String(body.clientKey || '').slice(0, 80)
    if (!clientKey) {
      return NextResponse.json({ error: 'clientKey is required (idempotency)' }, { status: 400 })
    }

    const bonusMultiplier = 1 + Math.max(0, settings.convertBonusPercent) / 100
    const coins = Math.max(0, Math.floor(amountUsd * settings.coinsPerUsd * bonusMultiplier))
    if (coins <= 0) {
      return NextResponse.json({ error: 'Conversion amount too small' }, { status: 400 })
    }

    // ---- balance check on the USD wallet ----
    const usdWallet = await ensureWallet(me.id)
    if (round2(usdWallet.available) < amountUsd) {
      return NextResponse.json({ error: 'Insufficient USD balance' }, { status: 400 })
    }

    const idemKey = `coinconvert:${clientKey}`
    const noteUsd = `Converted $${amountUsd.toFixed(2)} → ${coins} coins (+${settings.convertBonusPercent}% bonus)`
    const noteCoin = `${coins} coins converted from $${amountUsd.toFixed(2)} (bonus ${settings.convertBonusPercent}%)`

    // ---- USD debit (idempotent) ----
    const debit = await applyLedgerDelta(
      me.id,
      'coin_conversion',
      { available: -amountUsd, totals: { totalEarned: -amountUsd } },
      noteUsd,
      'coin_convert',
      undefined,
      idemKey
    )

    let coinWallet
    if (!debit.applied) {
      // retry of an already-applied conversion — return current balances
      coinWallet = await ensureCoinWallet(me.id)
      return NextResponse.json({
        ok: true,
        alreadyProcessed: true,
        coins,
        wallet: debit.wallet,
        coinWallet,
      })
    }

    // link the coin credit back to the USD ledger entry that just paid for it
    const usdEntry = await db.ledgerEntry.findUnique({ where: { idempotencyKey: idemKey } })

    // ---- coin credit (idempotent) ----
    const credit = await applyCoinLedgerDelta(
      me.id,
      'coin_convert_in',
      { coins, totals: { totalConverted: coins } },
      noteCoin,
      'conversion',
      usdEntry?.id ?? undefined,
      idemKey
    )

    return NextResponse.json({
      ok: true,
      coins,
      wallet: debit.wallet,
      coinWallet: credit.wallet,
    })
  } catch (err) {
    console.error('coin convert error', err)
    return NextResponse.json({ error: 'Conversion failed' }, { status: 500 })
  }
}
