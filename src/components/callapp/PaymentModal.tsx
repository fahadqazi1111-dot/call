'use client'

import { useState } from 'react'
import { ShieldCheck, CreditCard, Loader2, FlaskConical, CheckCircle2, XCircle } from 'lucide-react'
import { api } from '@/lib/callapp/api'

export interface PendingPayment {
  id: string
  amount: number
  currency: string
  isTest: boolean
  provider: string
  description: string
  emoji?: string | null
}

interface Props {
  payment: PendingPayment
  onPaid: () => void
  onClose: () => void
  onCancel?: () => void
}

/**
 * In-app checkout. Two modes:
 *  - sandbox (TEST): clearly labeled "Test mode — no real money"; confirming
 *    runs the same verified fulfillment path as a real webhook.
 *  - stripe: the caller redirects to the hosted checkout URL; this modal is
 *    only used to show the pending state when the user returns.
 */
export function PaymentModal({ payment, onPaid, onClose, onCancel }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<'paid' | 'failed' | null>(null)

  const pay = async () => {
    setBusy(true)
    setError('')
    try {
      const res = await api.confirmSandboxPayment(payment.id)
      if (res.ok && res.status === 'successful') {
        setResult('paid')
        setTimeout(onPaid, 900)
      } else {
        setResult('failed')
        setError('The test payment could not be completed.')
      }
    } catch (e) {
      setResult('failed')
      setError((e as Error).message || 'Payment failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true">
      <div className="w-full max-w-[400px] overflow-hidden rounded-t-[28px] bg-white shadow-2xl sm:rounded-[28px]">
        {/* header */}
        <div className="bg-dark-grad relative px-6 pb-8 pt-7 text-white">
          <div className="pointer-events-none absolute -right-10 -top-14 h-40 w-40 rounded-full bg-[#2F5BE0]/40 blur-2xl" />
          <div className="relative flex items-center justify-between">
            <span className="text-[13px] font-semibold uppercase tracking-[0.16em] text-white/70">Checkout</span>
            <button
              onClick={onClose}
              aria-label="Close checkout"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/90 transition hover:bg-white/20"
            >
              <XCircle size={17} />
            </button>
          </div>
          <div className="relative mt-4 flex items-center gap-3">
            {payment.emoji ? (
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-3xl ring-1 ring-white/20">
                {payment.emoji}
              </span>
            ) : (
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
                <CreditCard size={26} className="text-white/90" />
              </span>
            )}
            <div className="min-w-0">
              <div className="truncate text-[15px] font-bold">{payment.description}</div>
              <div className="text-[26px] font-extrabold tracking-tight">
                ${payment.amount.toFixed(2)} <span className="text-[13px] font-semibold text-white/60">{payment.currency}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 pb-7 pt-5">
          {result === 'paid' ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <CheckCircle2 size={46} className="text-cgreen" />
              <div className="text-lg font-extrabold text-cink">Payment successful</div>
              <p className="text-[13px] text-cmut">Your payment was verified and delivered.</p>
            </div>
          ) : (
            <>
              {payment.isTest && (
                <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-[#F5A524]/40 bg-[#FFF7E6] px-3.5 py-3">
                  <FlaskConical size={17} className="mt-0.5 flex-none text-[#B7791F]" />
                  <div className="text-[12px] leading-[18px] text-[#7c5a12]">
                    <b>Test mode</b> — this checkout uses sandbox money. Nothing here is a real charge, and the
                    transaction is permanently marked as a test. Production uses Stripe Checkout with verified webhooks
                    (mobile builds will use Google Play Billing / Apple IAP).
                  </div>
                </div>
              )}
              <div className="mb-4 flex items-center gap-2.5 rounded-2xl bg-csoft px-3.5 py-3 text-[12px] leading-[18px] text-cmut">
                <ShieldCheck size={17} className="flex-none text-cbrand" />
                Payments are verified server-side before anything is delivered. The gift or campaign activates only
                after the gateway confirms the money.
              </div>
              {error && (
                <div className="mb-3 rounded-xl bg-[#FEF1F0] px-3.5 py-2.5 text-[12.5px] font-semibold text-cred">{error}</div>
              )}
              <button
                className="btn-p flex w-full items-center justify-center gap-2"
                onClick={() => void pay()}
                disabled={busy}
              >
                {busy ? <Loader2 size={18} className="animate-spin" /> : <CreditCard size={18} />}
                {busy ? 'Processing…' : `Pay $${payment.amount.toFixed(2)}`}
              </button>
              {onCancel && !busy && (
                <button className="mt-2.5 h-12 w-full rounded-[16px] text-[14px] font-bold text-cmut transition hover:bg-cbg" onClick={onCancel}>
                  Cancel payment
                </button>
              )}
              <p className="mt-3 text-center text-[11px] leading-[16px] text-cmut">
                By paying you agree to the CALL terms. Creator payouts are bank transfer only.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/** Poll a payment until it leaves `pending` (used after Stripe hosted checkout). */
export async function waitForPayment(paymentId: string, timeoutMs = 15000): Promise<PaymentInfoLite | null> {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await api.paymentStatus(paymentId)
      if (res.payment.status !== 'pending') return res.payment
    } catch {}
    await new Promise((r) => setTimeout(r, 1200))
  }
  return null
}

export interface PaymentInfoLite {
  id: string
  status: string
  amount: number
  isTest: boolean
  purpose: string
}
