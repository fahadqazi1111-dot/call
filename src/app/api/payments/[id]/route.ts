import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/callapp/server'
import { safeJson } from '@/lib/callapp/payments'

/** GET — payment status poll (owner or admin). The client polls after checkout. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params
  const payment = await db.payment.findUnique({ where: { id } })
  if (!payment || (payment.userId !== me.id && me.role !== 'admin')) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  const meta = safeJson(payment.meta)
  return NextResponse.json({
    payment: {
      id: payment.id,
      status: payment.status,
      purpose: payment.purpose,
      provider: payment.provider,
      amount: payment.amount,
      currency: payment.currency,
      feeAmount: payment.feeAmount,
      isTest: payment.isTest,
      giftName: typeof meta.giftName === 'string' ? meta.giftName : null,
      createdAt: payment.createdAt.toISOString(),
      completedAt: payment.completedAt ? payment.completedAt.toISOString() : null,
    },
  })
}
