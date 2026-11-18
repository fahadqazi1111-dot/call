import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, rateLimit, round2, providerFeeFor } from '@/lib/callapp/server'
import { createCheckout } from '@/lib/callapp/payments'

interface CheckoutBody {
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
 * POST — start a DIRECT MONEY gift purchase (no coins anywhere).
 *
 *   1. validate gift + recipient
 *   2. SELF-GIFTING PREVENTION (hard server rule): the sender may never be
 *      the recipient, and the recipient must be an actual eligible host of
 *      the room/live/battle — not an arbitrary user id.
 *   3. create a PENDING Payment (real money) + provider checkout
 *   4. the gift is only delivered by fulfillPayment() after the provider
 *      webhook (or sandbox test checkout) verifies the payment
 *
 * Duplicate protection: idempotency via clientKey — retried checkouts return
 * the same pending payment instead of creating a second charge.
 */
export async function POST(req: Request) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!rateLimit(`giftcheckout:${me.id}`, 20, 60_000)) {
    return NextResponse.json({ error: 'Too many checkout attempts' }, { status: 429 })
  }
  try {
    const body = (await req.json()) as CheckoutBody
    const gift = await db.gift.findUnique({ where: { id: String(body.giftId || '') } })
    if (!gift || !gift.active) return NextResponse.json({ error: 'Gift unavailable' }, { status: 400 })

    const toUserId = String(body.toUserId || '')
    const context = ['room', 'live', 'battle'].includes(body.context) ? body.context : 'live'
    if (!toUserId) return NextResponse.json({ error: 'Recipient required' }, { status: 400 })

    // ---- SELF-GIFTING PREVENTION (backend-enforced, not just UI) ----
    if (toUserId === me.id) {
      return NextResponse.json({ error: 'You cannot send a gift to yourself' }, { status: 400 })
    }
    const recipient = await db.user.findUnique({ where: { id: toUserId } })
    if (!recipient) return NextResponse.json({ error: 'Recipient not found' }, { status: 404 })

    // recipient must be an eligible host/participant of the context
    const eligible = await eligibleRecipients(me.id, body, context)
    if (!eligible.some((r) => r.id === toUserId)) {
      return NextResponse.json({ error: 'This user is not an eligible gift recipient here' }, { status: 400 })
    }

    // ---- idempotency: same clientKey returns the same payment ----
    const clientKey = String(body.clientKey || '').slice(0, 80) || null
    if (clientKey) {
      const existing = await db.payment.findUnique({ where: { clientKey } })
      if (existing) {
        if (existing.status === 'successful') {
          return NextResponse.json({ ok: true, alreadyPaid: true, paymentId: existing.id })
        }
        if (existing.status === 'pending') {
          const info = await createCheckout(existing)
          return NextResponse.json({ ok: true, paymentId: existing.id, amount: existing.amount, ...info })
        }
      }
    }

    const gross = round2(gift.priceUsd)
    const meta = JSON.stringify({
      giftId: gift.id,
      giftName: gift.name,
      toUserId: recipient.id,
      context,
      roomId: body.roomId || null,
      liveId: body.liveId || null,
      battleId: body.battleId || null,
      battleSide: typeof body.battleSide === 'number' ? body.battleSide : null,
    })
    const fee = await providerFeeFor(gross)
    const payment = await db.payment.create({
      data: {
        userId: me.id,
        provider: 'pending',
        purpose: 'gift',
        status: 'pending',
        amount: gross,
        currency: gift.currency || 'USD',
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
      amount: gross,
      currency: payment.currency,
      gift: { id: gift.id, name: gift.name, emoji: gift.emoji },
      to: { id: recipient.id, name: recipient.name },
      ...info,
    })
  } catch (err) {
    console.error('gift checkout error', err)
    return NextResponse.json({ error: 'Checkout failed' }, { status: 500 })
  }
}

/** Eligible gift recipients for a context — hosts only, sender excluded. */
async function eligibleRecipients(
  meId: string,
  body: CheckoutBody,
  context: 'room' | 'live' | 'battle'
): Promise<Array<{ id: string; name: string }>> {
  const out: Array<{ id: string; name: string }> = []
  if (context === 'room' && body.roomId) {
    const parts = await db.roomParticipant.findMany({
      where: { roomId: String(body.roomId), role: { in: ['host', 'cohost'] } },
      select: { userId: true },
    })
    const users = await db.user.findMany({ where: { id: { in: parts.map((p) => p.userId) } }, select: { id: true, name: true } })
    out.push(...users)
  } else if (context === 'live' && body.liveId) {
    const live = await db.liveSession.findUnique({ where: { id: String(body.liveId) }, select: { hostId: true } })
    if (live) {
      const host = await db.user.findUnique({ where: { id: live.hostId }, select: { id: true, name: true } })
      if (host) out.push(host)
    }
  } else if (context === 'battle' && body.battleId) {
    const parts = await db.battleParticipant.findMany({
      where: { battleId: String(body.battleId) },
      select: { userId: true, name: true, side: true },
    })
    const wantSide = typeof body.battleSide === 'number' ? body.battleSide : null
    for (const p of parts) {
      if (wantSide !== null && p.side !== wantSide) continue
      out.push({ id: p.userId, name: p.name })
    }
  }
  return out.filter((r) => r.id !== meId)
}
