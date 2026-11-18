import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, applyWalletDelta, getFinance } from '@/lib/callapp/server'

/**
 * POST: paid-room entry. Deducts the entry fee ONCE per user per room
 * (idempotency key `room_entry:{room}:{user}`), records the transaction,
 * credits the host's earnings (roomHostPercent) and keeps the platform
 * commission. Re-entering the same room never charges again.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params
  try {
    const room = await db.voiceRoom.findUnique({ where: { id } })
    if (!room || room.status !== 'live') {
      return NextResponse.json({ error: 'Room not available' }, { status: 404 })
    }
    if (room.hostId === me.id) {
      return NextResponse.json({ ok: true, charged: 0, host: true })
    }
    if (!room.isPaid || room.entryFee <= 0) {
      return NextResponse.json({ ok: true, charged: 0 })
    }

    // Balance check BEFORE any deduction — never credit the host from a
    // failed entry (prevents phantom income).
    const { ensureWallet } = await import('@/lib/callapp/server')
    const wallet = await ensureWallet(me.id)
    if (wallet.coins < room.entryFee) {
      return NextResponse.json(
        { error: `Not enough coins — entry costs ${room.entryFee}, you have ${wallet.coins}` },
        { status: 400 }
      )
    }

    const key = `room_entry:${room.id}:${me.id}`
    const finance = await getFinance()

    // Idempotent deduction — second call returns the same result without charging.
    const deduct = await applyWalletDelta(
      me.id,
      'room_entry',
      { coins: -room.entryFee },
      `Paid room entry — ${room.title}`,
      room.id,
      `${key}:pay`
    )
    if (!deduct.applied) {
      // already paid previously
      await db.roomParticipant.upsert({
        where: { roomId_userId: { roomId: room.id, userId: me.id } },
        update: { leftAt: null, blocked: false },
        create: { roomId: room.id, userId: me.id, role: 'listener' },
      })
      return NextResponse.json({ ok: true, charged: 0, alreadyPaid: true, wallet: deduct.wallet })
    }

    // Block check + participant record
    const prev = await db.roomParticipant.findUnique({
      where: { roomId_userId: { roomId: room.id, userId: me.id } },
    })
    if (prev?.blocked) {
      // refund the deduction (idempotent by construction — only reachable on first pay)
      await applyWalletDelta(me.id, 'room_entry', { coins: room.entryFee }, 'Refund — blocked room entry', room.id, `${key}:refund`)
      return NextResponse.json({ error: 'You are blocked from this room' }, { status: 403 })
    }
    await db.roomParticipant.upsert({
      where: { roomId_userId: { roomId: room.id, userId: me.id } },
      update: { leftAt: null },
      create: { roomId: room.id, userId: me.id, role: 'listener' },
    })

    // Host earnings = entryFee × roomHostPercent; platform keeps the commission.
    const hostEarn = Math.round(room.entryFee * (finance.roomHostPercent / 100) * 100) / 100
    await applyWalletDelta(
      room.hostId,
      'room_income',
      { earnings: hostEarn },
      `Paid room income — ${room.title} (entry by ${me.name})`,
      room.id,
      `${key}:host`
    )

    return NextResponse.json({ ok: true, charged: room.entryFee, wallet: deduct.wallet })
  } catch {
    return NextResponse.json({ error: 'Entry failed' }, { status: 500 })
  }
}
