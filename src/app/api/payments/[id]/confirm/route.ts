import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/callapp/server'
import { fulfillPayment } from '@/lib/callapp/finance'
import { getPaymentConfig } from '@/lib/callapp/payments'

/**
 * POST — SANDBOX-ONLY payment confirmation (the clearly-labeled in-app test
 * checkout). Hard-gated:
 *   - the configured provider must be sandbox (a real Stripe deployment
 *     cannot confirm payments through this endpoint, ever)
 *   - the payment row itself must be flagged isTest
 *   - only the payment owner can confirm
 * Fulfillment goes through the same fulfillPayment() atomic path as real
 * webhook traffic, so the delivery logic is identical.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params

  const cfg = await getPaymentConfig()
  if (cfg.provider === 'stripe') {
    return NextResponse.json({ error: 'Sandbox confirmations are disabled when a real payment provider is configured' }, { status: 403 })
  }

  const payment = await db.payment.findUnique({ where: { id } })
  if (!payment || payment.userId !== me.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (!payment.isTest) {
    return NextResponse.json({ error: 'Only sandbox (test) payments can be confirmed here' }, { status: 403 })
  }
  if (payment.status !== 'pending') {
    return NextResponse.json({ error: `Payment already ${payment.status}` }, { status: 409 })
  }

  const result = await fulfillPayment(payment.id)
  if (!result.ok) return NextResponse.json({ error: result.reason || 'Fulfillment failed' }, { status: 400 })

  const fresh = await db.payment.findUnique({ where: { id } })
  return NextResponse.json({ ok: true, status: fresh?.status ?? 'successful' })
}
