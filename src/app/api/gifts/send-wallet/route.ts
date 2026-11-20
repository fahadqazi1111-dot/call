import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, rateLimit, getFinance } from '@/lib/callapp/server'
import { walletSnapshot, sendGiftFromWallet } from '@/lib/callapp/finance'

interface WalletGiftBody {
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
 * POST — send a gift by SPENDING the sender's wallet balance.
 *
 *   1. same hard server rules as card checkout: no self-gifting, the
 *      recipient must be an actual eligible host/co-host/speaker (room),
 *      the live host, or a battle participant
 *   2. balance is debited atomically through the append-only ledger
 *      (idempotent by clientKey — retries can never double-charge)
 *   3. delivery runs through the shared deliverGift() path, so the
 *      recipient credit, notification and the realtime animation relay
 *      behave EXACTLY like a card gift
 */
export async function POST(req: Request) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!rateLimit(`giftwallet:${me.id}`, 30, 60_000)) {
    return NextResponse.json({ error: 'Too many gift attempts' }, { status: 429 })
  }
  try {
    const body = (await req.json()) as WalletGiftBody
    if (!body?.giftId || !body?.toUserId) {
      return NextResponse.json({ error: 'Gift and recipient required' }, { status: 400 })
    }
    const finance = await getFinance()
    const result = await sendGiftFromWallet(
      me.id,
      {
        giftId: String(body.giftId),
        toUserId: String(body.toUserId),
        context: body.context,
        roomId: body.roomId || null,
        liveId: body.liveId || null,
        battleId: body.battleId || null,
        battleSide: typeof body.battleSide === 'number' ? body.battleSide : null,
        clientKey: body.clientKey || null,
      },
      finance.platformCommission
    )
    if (!result.ok) {
      const messages: Record<string, string> = {
        gift_unavailable: 'Gift unavailable',
        recipient_missing: 'Recipient not found',
        self_gift: 'You cannot send a gift to yourself',
        recipient_not_eligible: 'This user is not an eligible gift recipient here',
        sender_missing: 'Account error — please re-login',
        insufficient_balance: 'Not enough wallet balance — top up or pay by card',
      }
      return NextResponse.json({ error: messages[result.reason ?? ''] || 'Could not send the gift' }, { status: 400 })
    }
    return NextResponse.json({
      ok: true,
      sendId: result.sendId ?? null,
      alreadyProcessed: !!result.alreadyProcessed,
      wallet: await walletSnapshot(me.id),
    })
  } catch (err) {
    console.error('wallet gift error', err)
    return NextResponse.json({ error: 'Could not send the gift' }, { status: 500 })
  }
}
