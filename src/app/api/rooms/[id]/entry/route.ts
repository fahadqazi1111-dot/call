import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, rateLimit, providerFeeFor, round2 } from '@/lib/callapp/server'
import { createCheckout } from '@/lib/callapp/payments'

/**
 * GET ?withPayment=<paymentId> — entry state for the current user
 * (entryPaid / needs payment / payment status after checkout).
 *
 * POST { } — paid-room entry via DIRECT PAYMENT (no coins):
 *   - free rooms / hosts / already-paid users pass straight through
 *   - otherwise a PENDING Payment (purpose room_entry) + checkout is created;
 *     the participant row is marked entryPaid by fulfillPayment() only after
 *     verified payment
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params
  const url = new URL(req.url)
  const room = await db.voiceRoom.findUnique({ where: { id } })
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 })

  const part = await db.roomParticipant.findUnique({ where: { roomId_userId: { roomId: id, userId: me.id } } })
  const needsPayment = room.isPaid && room.entryFee > 0 && room.hostId !== me.id && !part?.entryPaid

  const withPayment = url.searchParams.get('withPayment') || ''
  if (withPayment) {
    const payment = await db.payment.findUnique({ where: { id: withPayment } })
    if (payment && payment.userId === me.id) {
      return NextResponse.json({
        entryPaid: !needsPayment,
        payment: { id: payment.id, status: payment.status, amount: payment.amount },
      })
    }
  }

  return NextResponse.json({
    entryPaid: !needsPayment,
    entryFee: needsPayment ? room.entryFee : 0,
    isHost: room.hostId === me.id,
  })
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!rateLimit(`roombentry:${me.id}`, 10, 60_000)) {
    return NextResponse.json({ error: 'Too many attempts' }, { status: 429 })
  }
  const { id } = await ctx.params
  try {
    const room = await db.voiceRoom.findUnique({ where: { id } })
    if (!room || room.status !== 'live') {
      return NextResponse.json({ error: 'Room not available' }, { status: 404 })
    }
    if (room.hostId === me.id) {
      await db.roomParticipant.upsert({
        where: { roomId_userId: { roomId: room.id, userId: me.id } },
        update: { leftAt: null, blocked: false, entryPaid: true, role: 'host' },
        create: { roomId: room.id, userId: me.id, role: 'host', entryPaid: true },
      })
      return NextResponse.json({ ok: true, charged: 0, host: true })
    }
    if (!room.isPaid || room.entryFee <= 0) {
      await db.roomParticipant.upsert({
        where: { roomId_userId: { roomId: room.id, userId: me.id } },
        update: { leftAt: null, blocked: false },
        create: { roomId: room.id, userId: me.id, role: 'listener' },
      })
      return NextResponse.json({ ok: true, charged: 0 })
    }

    const part = await db.roomParticipant.findUnique({
      where: { roomId_userId: { roomId: room.id, userId: me.id } },
    })
    if (part?.blocked) {
      return NextResponse.json({ error: 'You are blocked from this room' }, { status: 403 })
    }
    if (part?.entryPaid) {
      await db.roomParticipant.update({ where: { id: part.id }, data: { leftAt: null, blocked: false } })
      return NextResponse.json({ ok: true, charged: 0, alreadyPaid: true })
    }

    // ---- direct payment checkout ----
    const gross = round2(room.entryFee)
    const fee = await providerFeeFor(gross)
    const payment = await db.payment.create({
      data: {
        userId: me.id,
        provider: 'pending',
        purpose: 'room_entry',
        status: 'pending',
        amount: gross,
        currency: 'USD',
        feeAmount: fee,
        meta: JSON.stringify({ roomId: room.id, roomTitle: room.title }),
      },
    })
    const info = await createCheckout(payment)
    await db.payment.update({ where: { id: payment.id }, data: { provider: info.provider, isTest: info.isTest } })
    return NextResponse.json({
      ok: true,
      needsPayment: true,
      amount: gross,
      currency: 'USD',
      paymentId: payment.id,
      ...info,
    })
  } catch {
    return NextResponse.json({ error: 'Entry failed' }, { status: 500 })
  }
}
