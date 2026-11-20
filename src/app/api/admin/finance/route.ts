import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireStaff, round2, getFinance, applyLedgerDelta } from '@/lib/callapp/server'
import { safeJson } from '@/lib/callapp/payments'

/**
 * GET — ADMIN FINANCIAL DASHBOARD.
 * Every figure is computed from actual verified records (Payment + GiftSend +
 * Withdrawal + LedgerEntry). Sandbox/test rows are reported separately — they
 * are never merged into real revenue.
 *
 * Query filters: from, to (ISO dates), purpose, provider, status, userId.
 */
export async function GET(req: Request) {
  const admin = await requireStaff(req)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const url = new URL(req.url)
  const from = url.searchParams.get('from') ? new Date(String(url.searchParams.get('from'))) : null
  const to = url.searchParams.get('to') ? new Date(String(url.searchParams.get('to'))) : null
  const purpose = url.searchParams.get('purpose') || ''
  const provider = url.searchParams.get('provider') || ''
  const status = url.searchParams.get('status') || ''
  const userId = url.searchParams.get('userId') || ''

  const created = {
    ...(from && !isNaN(from.getTime()) ? { gte: from } : {}),
    ...(to && !isNaN(to.getTime()) ? { lte: to } : {}),
  }
  const paymentWhere = {
    ...(Object.keys(created).length ? { createdAt: created } : {}),
    ...(purpose ? { purpose } : {}),
    ...(provider ? { provider } : {}),
    ...(status ? { status } : {}),
    ...(userId ? { userId } : {}),
  }

  const [payments, giftAgg, withdrawals, adRevenue, finance] = await Promise.all([
    db.payment.findMany({
      where: paymentWhere,
      orderBy: { createdAt: 'desc' },
      take: 150,
      include: { user: { select: { id: true, name: true, username: true, email: true } } },
    }),
    db.giftSend.aggregate({
      where: { isTest: false, ...(Object.keys(created).length ? { createdAt: created } : {}) },
      _sum: { grossAmount: true, commission: true, feeAmount: true, netAmount: true },
      _count: true,
    }),
    db.withdrawal.groupBy({ by: ['status'], _sum: { amount: true }, _count: true }),
    db.payment.aggregate({
      where: { purpose: 'ad_campaign', status: 'successful', isTest: false },
      _sum: { amount: true, feeAmount: true },
      _count: true,
    }),
    getFinance(),
  ])

  const byStatus = new Map<string, { amount: number; count: number }>()
  for (const row of payments) {
    const cur = byStatus.get(row.status) ?? { amount: 0, count: 0 }
    cur.amount += row.amount
    cur.count += 1
    byStatus.set(row.status, cur)
  }

  const testGifts = await db.giftSend.aggregate({
    where: { isTest: true },
    _sum: { grossAmount: true, commission: true, netAmount: true },
    _count: true,
  })

  const summary = {
    currency: finance.currency,
    giftRevenue: {
      gross: round2(giftAgg._sum.grossAmount ?? 0),
      platformCommission: round2(giftAgg._sum.commission ?? 0),
      providerFees: round2(giftAgg._sum.feeAmount ?? 0),
      creatorNet: round2(giftAgg._sum.netAmount ?? 0),
      count: giftAgg._count,
    },
    adRevenue: {
      total: round2(adRevenue._sum.amount ?? 0),
      fees: round2(adRevenue._sum.feeAmount ?? 0),
      count: adRevenue._count,
    },
    payments: {
      successful: { amount: round2(byStatus.get('successful')?.amount ?? 0), count: byStatus.get('successful')?.count ?? 0 },
      pending: { amount: round2(byStatus.get('pending')?.amount ?? 0), count: byStatus.get('pending')?.count ?? 0 },
      failed: { amount: round2(byStatus.get('failed')?.amount ?? 0), count: byStatus.get('failed')?.count ?? 0 },
      refunded: { amount: round2(byStatus.get('refunded')?.amount ?? 0), count: byStatus.get('refunded')?.count ?? 0 },
      cancelled: { amount: round2(byStatus.get('cancelled')?.amount ?? 0), count: byStatus.get('cancelled')?.count ?? 0 },
    },
    testMode: {
      gross: round2(testGifts._sum.grossAmount ?? 0),
      commission: round2(testGifts._sum.commission ?? 0),
      net: round2(testGifts._sum.netAmount ?? 0),
      count: testGifts._count,
    },
    withdrawalTotals: Object.fromEntries(
      withdrawals.map((r) => [r.status, { amount: round2(r._sum.amount ?? 0), count: r._count }])
    ),
    config: finance,
  }

  const transactions = payments.map((p) => {
    const meta = safeJson(p.meta)
    return {
      id: p.id,
      userId: p.userId,
      user: p.user,
      purpose: p.purpose,
      provider: p.provider,
      status: p.status,
      amount: p.amount,
      currency: p.currency,
      feeAmount: p.feeAmount,
      isTest: p.isTest,
      description:
        p.purpose === 'gift'
          ? `Gift${meta.giftName ? ` — ${meta.giftName}` : ''}`
          : p.purpose === 'room_entry'
            ? 'Room entry'
            : 'Ad campaign',
      createdAt: p.createdAt.toISOString(),
      completedAt: p.completedAt ? p.completedAt.toISOString() : null,
    }
  })

  return NextResponse.json({ summary, transactions })
}

/**
 * POST { userId, amount, note } — admin balance adjustment (credit positive /
 * debit negative), always through the ledger so nothing changes silently.
 */
export async function POST(req: Request) {
  const admin = await requireStaff(req)
  if (!admin || admin.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  try {
    const body = await req.json()
    const userId = String(body.userId || '')
    const amount = round2(Number(body.amount) || 0)
    const note = String(body.note || '').slice(0, 200) || 'Admin adjustment'
    if (!userId || !amount) return NextResponse.json({ error: 'userId and amount required' }, { status: 400 })
    const target = await db.user.findUnique({ where: { id: userId } })
    if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const res = await applyLedgerDelta(
      userId,
      'admin_adjustment',
      { available: amount },
      `${amount > 0 ? 'Credit' : 'Debit'} by admin ${admin.name}: ${note}`,
      'admin',
      admin.id,
      `adminadj:${userId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`
    )
    await db.notification.create({
      data: {
        userId,
        kind: 'wallet',
        title: amount > 0 ? `Balance credited — $${amount.toFixed(2)}` : `Balance adjusted — $${amount.toFixed(2)}`,
        body: note,
        refType: 'wallet',
      },
    })
    return NextResponse.json({ ok: true, wallet: res.wallet })
  } catch {
    return NextResponse.json({ error: 'Adjustment failed' }, { status: 500 })
  }
}
