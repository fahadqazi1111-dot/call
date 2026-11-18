import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, getFinance, rateLimit } from '@/lib/callapp/server'

/** GET: my withdrawal requests + config (methods, minimum). */
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
    withdrawals,
    minWithdrawal: finance.minWithdrawal,
    methods: finance.withdrawalMethods,
  })
}

/** POST { amount, method, destination } — request a withdrawal of creator earnings. */
export async function POST(req: Request) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!rateLimit(`withdraw:${me.id}`, 4, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }
  try {
    const body = await req.json()
    const amount = Math.round(Number(body.amount) * 100) / 100
    const method = String(body.method || '')
    const destination = String(body.destination || '').trim().slice(0, 120)
    const finance = await getFinance()

    if (!amount || amount <= 0) return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    if (amount < finance.minWithdrawal) {
      return NextResponse.json(
        { error: `Minimum withdrawal is ${finance.minWithdrawal} diamonds` },
        { status: 400 }
      )
    }
    if (!finance.withdrawalMethods.includes(method)) {
      return NextResponse.json({ error: 'Unsupported withdrawal method' }, { status: 400 })
    }
    if (!destination) return NextResponse.json({ error: 'Destination account required' }, { status: 400 })

    const wallet = await db.wallet.findUnique({ where: { userId: me.id } })
    if (!wallet || wallet.earnings < amount) {
      return NextResponse.json({ error: 'Insufficient earnings balance' }, { status: 400 })
    }
    const pending = await db.withdrawal.aggregate({
      where: { userId: me.id, status: 'pending' },
      _sum: { amount: true },
    })
    if ((pending._sum.amount ?? 0) + amount > wallet.earnings) {
      return NextResponse.json({ error: 'You already have pending withdrawals covering this amount' }, { status: 400 })
    }
    const w = await db.withdrawal.create({
      data: { userId: me.id, amount, method, destination },
    })
    return NextResponse.json({ ok: true, withdrawal: w })
  } catch {
    return NextResponse.json({ error: 'Withdrawal request failed' }, { status: 500 })
  }
}
