import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, requireStaff, applyWalletDelta } from '@/lib/callapp/server'

/** GET ?status= — withdrawal requests with user info. */
export async function GET(req: Request) {
  const admin = await requireStaff(req)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const status = new URL(req.url).searchParams.get('status')
  const withdrawals = await db.withdrawal.findMany({
    where: status ? { status } : {},
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { user: { select: { id: true, name: true, phone: true, email: true } } },
  })
  return NextResponse.json({ withdrawals })
}

/** POST { id, action: approve|reject, note } — review a withdrawal. */
export async function POST(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  try {
    const body = await req.json()
    const id = String(body.id || '')
    const action = String(body.action || '')
    const note = String(body.note || '').slice(0, 200)
    const w = await db.withdrawal.findUnique({ where: { id } })
    if (!w) return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    if (w.status !== 'pending') return NextResponse.json({ error: 'Already reviewed' }, { status: 400 })

    if (action === 'approve') {
      // deduct earnings atomically + record tx (idempotent by withdrawal id)
      const res = await applyWalletDelta(
        w.userId,
        'withdrawal',
        { earnings: -w.amount },
        `Withdrawal approved via ${w.method} → ${w.destination}`,
        w.id,
        `withdrawal:${w.id}`
      )
      if (!res.applied) {
        return NextResponse.json({ error: 'Already processed' }, { status: 409 })
      }
      await db.withdrawal.update({ where: { id }, data: { status: 'approved', reviewedAt: new Date(), adminNote: note } })
      await db.notification.create({
        data: { userId: w.userId, kind: 'withdrawal', title: `Withdrawal approved — ${w.amount} diamonds via ${w.method}`, refType: 'withdrawal', refId: w.id },
      })
      return NextResponse.json({ ok: true, status: 'approved' })
    }

    if (action === 'reject') {
      await db.withdrawal.update({ where: { id }, data: { status: 'rejected', reviewedAt: new Date(), adminNote: note } })
      await db.notification.create({
        data: { userId: w.userId, kind: 'withdrawal', title: `Withdrawal rejected — ${w.amount} diamonds`, body: note, refType: 'withdrawal', refId: w.id },
      })
      return NextResponse.json({ ok: true, status: 'rejected' })
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch {
    return NextResponse.json({ error: 'Review failed' }, { status: 500 })
  }
}
