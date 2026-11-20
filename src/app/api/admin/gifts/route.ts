import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, requireStaff, round2 } from '@/lib/callapp/server'

/** GET: full gift catalog (admin view) — real money prices. */
export async function GET(req: Request) {
  const admin = await requireStaff(req)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const gifts = await db.gift.findMany({ orderBy: { sortOrder: 'asc' } })
  return NextResponse.json({ gifts })
}

/** POST: create a gift. Price is REAL MONEY (USD) — admin controlled. */
export async function POST(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  try {
    const body = await req.json()
    const gift = await db.gift.create({
      data: {
        name: String(body.name || 'Gift').slice(0, 30),
        emoji: String(body.emoji || '🎁').slice(0, 8),
        imageUrl: typeof body.imageUrl === 'string' && body.imageUrl ? body.imageUrl.slice(0, 300) : null,
        description: String(body.description || '').slice(0, 160),
        animKind: String(body.animKind || 'generic'),
        sound: String(body.sound || 'gift'),
        category: ['room', 'live', 'both'].includes(body.category) ? body.category : 'both',
        priceUsd: round2(Math.max(0.1, Number(body.priceUsd) || 1)),
        priceCoins: Math.max(0, Math.floor(Number(body.priceCoins) || 0)),
        currency: 'USD',
        platformMap: JSON.stringify({
          android: String(body.androidProduct || '').slice(0, 80) || null,
          ios: String(body.iosProduct || '').slice(0, 80) || null,
        }),
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

/** PUT { id, ...patch }: update gift (price, active, image, platform mapping, etc). */
export async function PUT(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  try {
    const body = await req.json()
    const id = String(body.id || '')
    const data: Record<string, unknown> = {}
    if (body.name !== undefined) data.name = String(body.name).slice(0, 30)
    if (body.emoji !== undefined) data.emoji = String(body.emoji).slice(0, 8)
    if (body.imageUrl !== undefined) data.imageUrl = body.imageUrl ? String(body.imageUrl).slice(0, 300) : null
    if (body.description !== undefined) data.description = String(body.description).slice(0, 160)
    if (body.priceUsd !== undefined) data.priceUsd = round2(Math.max(0.1, Number(body.priceUsd)))
    if (body.priceCoins !== undefined) data.priceCoins = Math.max(0, Math.floor(Number(body.priceCoins)))
    if (body.active !== undefined) data.active = !!body.active
    if (body.category !== undefined && ['room', 'live', 'both'].includes(body.category)) data.category = body.category
    if (body.sortOrder !== undefined) data.sortOrder = Math.floor(Number(body.sortOrder))
    if (body.durationMs !== undefined) data.durationMs = Math.max(800, Math.min(8000, Math.floor(Number(body.durationMs))))
    if (body.androidProduct !== undefined || body.iosProduct !== undefined) {
      const cur = await db.gift.findUnique({ where: { id } })
      let map: Record<string, string | null> = {}
      try {
        map = cur?.platformMap ? (JSON.parse(cur.platformMap) as Record<string, string | null>) : {}
      } catch {}
      if (body.androidProduct !== undefined) map.android = String(body.androidProduct || '').slice(0, 80) || null
      if (body.iosProduct !== undefined) map.ios = String(body.iosProduct || '').slice(0, 80) || null
      data.platformMap = JSON.stringify(map)
    }
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
