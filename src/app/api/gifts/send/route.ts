import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  requireUser,
  applyWalletDelta,
  getFinance,
  ensureWallet,
  rateLimit,
} from '@/lib/callapp/server'

interface SendBody {
  giftId: string
  toUserId: string
  context: 'room' | 'live' | 'battle'
  roomId?: string
  liveId?: string
  battleId?: string
  battleSide?: number
  idempotencyKey?: string
}

/**
 * POST — send a gift. AUTHORITATIVE money path:
 *   1. verify gift + balance
 *   2. deduct coins from sender (idempotency-keyed)
 *   3. credit recipient earnings (price × creatorEarnPercent)
 *   4. record GiftSend + both WalletTx rows
 * In battle context the score is also incremented on BattleParticipant.
 * The client relays the animation over the socket service after this returns.
 */
export async function POST(req: Request) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!rateLimit(`gift:${me.id}`, 30, 60_000)) {
    return NextResponse.json({ error: 'Sending gifts too fast' }, { status: 429 })
  }
  try {
    const body = (await req.json()) as SendBody
    const gift = await db.gift.findUnique({ where: { id: String(body.giftId || '') } })
    if (!gift || !gift.active) return NextResponse.json({ error: 'Gift unavailable' }, { status: 400 })
    const toUserId = String(body.toUserId || '')
    const context = ['room', 'live', 'battle'].includes(body.context) ? body.context : 'room'
    if (!toUserId || toUserId === me.id) {
      return NextResponse.json({ error: 'Invalid recipient' }, { status: 400 })
    }
    const recipient = await db.user.findUnique({ where: { id: toUserId } })
    if (!recipient) return NextResponse.json({ error: 'Recipient not found' }, { status: 404 })

    const wallet = await ensureWallet(me.id)
    if (wallet.coins < gift.priceCoins) {
      return NextResponse.json({ error: 'Not enough coins' }, { status: 400 })
    }

    const finance = await getFinance()
    const idem = body.idempotencyKey || `gift:${me.id}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`

    // --- deduct sender (idempotent) ---
    const deduct = await applyWalletDelta(
      me.id,
      context === 'room' ? 'gift_sent' : 'live_gift_sent',
      { coins: -gift.priceCoins },
      `Gift ${gift.name} → ${recipient.name}`,
      null,
      `${idem}:send`
    )
    if (!deduct.applied) {
      return NextResponse.json({ error: 'Duplicate gift ignored' }, { status: 409 })
    }

    // --- record ---
    const send = await db.giftSend.create({
      data: {
        giftId: gift.id,
        senderId: me.id,
        recipientId: recipient.id,
        context,
        roomId: body.roomId || null,
        liveId: body.liveId || null,
        battleId: body.battleId || null,
        battleSide: typeof body.battleSide === 'number' ? body.battleSide : null,
        coinsSpent: gift.priceCoins,
        earnCredited: gift.earnValue,
      },
    })

    // --- credit recipient earnings (idempotent) ---
    await applyWalletDelta(
      recipient.id,
      context === 'room' ? 'gift_received' : 'live_gift_received',
      { earnings: gift.earnValue },
      `Gift ${gift.name} from ${me.name}`,
      send.id,
      `${idem}:recv`
    )

    // --- battle scoring ---
    let scoreSide: number | null = null
    let totalScore: number | null = null
    if (context === 'battle' && body.battleId && typeof body.battleSide === 'number') {
      scoreSide = body.battleSide
      const part = await db.battleParticipant.findFirst({
        where: { battleId: body.battleId, side: body.battleSide, userId: toUserId },
      })
      if (part) {
        const updated = await db.battleParticipant.update({
          where: { id: part.id },
          data: { score: { increment: gift.priceCoins } },
        })
        totalScore = updated.score
      }
    }

    return NextResponse.json({
      ok: true,
      sendId: send.id,
      wallet: deduct.wallet,
      gift: {
        id: gift.id,
        name: gift.name,
        emoji: gift.emoji,
        animKind: gift.animKind,
        sound: gift.sound,
        durationMs: gift.durationMs,
        priceCoins: gift.priceCoins,
      },
      from: { id: me.id, name: me.name, avatarKey: me.avatarKey, avatarUrl: me.avatarUrl },
      to: { id: recipient.id, name: recipient.name, avatarKey: recipient.avatarKey, avatarUrl: recipient.avatarUrl },
      battle: scoreSide !== null ? { battleId: body.battleId, side: scoreSide, added: gift.priceCoins, total: totalScore } : null,
    })
  } catch {
    return NextResponse.json({ error: 'Gift failed' }, { status: 500 })
  }
}
