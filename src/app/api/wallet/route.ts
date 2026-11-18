import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, ensureWallet } from '@/lib/callapp/server'

/** GET: my wallet (balance + recent transactions) and active coin packages. */
export async function GET(req: Request) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const wallet = await ensureWallet(me.id)
  const [txs, packages] = await Promise.all([
    db.walletTx.findMany({ where: { userId: me.id }, orderBy: { createdAt: 'desc' }, take: 60 }),
    db.coinPackage.findMany({ where: { active: true }, orderBy: { order: 'asc' } }),
  ])
  const withdrawals = await db.withdrawal.findMany({
    where: { userId: me.id },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })
  return NextResponse.json({
    wallet: {
      coins: wallet.coins,
      earnings: wallet.earnings,
      totalTopUp: wallet.totalTopUp,
      totalSpent: wallet.totalSpent,
      totalEarned: wallet.totalEarned,
    },
    txs,
    packages,
    withdrawals,
  })
}
