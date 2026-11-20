import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, rateLimit, getFinance, round2, applyLedgerDelta } from '@/lib/callapp/server'

/**
 * GET — my withdrawal requests + config (bank only, minimum amount).
 */
export async function GET(req: Request) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const finance = await getFinance()
  const withdrawals = await db.withdrawal.findMany({
    where: { userId: me.id },
    orderBy: { createdAt: 'desc' },
    take: 30,
  })
  return NextResponse.json({
    withdrawals: withdrawals.map((w) => ({
      id: w.id,
      amount: w.amount,
      currency: w.currency,
      method: w.method,
      status: w.status,
      adminNote: w.adminNote,
      transferRef: w.transferRef,
      createdAt: w.createdAt.toISOString(),
      paidAt: w.paidAt ? w.paidAt.toISOString() : null,
    })),
    minWithdrawal: finance.minWithdrawal,
    methods: finance.withdrawalMethods,
    currency: finance.currency,
  })
}

/**
 * POST { amount, bankAccountId } — request a BANK TRANSFER withdrawal.
 *
 * FINANCIAL RULE (reserve model):
 *   - the requested amount is NEVER destroyed at request time — it moves from
 *     `available` into `reserved` (prevents double spending while remaining
 *     fully auditable)
 *   - admin marks the real bank transfer as Paid → reserved is finalized
 *   - admin rejects → reserved is released back to available
 * Every transition is a ledger entry with an idempotency key.
 */
export async function POST(req: Request) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!rateLimit(`withdraw:${me.id}`, 4, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }
  try {
    const body = await req.json()
    const amount = round2(Number(body.amount))
    const bankAccountId = String(body.bankAccountId || '')
    const finance = await getFinance()

    if (!amount || amount <= 0) return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    if (amount < finance.minWithdrawal) {
      return NextResponse.json(
        { error: `Minimum withdrawal is $${finance.minWithdrawal.toFixed(2)}` },
        { status: 400 }
      )
    }

    const bank = bankAccountId
      ? await db.bankAccount.findUnique({ where: { id: bankAccountId } })
      : await db.bankAccount.findFirst({ where: { userId: me.id }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }] })
    if (!bank || bank.userId !== me.id) {
      return NextResponse.json({ error: 'Add a bank account first — bank transfer is the only withdrawal method' }, { status: 400 })
    }

    const wallet = await db.wallet.findUnique({ where: { userId: me.id } })
    if (!wallet || wallet.available < amount) {
      return NextResponse.json({ error: 'Insufficient available balance' }, { status: 400 })
    }

    const bankDetails = {
      holderName: bank.holderName,
      bankName: bank.bankName,
      accountNumber: bank.accountNumber,
      iban: bank.iban,
      swift: bank.swift,
      countryCode: bank.countryCode,
    }

    const w = await db.withdrawal.create({
      data: {
        userId: me.id,
        amount,
        currency: finance.currency,
        method: 'bank',
        bankAccountId: bank.id,
        bankDetails: JSON.stringify(bankDetails),
        status: 'pending',
      },
    })

    // RESERVE — money moves available → reserved (never destroyed)
    const res = await applyLedgerDelta(
      me.id,
      'withdrawal_hold',
      { available: -amount, reserved: amount },
      `Withdrawal request — bank transfer to ${bank.bankName} ••••${bank.accountNumber.slice(-4)}`,
      'withdrawal',
      w.id,
      `withdrawal_hold:${w.id}`
    )
    if (!res.applied) {
      await db.withdrawal.delete({ where: { id: w.id } })
      return NextResponse.json({ error: 'Duplicate request ignored' }, { status: 409 })
    }

    await db.notification.create({
      data: {
        userId: me.id,
        kind: 'withdrawal',
        title: `Withdrawal requested — $${amount.toFixed(2)} via bank transfer`,
        body: 'Your request is pending review. The amount is reserved until the transfer is completed.',
        refType: 'withdrawal',
        refId: w.id,
      },
    })

    return NextResponse.json({ ok: true, withdrawal: { ...w, bankDetails: undefined } })
  } catch {
    return NextResponse.json({ error: 'Withdrawal request failed' }, { status: 500 })
  }
}
