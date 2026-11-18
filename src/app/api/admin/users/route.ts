import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, applyWalletDelta } from '@/lib/callapp/server'

/** GET ?q=&limit=100 — user management list with wallet info. */
export async function GET(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const url = new URL(req.url)
  const q = (url.searchParams.get('q') || '').trim().toLowerCase()
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit')) || 100))
  const users = await db.user.findMany({
    where: q ? { OR: [{ name: { contains: q } }, { phone: { contains: q } }, { email: { contains: q } }] } : {},
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { wallet: true },
  })
  return NextResponse.json({
    users: users.map((u) => ({
      id: u.id,
      name: u.name,
      phone: u.phone,
      email: u.email,
      role: u.role,
      blocked: u.blocked,
      createdAt: u.createdAt.toISOString(),
      lastSeen: u.lastSeen.toISOString(),
      coins: u.wallet?.coins ?? 0,
      earnings: u.wallet?.earnings ?? 0,
    })),
  })
}

/** POST { targetId, action, value } — block/unblock, grant coins, change role. */
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
      case 'make_user':
        if (target.id === admin.id) {
          return NextResponse.json({ error: 'You cannot demote yourself' }, { status: 400 })
        }
        await db.user.update({ where: { id: targetId }, data: { role: 'user' } })
        break
      case 'grant_coins': {
        const amount = Math.max(0, Math.floor(Number(body.value) || 0))
        if (!amount) return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
        await applyWalletDelta(
          targetId,
          'admin_credit',
          { coins: amount },
          `Admin credit by ${admin.name}`,
          undefined,
          `admincredit:${targetId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`
        )
        await db.notification.create({
          data: { userId: targetId, kind: 'wallet', title: `You received ${amount} coins from the CALL team`, refType: 'wallet' },
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
