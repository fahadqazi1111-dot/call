import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { fulfillPayment } from '@/lib/callapp/finance'
import { getPaymentConfig, verifyStripeSignature, type StripeEvent } from '@/lib/callapp/payments'

/**
 * POST /api/payments/webhook/stripe — VERIFIED webhook.
 * The raw body is required for signature verification, so this route reads
 * text() directly. Only checkout.session.completed (paid) triggers
 * fulfillPayment(); everything else is recorded and ignored. Never trust a
 * frontend success redirect — this endpoint is the single source of truth.
 */
export async function POST(req: Request) {
  const raw = await req.text()
  const sig = req.headers.get('stripe-signature')
  const cfg = await getPaymentConfig()
  if (cfg.provider !== 'stripe' || !cfg.stripeWebhookSecret) {
    return NextResponse.json({ error: 'Stripe webhook not configured' }, { status: 400 })
  }
  if (!verifyStripeSignature(raw, sig, cfg.stripeWebhookSecret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  let event: StripeEvent
  try {
    event = JSON.parse(raw) as StripeEvent
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    const obj = event.data?.object
    const paymentId = obj?.metadata?.paymentId || obj?.client_reference_id || ''
    if (!paymentId) return NextResponse.json({ received: true, note: 'no paymentId' })
    const payment = await db.payment.findUnique({ where: { id: paymentId } })
    if (!payment) return NextResponse.json({ received: true, note: 'unknown payment' })
    // provider-reported amount must match our pending amount — reject tampering
    if (typeof obj.amount_total === 'number' && Math.round(payment.amount * 100) !== obj.amount_total) {
      await db.payment.update({ where: { id: payment.id }, data: { status: 'failed' } })
      return NextResponse.json({ received: true, note: 'amount mismatch — marked failed' })
    }
    await fulfillPayment(payment.id)
    return NextResponse.json({ received: true })
  }

  if (event.type === 'checkout.session.expired' || event.type === 'checkout.session.async_payment_failed') {
    const obj = event.data?.object
    const paymentId = obj?.metadata?.paymentId || obj?.client_reference_id || ''
    if (paymentId) {
      await db.payment.updateMany({ where: { id: paymentId, status: 'pending' }, data: { status: 'failed' } })
    }
    return NextResponse.json({ received: true })
  }

  return NextResponse.json({ received: true })
}
