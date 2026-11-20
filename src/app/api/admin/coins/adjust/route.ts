import { NextResponse } from 'next/server'
import { requireAdmin, applyCoinLedgerDelta, ensureCoinWallet } from '@/lib/callapp/server'
import { db } from '@/lib/db'

/**
 * POST { userId, amount, note } — admin adjusts a user's coin balance.
 *
 * `amount` is signed: positive = credit (give coins), negative = debit
 * (remove coins). Every adjustment is recorded as an `admin_adjustment` line
 * in the coin ledger so the audit trail stays intact. The admin id is stored
 * as the refId so it's always possible to see who adjusted what.
 */
export async function POST(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  try {
    const body = await req.json()
    const userId = String(body.userId || '')
    const amount = Math.round(Number(body.amount) || 0)
    if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    if (!amount) return NextResponse.json({ error: 'amount must be non-zero' }, { status: 400 })
    if (amount < -10_000_000 || amount > 10_000_000) {
      return NextResponse.json({ error: 'amount out of range' }, { status: 400 })
    }

    const target = await db.user.findUnique({ where: { id: userId } })
    if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const note = String(body.note || 'Admin adjustment').slice(0, 200)
    const res = await applyCoinLedgerDelta(
      userId,
      'admin_adjustment',
      { coins: amount },
      `${amount > 0 ? 'Credit' : 'Debit'} by admin ${admin.name}: ${note}`,
      'admin',
      admin.id,
      `admincoinadj:${userId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`
    )
    if (!res.applied) {
      // Should be rare (only idempotency-key collision). Return the current
      // wallet snapshot anyway so the admin sees a consistent state.
      const w = await ensureCoinWallet(userId)
      return NextResponse.json({ ok: true, coinWallet: w })
    }

    // Notify the affected user so adjustments never happen silently.
    await db.notification.create({
      data: {
        userId,
        kind: 'wallet',
        title: amount > 0 ? `Coins credited — ${amount} 🪙` : `Coins adjusted — ${amount} 🪙`,
        body: note,
        refType: 'wallet',
      },
    })

    return NextResponse.json({ ok: true, coinWallet: res.wallet })
  } catch {
    return NextResponse.json({ error: 'Adjustment failed' }, { status: 500 })
  }
}
