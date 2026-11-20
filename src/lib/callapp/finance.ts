import { db } from '@/lib/db'
import { applyLedgerDelta, ensureWallet, getFinance, providerFeeFor, round2, applyCoinLedgerDelta } from './server'
import { relayToLive, relayToRoom, relayToUser } from './relay'
import { safeJson } from './payments'

/**
 * Financial fulfillment — the ONLY path that turns a verified payment into
 * delivered value. Every step is idempotent and audited:
 *
 *   1. Atomic claim: pending → successful (updateMany guarded by status).
 *      Two webhook retries hitting simultaneously can never double-deliver.
 *   2. Commission split: gross − platform commission − provider fee = creator net.
 *   3. Ledger: creator's wallet credited through applyLedgerDelta (append-only
 *      ledger rows with idempotency keys).
 *   4. Delivery: GiftSend row, notification, realtime relay for animations,
 *      battle score updates (score = verified money, not a separate currency).
 */

export interface FulfillResult {
  ok: boolean
  alreadyProcessed?: boolean
  reason?: string
  sendId?: string
  wallet?: { available: number; reserved: number }
}

/** Entry price breakdown for UI display. */
export function splitAmounts(gross: number, feeAmount: number, commissionPercent: number) {
  const commission = round2((gross * commissionPercent) / 100)
  const net = round2(Math.max(0, gross - commission - feeAmount))
  return { commission, net }
}

export async function fulfillPayment(paymentId: string): Promise<FulfillResult> {
  const payment = await db.payment.findUnique({ where: { id: paymentId } })
  if (!payment) return { ok: false, reason: 'payment_not_found' }
  if (payment.status === 'successful') return { ok: true, alreadyProcessed: true }
  if (payment.status === 'refunded') return { ok: false, reason: 'refunded' }

  // refine provider fee once, at fulfillment time (kept separately identifiable)
  const feeAmount = payment.feeAmount > 0 ? payment.feeAmount : await providerFeeFor(payment.amount)

  // ---- atomic claim: only ONE caller wins the pending → successful transition
  const claimed = await db.payment.updateMany({
    where: { id: payment.id, status: 'pending' },
    data: { status: 'successful', completedAt: new Date(), feeAmount },
  })
  if (claimed.count === 0) {
    const fresh = await db.payment.findUnique({ where: { id: payment.id } })
    return fresh?.status === 'successful'
      ? { ok: true, alreadyProcessed: true }
      : { ok: false, reason: `payment_status_${fresh?.status ?? 'unknown'}` }
  }

  const meta = safeJson(payment.meta)
  const finance = await getFinance()
  const gross = round2(payment.amount)

  try {
    if (payment.purpose === 'gift') {
      return await fulfillGift(payment, meta, gross, feeAmount, finance.platformCommission)
    }
    if (payment.purpose === 'room_entry') {
      return await fulfillRoomEntry(payment, meta, gross, feeAmount, finance.roomHostPercent)
    }
    if (payment.purpose === 'ad_campaign') {
      return await fulfillAdCampaign(payment, meta)
    }
    if (payment.purpose === 'coin_topup') {
      return await fulfillCoinTopup(payment, meta)
    }
    return { ok: true, reason: 'no_fulfillment_needed' }
  } catch (err) {
    console.error('fulfillment error', paymentId, err)
    // keep payment successful (money verified) but surface the failure for ops
    return { ok: false, reason: 'fulfillment_error' }
  }
}

/* ---------------- coin topup ---------------- */

/**
 * Credits coins after a successful coin-pack purchase. The coin amount is
 * locked at checkout time and stored on payment.meta.coins, so a later
 * change to CoinSettings can never retroactively alter what was paid for.
 * Idempotent by the payment's pending→successful transition (handled by
 * fulfillPayment) plus the `cointopup:{paymentId}` idempotency key.
 */
async function fulfillCoinTopup(
  payment: { id: string; userId: string; isTest: boolean; amount: number },
  meta: Record<string, unknown>
): Promise<FulfillResult> {
  const coinAmount = Math.max(0, Math.floor(Number(meta.coins) || 0))
  if (coinAmount <= 0) return { ok: false, reason: 'coin_amount_missing' }
  const note = `Coin purchase — ${coinAmount} coins for $${round2(payment.amount).toFixed(2)}${payment.isTest ? ' (test)' : ''}`
  await applyCoinLedgerDelta(
    payment.userId,
    'coin_purchase',
    { coins: coinAmount, totals: { totalPurchased: coinAmount } },
    note,
    'payment',
    payment.id,
    `cointopup:${payment.id}`
  )
  return { ok: true }
}

/* ---------------- gift ---------------- */

async function fulfillGift(
  payment: { id: string; userId: string; isTest: boolean; amount: number },
  meta: Record<string, unknown>,
  gross: number,
  feeAmount: number,
  commissionPercent: number
): Promise<FulfillResult> {
  const gift = await db.gift.findUnique({ where: { id: String(meta.giftId || '') } })
  const recipient = await db.user.findUnique({ where: { id: String(meta.toUserId || '') } })
  const sender = await db.user.findUnique({ where: { id: payment.userId } })
  if (!gift || !recipient || !sender) return { ok: false, reason: 'gift_participants_missing' }

  return deliverGift({
    gift,
    sender,
    recipient,
    context: ['room', 'live', 'battle'].includes(String(meta.context)) ? (String(meta.context) as 'room' | 'live' | 'battle') : 'live',
    roomId: (meta.roomId as string) || null,
    liveId: (meta.liveId as string) || null,
    battleId: (meta.battleId as string) || null,
    battleSide: typeof meta.battleSide === 'number' ? meta.battleSide : null,
    gross,
    grossCoins: 0,
    feeAmount,
    commissionPercent,
    paymentMethod: 'card',
    paymentId: payment.id,
    isTest: payment.isTest,
    idempotencyTag: `giftcredit:${payment.id}`,
  })
}

/** Eligibility rule shared by checkout, wallet-send and this delivery path. */
export async function giftRecipientEligible(
  meId: string,
  context: 'room' | 'live' | 'battle',
  ids: { roomId?: string | null; liveId?: string | null; battleId?: string | null; battleSide?: number | null },
  toUserId: string
): Promise<boolean> {
  if (toUserId === meId) return false
  if (context === 'room' && ids.roomId) {
    const p = await db.roomParticipant.findFirst({
      where: { roomId: ids.roomId, userId: toUserId, role: { in: ['host', 'cohost', 'speaker'] }, leftAt: null },
      select: { id: true },
    })
    return !!p
  }
  if (context === 'live' && ids.liveId) {
    const live = await db.liveSession.findUnique({ where: { id: ids.liveId }, select: { hostId: true } })
    return live?.hostId === toUserId
  }
  if (context === 'battle' && ids.battleId) {
    const p = await db.battleParticipant.findFirst({
      where: { battleId: ids.battleId, userId: toUserId },
      select: { id: true },
    })
    return !!p
  }
  return false
}

export interface WalletGiftInput {
  giftId: string
  toUserId: string
  context: 'room' | 'live' | 'battle'
  roomId?: string | null
  liveId?: string | null
  battleId?: string | null
  battleSide?: number | null
  clientKey?: string | null
}

/**
 * Send a gift by SPENDING WALLET BALANCE (no card payment involved).
 *
 *   1. validate gift + recipient against the same eligibility rules as card checkout
 *   2. balance check, then an idempotent ledger debit on the sender's wallet
 *   3. delivery through the exact same deliverGift() path as card gifts:
 *      GiftSend row, commission split, recipient credit, notification and
 *      the realtime relay that drives the animation for everyone.
 *
 * The clientKey makes retries safe: the debit happens once, and delivery
 * dedupes on its own tag, so a flaky network can never double-charge or
 * double-deliver.
 */
export async function sendGiftFromWallet(
  senderId: string,
  input: WalletGiftInput,
  commissionPercent: number
): Promise<FulfillResult & { giftName?: string }> {
  const gift = await db.gift.findUnique({ where: { id: String(input.giftId || '') } })
  if (!gift || !gift.active) return { ok: false, reason: 'gift_unavailable' }
  const recipient = await db.user.findUnique({ where: { id: String(input.toUserId || '') } })
  if (!recipient) return { ok: false, reason: 'recipient_missing' }
  if (recipient.id === senderId) return { ok: false, reason: 'self_gift' }

  const context = ['room', 'live', 'battle'].includes(input.context) ? input.context : 'live'
  const eligible = await giftRecipientEligible(senderId, context, input, recipient.id)
  if (!eligible) return { ok: false, reason: 'recipient_not_eligible' }

  const gross = round2(gift.priceUsd)
  const clientKey = String(input.clientKey || '').slice(0, 80) || `wallet:${Date.now()}`
  const feeAmount = 0 // wallet spend has no card processing fee

  // ---- sender record for notifications + realtime payload ----
  const sender = await db.user.findUnique({
    where: { id: senderId },
    select: { id: true, name: true, avatarKey: true, avatarUrl: true },
  })
  if (!sender) return { ok: false, reason: 'sender_missing' }

  // ---- balance check + idempotent debit ----
  const wallet = await ensureWallet(senderId)
  if (round2(wallet.available) < gross) {
    return { ok: false, reason: 'insufficient_balance' }
  }
  const spend = await applyLedgerDelta(
    senderId,
    'gift_sent',
    { available: -gross },
    `Gift ${gift.name} sent to ${recipient.name} (${context}) — $${gross.toFixed(2)} from wallet balance`,
    'gift_send',
    clientKey,
    `giftspend:${clientKey}`
  )
  if (!spend.applied) {
    // retry of an already-charged send — delivery below still dedupes itself
    return { ok: true, alreadyProcessed: true, sendId: undefined, wallet: spend.wallet }
  }

  const result = await deliverGift({
    gift,
    sender,
    recipient,
    context,
    roomId: input.roomId || null,
    liveId: input.liveId || null,
    battleId: input.battleId || null,
    battleSide: typeof input.battleSide === 'number' ? input.battleSide : null,
    gross,
    grossCoins: 0,
    feeAmount,
    commissionPercent,
    paymentMethod: 'wallet',
    paymentId: null,
    isTest: false,
    idempotencyTag: `giftcredit:wallet:${clientKey}`,
  })
  if (!result.ok) {
    // refund the wallet so money never vanishes on a delivery failure
    await applyLedgerDelta(
      senderId,
      'gift_refund',
      { available: gross },
      `Refund — gift ${gift.name} could not be delivered — $${gross.toFixed(2)}`,
      'gift_send',
      undefined,
      `giftrefund:${clientKey}`
    )
  }
  return { ...result, giftName: gift.name }
}

/**
 * THE single delivery path for every gift (card, wallet, or coins):
 * GiftSend row → recipient credit → battle scoring → notification → realtime relay.
 * Idempotent by idempotencyTag.
 *
 * Exported so the coin-send route can route through it exactly like card and
 * wallet gifts — every animation, notification and battle-score update runs
 * through THIS function so coin gifts are never a second-class citizen.
 */
export interface DeliverGiftArgs {
  gift: { id: string; name: string; emoji: string; animKind: string; sound: string; durationMs: number; priceUsd: number; priceCoins: number; currency: string; imageUrl?: string | null }
  sender: { id: string; name: string; avatarKey: number; avatarUrl: string | null }
  recipient: { id: string; name: string; avatarKey: number; avatarUrl: string | null }
  context: 'room' | 'live' | 'battle'
  roomId: string | null
  liveId: string | null
  battleId: string | null
  battleSide: number | null
  gross: number
  /** coins spent on this gift, if paid with coins (0 for card/wallet) */
  grossCoins: number
  feeAmount: number
  commissionPercent: number
  /** 'card' | 'wallet' | 'coins' — stored on GiftSend for reporting */
  paymentMethod: 'card' | 'wallet' | 'coins'
  paymentId: string | null
  isTest: boolean
  idempotencyTag: string
}

export async function deliverGift(args: DeliverGiftArgs): Promise<FulfillResult> {
  const { gift, sender, recipient, context, gross, grossCoins, feeAmount, commissionPercent, paymentMethod, paymentId, isTest } = args

  const { commission, net } = splitAmounts(gross, feeAmount, commissionPercent)

  const send = await db.giftSend.create({
    data: {
      giftId: gift.id,
      senderId: sender.id,
      recipientId: recipient.id,
      context,
      roomId: args.roomId,
      liveId: args.liveId,
      battleId: args.battleId,
      battleSide: args.battleSide,
      grossAmount: gross,
      grossCoins,
      commission,
      feeAmount,
      netAmount: net,
      paymentMethod,
      paymentId,
      isTest,
    },
  })

  // creator credit — idempotent by tag
  const credit = await applyLedgerDelta(
    recipient.id,
    'gift_received',
    { available: net, totals: { totalReceived: gross, totalEarned: net } },
    `Gift ${gift.name} from ${sender.name}${isTest ? ' (test)' : ''} — gross $${gross.toFixed(2)}, commission $${commission.toFixed(2)}, net $${net.toFixed(2)}`,
    'gift_send',
    send.id,
    args.idempotencyTag
  )

  // battle scoring — TikTok-style TEAM points: gifts are the heavy booster
  // (price × 100 points), double-taps add 1 each (see /api/battles/tap).
  // participant.score stays in $ for per-person gift stats.
  // The side comes from the CLIENT when present, but viewers often omit it —
  // then it is resolved from the recipient's battle seat so scoring NEVER
  // silently skips (this was the "battle score doesn't move" bug).
  let battleTotal: number | null = null
  let battleAdded = 0
  if (context === 'battle' && args.battleId) {
    let side = typeof args.battleSide === 'number' ? args.battleSide : null
    if (side === null || side === undefined) {
      const seat = await db.battleParticipant.findFirst({
        where: { battleId: String(args.battleId), userId: recipient.id },
        select: { side: true },
      })
      side = seat?.side ?? null
    }
    if (side !== null) {
      const part = await db.battleParticipant.findFirst({
        where: { battleId: String(args.battleId), side, userId: recipient.id },
      })
      if (part) {
        await db.battleParticipant.update({
          where: { id: part.id },
          data: { score: { increment: gross } },
        })
        const giftPoints = Math.max(1, Math.round(gross * 100))
        battleAdded = giftPoints
        const pointsField = side === 0 ? 'sideAPoints' : 'sideBPoints'
        const updatedBattle = await db.battle.update({
          where: { id: String(args.battleId) },
          data: { [pointsField]: { increment: giftPoints } },
        })
        battleTotal = Math.round(
          (side === 0 ? updatedBattle.sideAPoints : updatedBattle.sideBPoints)
        )
        // the resolved side wins over the client-supplied one for the relay
        args.battleSide = side
      }
    }
  }

  await db.notification.create({
    data: {
      userId: recipient.id,
      kind: 'gift',
      title: `${sender.name} sent you ${gift.name} ${gift.emoji}`,
      body: `Gross $${gross.toFixed(2)} · commission $${commission.toFixed(2)} · you earned $${net.toFixed(2)}${isTest ? ' (test payment)' : ''}`,
      refType: context === 'room' ? 'room' : 'live',
      refId: args.roomId || args.liveId || null,
    },
  })

  // realtime delivery so every client in the room/live plays the animation
  const payload = {
    ok: true,
    sendId: send.id,
    // the card checkout's local echo carries the PAYMENT id — relaying it lets
    // clients dedupe the echo against this relayed event (single animation)
    paymentId: paymentId,
    paymentMethod,
    grossCoins,
    gift: {
      id: gift.id,
      name: gift.name,
      emoji: gift.emoji,
      animKind: gift.animKind,
      sound: gift.sound,
      durationMs: gift.durationMs,
      priceUsd: gift.priceUsd,
      priceCoins: gift.priceCoins,
      imageUrl: gift.imageUrl,
    },
    from: { id: sender.id, name: sender.name, avatarKey: sender.avatarKey, avatarUrl: sender.avatarUrl },
    to: { id: recipient.id, name: recipient.name, avatarKey: recipient.avatarKey, avatarUrl: recipient.avatarUrl },
    battle:
      context === 'battle' && args.battleId
        ? { battleId: args.battleId, side: args.battleSide, added: battleAdded, total: battleTotal }
        : null,
  }
  if (context === 'room' && args.roomId) {
    await relayToRoom(args.roomId, 'room:gift', { roomId: args.roomId, payload })
  } else if (args.liveId) {
    await relayToLive(args.liveId, 'live:gift', { liveId: args.liveId, payload })
    if (battleTotal !== null && args.battleId && args.liveId) {
      await relayToLive(args.liveId, 'battle:score', {
        battleId: args.battleId,
        side: args.battleSide,
        added: battleAdded,
        total: battleTotal,
      })
    }
  }
  await relayToUser(recipient.id, 'notify:incoming', {
    payload: {
      id: `live-${send.id}`,
      kind: 'gift',
      title: `${sender.name} sent you ${gift.name} ${gift.emoji}`,
      body: `You earned $${net.toFixed(2)}`,
      createdAt: new Date().toISOString(),
    },
  })

  return { ok: true, sendId: send.id, wallet: credit.wallet }
}

/* ---------------- paid room entry ---------------- */

async function fulfillRoomEntry(
  payment: { id: string; userId: string; isTest: boolean },
  meta: Record<string, unknown>,
  gross: number,
  feeAmount: number,
  roomHostPercent: number
): Promise<FulfillResult> {
  const roomId = String(meta.roomId || '')
  const room = await db.voiceRoom.findUnique({ where: { id: roomId } })
  if (!room) return { ok: false, reason: 'room_missing' }

  const commissionPercent = Math.max(0, 100 - roomHostPercent)
  const { commission, net } = splitAmounts(gross, feeAmount, commissionPercent)

  await db.roomParticipant.upsert({
    where: { roomId_userId: { roomId, userId: payment.userId } },
    update: { entryPaid: true, leftAt: null, blocked: false },
    create: { roomId, userId: payment.userId, role: 'listener', entryPaid: true },
  })

  await applyLedgerDelta(
    room.hostId,
    'room_income',
    { available: net, totals: { totalEarned: net } },
    `Paid room entry — ${room.title} (entry by user) — gross $${gross.toFixed(2)}, commission $${commission.toFixed(2)}, net $${net.toFixed(2)}${payment.isTest ? ' (test)' : ''}`,
    'room',
    room.id,
    `roomincome:${payment.id}`
  )

  await db.notification.create({
    data: {
      userId: room.hostId,
      kind: 'wallet',
      title: 'New paid room entry',
      body: `Gross $${gross.toFixed(2)} · you earned $${net.toFixed(2)}${payment.isTest ? ' (test payment)' : ''}`,
      refType: 'room',
      refId: room.id,
    },
  })

  await relayToRoom(roomId, 'room:entry:paid', { roomId, userId: payment.userId })
  return { ok: true }
}

/* ---------------- ad campaign payment ---------------- */

async function fulfillAdCampaign(
  payment: { id: string; userId: string; isTest: boolean },
  meta: Record<string, unknown>
): Promise<FulfillResult> {
  const campaignId = String(meta.campaignId || '')
  const ad = await db.ad.findUnique({ where: { id: campaignId } })
  if (!ad) return { ok: false, reason: 'campaign_missing' }
  if (ad.status === 'pending_payment') {
    await db.ad.update({
      where: { id: ad.id },
      data: { status: 'pending_approval', paymentId: payment.id },
    })
  }
  await db.notification.create({
    data: {
      userId: ad.ownerId || payment.userId,
      kind: 'ad',
      title: 'Ad campaign payment received',
      body: `"${ad.title}" is now pending admin approval${payment.isTest ? ' (test payment)' : ''}.`,
      refType: 'ad',
      refId: ad.id,
    },
  })
  return { ok: true }
}

/* ---------------- wallet snapshot helper ---------------- */

export async function walletSnapshot(userId: string) {
  const w = await ensureWallet(userId)
  return {
    available: round2(w.available),
    reserved: round2(w.reserved),
    totalReceived: round2(w.totalReceived),
    totalEarned: round2(w.totalEarned),
    totalWithdrawn: round2(w.totalWithdrawn),
  }
}
