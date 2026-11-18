import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, requireStaff } from '@/lib/callapp/server'

/** GET: coin packages (admin view). */
export async function GET(req: Request) {
  const admin = await requireStaff(req)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const packages = await db.coinPackage.findMany({ orderBy: { order: 'asc' } })
  return NextResponse.json({ packages })
}

/** POST: create a package. */
export async function POST(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  try {
    const body = await req.json()
    const pkg = await db.coinPackage.create({
      data: {
        name: String(body.name || 'Package').slice(0, 30),
        coins: Math.max(1, Math.floor(Number(body.coins) || 1)),
        bonus: Math.max(0, Math.floor(Number(body.bonus) || 0)),
        priceUsd: Math.max(0, Number(body.priceUsd) || 0),
        order: Math.floor(Number(body.order) || 99),
        active: body.active !== false,
      },
    })
    return NextResponse.json({ ok: true, package: pkg })
  } catch {
    return NextResponse.json({ error: 'Create failed' }, { status: 500 })
  }
}

/** PUT { id, ...patch }: update package. */
export async function PUT(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  try {
    const body = await req.json()
    const data: Record<string, unknown> = {}
    if (body.name !== undefined) data.name = String(body.name).slice(0, 30)
    if (body.coins !== undefined) data.coins = Math.max(1, Math.floor(Number(body.coins)))
    if (body.bonus !== undefined) data.bonus = Math.max(0, Math.floor(Number(body.bonus)))
    if (body.priceUsd !== undefined) data.priceUsd = Math.max(0, Number(body.priceUsd))
    if (body.active !== undefined) data.active = !!body.active
    if (body.order !== undefined) data.order = Math.floor(Number(body.order))
    const pkg = await db.coinPackage.update({ where: { id: String(body.id || '') }, data })
    return NextResponse.json({ ok: true, package: pkg })
  } catch {
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
}

/** DELETE ?id= — remove a package. */
export async function DELETE(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const id = new URL(req.url).searchParams.get('id') || ''
  try {
    await db.coinPackage.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }
}
