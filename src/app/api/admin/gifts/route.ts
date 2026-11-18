import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, requireStaff } from '@/lib/callapp/server'

/** GET: full gift catalog (admin view). */
export async function GET(req: Request) {
  const admin = await requireStaff(req)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const gifts = await db.gift.findMany({ orderBy: { sortOrder: 'asc' } })
  return NextResponse.json({ gifts })
}

/** POST: create a gift. */
export async function POST(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  try {
    const body = await req.json()
    const gift = await db.gift.create({
      data: {
        name: String(body.name || 'Gift').slice(0, 30),
        emoji: String(body.emoji || '🎁').slice(0, 8),
        animKind: String(body.animKind || 'generic'),
        sound: String(body.sound || 'gift'),
        category: ['room', 'live', 'both'].includes(body.category) ? body.category : 'both',
        priceCoins: Math.max(1, Math.floor(Number(body.priceCoins) || 1)),
        earnValue: Math.max(0, Number(body.earnValue) || 0),
        durationMs: Math.max(800, Math.min(8000, Math.floor(Number(body.durationMs) || 2200))),
        sortOrder: Math.floor(Number(body.sortOrder) || 99),
        active: body.active !== false,
      },
    })
    return NextResponse.json({ ok: true, gift })
  } catch {
    return NextResponse.json({ error: 'Create failed' }, { status: 500 })
  }
}

/** PUT { id, ...patch }: update gift (price, active, earn value, etc). */
export async function PUT(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  try {
    const body = await req.json()
    const id = String(body.id || '')
    const data: Record<string, unknown> = {}
    if (body.name !== undefined) data.name = String(body.name).slice(0, 30)
    if (body.emoji !== undefined) data.emoji = String(body.emoji).slice(0, 8)
    if (body.priceCoins !== undefined) data.priceCoins = Math.max(1, Math.floor(Number(body.priceCoins)))
    if (body.earnValue !== undefined) data.earnValue = Math.max(0, Number(body.earnValue))
    if (body.active !== undefined) data.active = !!body.active
    if (body.category !== undefined && ['room', 'live', 'both'].includes(body.category)) data.category = body.category
    if (body.sortOrder !== undefined) data.sortOrder = Math.floor(Number(body.sortOrder))
    const gift = await db.gift.update({ where: { id }, data })
    return NextResponse.json({ ok: true, gift })
  } catch {
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
}

/** DELETE ?id= — remove a gift. */
export async function DELETE(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const id = new URL(req.url).searchParams.get('id') || ''
  try {
    await db.gift.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }
}
