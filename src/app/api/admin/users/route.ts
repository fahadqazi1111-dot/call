import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, requireStaff } from '@/lib/callapp/server'

/** GET ?q=&limit=100 — user management list with real-money wallet info. */
export async function GET(req: Request) {
  const admin = await requireStaff(req)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const url = new URL(req.url)
  const q = (url.searchParams.get('q') || '').trim().toLowerCase()
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit')) || 100))
  const users = await db.user.findMany({
    where: q ? { OR: [{ name: { contains: q } }, { phone: { contains: q } }, { email: { contains: q } }, { username: { contains: q } }] } : {},
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { wallet: true },
  })
  return NextResponse.json({
    users: users.map((u) => ({
      id: u.id,
      name: u.name,
      username: u.username,
      phone: u.phone,
      email: u.email,
      emailVerified: u.emailVerified,
      // phoneVerified: a real User row is only created after phone OTP, so any
      // valid phone (>= 7 digits) is treated as verified. Admin-created users
      // skip OTP and are trusted by definition.
      phoneVerified: u.phone.replace(/\D/g, '').length >= 7,
      role: u.role,
      blocked: u.blocked,
      createdAt: u.createdAt.toISOString(),
      lastSeen: u.lastSeen.toISOString(),
      available: u.wallet?.available ?? 0,
      reserved: u.wallet?.reserved ?? 0,
      totalEarned: u.wallet?.totalEarned ?? 0,
      totalWithdrawn: u.wallet?.totalWithdrawn ?? 0,
    })),
  })
}

/** POST { targetId, action, value?, note? } — block/unblock, adjust balance, change role. */
export async function POST(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  try {
    const body = await req.json()
    const targetId = String(body.targetId || '')
    const action = String(body.action || '')
    const target = await db.user.findUnique({ where: { id: targetId } })
    if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    switch (action) {
      case 'block':
        await db.user.update({ where: { id: targetId }, data: { blocked: true } })
        break
      case 'unblock':
        await db.user.update({ where: { id: targetId }, data: { blocked: false } })
        break
      case 'make_admin':
        await db.user.update({ where: { id: targetId }, data: { role: 'admin' } })
        break
      case 'make_team':
        await db.user.update({ where: { id: targetId }, data: { role: 'team' } })
        break
      case 'make_user':
        if (target.id === admin.id) {
          return NextResponse.json({ error: 'You cannot demote yourself' }, { status: 400 })
        }
        await db.user.update({ where: { id: targetId }, data: { role: 'user' } })
        break
      case 'adjust_balance': {
        const amount = Math.round((Number(body.value) || 0) * 100) / 100
        if (!amount) return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
        const note = String(body.note || 'Admin adjustment').slice(0, 200)
        const { applyLedgerDelta } = await import('@/lib/callapp/server')
        const res = await applyLedgerDelta(
          targetId,
          'admin_adjustment',
          { available: amount },
          `${amount > 0 ? 'Credit' : 'Debit'} by admin ${admin.name}: ${note}`,
          'admin',
          admin.id,
          `adminadj:${targetId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`
        )
        if (!res.applied) return NextResponse.json({ error: 'Adjustment failed' }, { status: 500 })
        await db.notification.create({
          data: {
            userId: targetId,
            kind: 'wallet',
            title: amount > 0 ? `Balance credited — $${amount.toFixed(2)}` : `Balance adjusted — $${amount.toFixed(2)}`,
            body: note,
            refType: 'wallet',
          },
        })
        break
      }
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Action failed' }, { status: 500 })
  }
}
