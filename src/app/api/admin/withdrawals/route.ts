import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, requireStaff, applyLedgerDelta, round2 } from '@/lib/callapp/server'

/** Allowed status transitions for the reserve-based withdrawal lifecycle. */
// pending → under_review → approved → paid
// any pre-paid state → rejected (releases the reserved funds)

/** GET ?status= — withdrawal requests with user + bank details. */
export async function GET(req: Request) {
  const admin = await requireStaff(req)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const status = new URL(req.url).searchParams.get('status')
  const withdrawals = await db.withdrawal.findMany({
    where: status ? { status } : {},
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { user: { select: { id: true, name: true, phone: true, email: true, username: true } } },
  })
  return NextResponse.json({
    withdrawals: withdrawals.map((w) => {
      let bank: Record<string, string> = {}
      try {
        bank = JSON.parse(w.bankDetails || '{}') as Record<string, string>
      } catch {}
      return {
        id: w.id,
        amount: w.amount,
        currency: w.currency,
        method: w.method,
        status: w.status,
        adminNote: w.adminNote,
        transferRef: w.transferRef,
        reviewedAt: w.reviewedAt ? w.reviewedAt.toISOString() : null,
        paidAt: w.paidAt ? w.paidAt.toISOString() : null,
        createdAt: w.createdAt.toISOString(),
        user: w.user,
        bank: {
          holderName: bank.holderName || '',
          bankName: bank.bankName || '',
          accountNumber: bank.accountNumber || '',
          iban: bank.iban || '',
          swift: bank.swift || '',
          countryCode: bank.countryCode || '',
        },
      }
    }),
  })
}

/**
 * POST { id, action: under_review | approve | reject | paid, note?, transferRef? }
 *
 * - under_review: pending → under_review (money stays reserved)
 * - approve:      under_review/pending → approved (money stays reserved — not yet paid)
 * - paid:         approved → paid. The ACTUAL bank transfer is confirmed by the
 *                 admin; only now is the reserved amount finalized:
 *                 reserved -= amount, totalWithdrawn += amount, ledger entry
 *                 with the bank transfer reference for the audit trail.
 * - reject:       any pre-paid state → rejected, reserved amount is RELEASED
 *                 back to available (never destroyed prematurely).
 */
export async function POST(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  try {
    const body = await req.json()
    const id = String(body.id || '')
    const action = String(body.action || '')
    const note = String(body.note || '').slice(0, 300)
    const transferRef = String(body.transferRef || '').trim().slice(0, 80) || null
    const w = await db.withdrawal.findUnique({ where: { id } })
    if (!w) return NextResponse.json({ error: 'Request not found' }, { status: 404 })

    if (action === 'under_review') {
      if (w.status !== 'pending') return NextResponse.json({ error: 'Only pending requests can move to review' }, { status: 400 })
      await db.withdrawal.update({
        where: { id },
        data: { status: 'under_review', reviewedBy: admin.id, reviewedAt: new Date(), adminNote: note },
      })
      return NextResponse.json({ ok: true, status: 'under_review' })
    }

    if (action === 'approve') {
      if (!['pending', 'under_review'].includes(w.status)) {
        return NextResponse.json({ error: 'Only pending/under_review requests can be approved' }, { status: 400 })
      }
      await db.withdrawal.update({
        where: { id },
        data: { status: 'approved', reviewedBy: admin.id, reviewedAt: new Date(), adminNote: note },
      })
      await db.notification.create({
        data: {
          userId: w.userId,
          kind: 'withdrawal',
          title: `Withdrawal approved — $${w.amount.toFixed(2)} bank transfer`,
          body: 'The transfer will be sent to your bank shortly. The amount remains reserved until it is marked paid.',
          refType: 'withdrawal',
          refId: w.id,
        },
      })
      return NextResponse.json({ ok: true, status: 'approved' })
    }

    if (action === 'reject') {
      if (['paid', 'rejected'].includes(w.status)) {
        return NextResponse.json({ error: 'Already finalized' }, { status: 400 })
      }
      await db.withdrawal.update({
        where: { id },
        data: { status: 'rejected', reviewedBy: admin.id, reviewedAt: new Date(), adminNote: note },
      })
      // RELEASE the reserved funds back to available (idempotent by withdrawal id)
      const release = await applyLedgerDelta(
        w.userId,
        'withdrawal_release',
        { available: w.amount, reserved: -w.amount },
        `Withdrawal rejected — $${round2(w.amount).toFixed(2)} returned to available balance`,
        'withdrawal',
        w.id,
        `withdrawal_release:${w.id}`
      )
      if (!release.applied) {
        // funds were never held (should not happen) — nothing else to do
      }
      await db.notification.create({
        data: {
          userId: w.userId,
          kind: 'withdrawal',
          title: `Withdrawal rejected — $${w.amount.toFixed(2)} returned to your balance`,
          body: note || 'Contact support for details.',
          refType: 'withdrawal',
          refId: w.id,
        },
      })
      return NextResponse.json({ ok: true, status: 'rejected' })
    }

    if (action === 'paid') {
      if (w.status !== 'approved') {
        return NextResponse.json({ error: 'Only approved requests can be marked paid' }, { status: 400 })
      }
      if (!transferRef) {
        return NextResponse.json({ error: 'Bank transfer reference is required to mark as paid' }, { status: 400 })
      }
      // FINALIZE: reserved → withdrawn (the money leaves the system)
      const finalize = await applyLedgerDelta(
        w.userId,
        'withdrawal_paid',
        { reserved: -w.amount, totals: { totalWithdrawn: w.amount } },
        `Withdrawal paid via bank transfer — ref ${transferRef}`,
        'withdrawal',
        w.id,
        `withdrawal_paid:${w.id}`
      )
      if (!finalize.applied) {
        return NextResponse.json({ error: 'Already processed' }, { status: 409 })
      }
      await db.withdrawal.update({
        where: { id },
        data: { status: 'paid', reviewedBy: admin.id, reviewedAt: w.reviewedAt ?? new Date(), paidAt: new Date(), transferRef, adminNote: note || w.adminNote },
      })
      await db.notification.create({
        data: {
          userId: w.userId,
          kind: 'withdrawal',
          title: `Withdrawal paid — $${w.amount.toFixed(2)} sent to your bank`,
          body: `Transfer reference: ${transferRef}`,
          refType: 'withdrawal',
          refId: w.id,
        },
      })
      return NextResponse.json({ ok: true, status: 'paid' })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch {
    return NextResponse.json({ error: 'Review failed' }, { status: 500 })
  }
}
