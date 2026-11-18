import crypto from 'crypto'
import { db } from '@/lib/db'
import { getSetting, providerFeeFor, round2 } from './server'

/**
 * Payment provider abstraction.
 *
 * WEB (current target): Stripe Checkout via the REST API — server-side keys
 * only, verified webhook, duplicate-safe fulfillment. When no Stripe keys are
 * configured the app runs in SANDBOX mode: a clearly labeled in-app test
 * checkout that NEVER represents real money (isTest=true on every sandbox
 * payment) so the flow can be tested end-to-end without pretending a demo
 * payment is real.
 *
 * FUTURE NATIVE (Capacitor, architecture only — NOT built in this phase):
 * Android → Google Play Billing, iOS → Apple StoreKit/IAP. Gift prices carry
 * `platformMap` product ids. Native purchases will call
 * POST /api/payments/native/verify with the store receipt; the same
 * fulfillPayment() path runs after server-side store validation. The mobile
 * WebView must NOT open an external gateway for digital gifts.
 */

export type PaymentProviderId = 'stripe' | 'sandbox'

export interface PaymentConfig {
  provider: PaymentProviderId
  stripeSecretKey: string
  stripeWebhookSecret: string
}

export function publicBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '')
}

export async function getPaymentConfig(): Promise<PaymentConfig> {
  const s = await getSetting<Partial<PaymentConfig>>('payments', {})
  const envKey = process.env.STRIPE_SECRET_KEY || ''
  const envWh = process.env.STRIPE_WEBHOOK_SECRET || ''
  const cfg: PaymentConfig = {
    provider: (s.provider as PaymentProviderId) === 'stripe' ? 'stripe' : 'sandbox',
    stripeSecretKey: (s.stripeSecretKey || envKey || '').trim(),
    stripeWebhookSecret: (s.stripeWebhookSecret || envWh || '').trim(),
  }
  // Stripe selected but not usable → fall back to sandbox so checkout never dead-ends.
  if (cfg.provider === 'stripe' && !cfg.stripeSecretKey) cfg.provider = 'sandbox'
  return cfg
}

export interface CheckoutInfo {
  provider: PaymentProviderId
  isTest: boolean
  /** External hosted checkout URL (Stripe). null for sandbox — client shows the in-app test checkout. */
  checkoutUrl: string | null
}

/** Create the provider checkout for a pending Payment row. */
export async function createCheckout(payment: {
  id: string
  amount: number
  currency: string
  purpose: string
  meta: string
}): Promise<CheckoutInfo> {
  const cfg = await getPaymentConfig()
  if (cfg.provider === 'stripe' && cfg.stripeSecretKey) {
    const meta = safeJson(payment.meta)
    const label =
      payment.purpose === 'gift'
        ? `CALL gift${meta.giftName ? ` — ${meta.giftName}` : ''}`
        : payment.purpose === 'room_entry'
          ? 'CALL room entry'
          : 'CALL ad campaign'
    const body = new URLSearchParams()
    body.set('mode', 'payment')
    body.set('client_reference_id', payment.id)
    body.set('metadata[paymentId]', payment.id)
    body.set('success_url', `${publicBaseUrl()}/?payment_return=${payment.id}`)
    body.set('cancel_url', `${publicBaseUrl()}/?payment_cancel=${payment.id}`)
    body.set('line_items[0][quantity]', '1')
    body.set('line_items[0][price_data][currency]', (payment.currency || 'USD').toLowerCase())
    body.set('line_items[0][price_data][unit_amount]', String(Math.round(payment.amount * 100)))
    body.set('line_items[0][price_data][product_data][name]', label.slice(0, 120))
    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
      cache: 'no-store',
    })
    const data = (await res.json()) as { url?: string; id?: string; error?: { message?: string } }
    if (!res.ok || !data.url) {
      throw new Error(data.error?.message || 'Stripe checkout failed')
    }
    await db.payment.update({ where: { id: payment.id }, data: { providerRef: data.id ?? null } })
    return { provider: 'stripe', isTest: false, checkoutUrl: data.url }
  }
  // sandbox — in-app test checkout, clearly labeled in the UI
  return { provider: 'sandbox', isTest: true, checkoutUrl: null }
}

/** Estimated provider fee recorded at checkout time (webhook may refine it). */
export async function feeEstimateFor(amount: number): Promise<number> {
  return providerFeeFor(amount)
}

/* ---------------- Stripe webhook signature verification ---------------- */

/**
 * Verifies the `Stripe-Signature` header (t=…,v1=…) against the raw body.
 * Returns true only for a valid, fresh signature — never trust redirects.
 */
export function verifyStripeSignature(rawBody: string, sigHeader: string | null, secret: string, toleranceSec = 300): boolean {
  if (!sigHeader || !secret) return false
  const parts = sigHeader.split(',').map((p) => p.trim())
  let ts = ''
  const v1s: string[] = []
  for (const p of parts) {
    const [k, v] = p.split('=')
    if (k === 't') ts = v
    else if (k === 'v1') v1s.push(v)
  }
  if (!ts || v1s.length === 0) return false
  const age = Math.abs(Date.now() / 1000 - Number(ts))
  if (!Number.isFinite(age) || age > toleranceSec) return false
  const expected = crypto.createHmac('sha256', secret).update(`${ts}.${rawBody}`).digest('hex')
  return v1s.some((v) => {
    try {
      return crypto.timingSafeEqual(Buffer.from(v, 'hex'), Buffer.from(expected, 'hex'))
    } catch {
      return false
    }
  })
}

/** Minimal Stripe event payload typing for the two events we consume. */
export interface StripeEvent {
  type: string
  data: {
    object: {
      id?: string
      client_reference_id?: string
      metadata?: Record<string, string>
      payment_status?: string
      amount_total?: number
      status?: string
    }
  }
}

export function safeJson(raw: string | null | undefined): Record<string, unknown> {
  try {
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

export function roundMoney(n: number): number {
  return round2(n)
}
