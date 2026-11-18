import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, requireStaff } from '@/lib/callapp/server'

/** GET — advertising packages. */
export async function GET(req: Request) {
  const admin = await requireStaff(req)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const packages = await db.adPackage.findMany({ orderBy: { order: 'asc' } })
  return NextResponse.json({ packages })
}

/** POST — create an advertising package. */
export async function POST(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  try {
    const body = await req.json()
    const placements = Array.isArray(body.placements) ? body.placements.join(',') : String(body.placements || 'chats,rooms,profile')
    const pkg = await db.adPackage.create({
      data: {
        name: String(body.name || 'Package').slice(0, 40),
        description: String(body.description || '').slice(0, 160),
        priceUsd: Math.round((Number(body.priceUsd) || 0) * 100) / 100,
        durationDays: Math.max(1, Math.floor(Number(body.durationDays) || 7)),
        placements,
        minBudget: Math.round((Number(body.minBudget) || 0) * 100) / 100,
        order: Math.floor(Number(body.order) || 99),
        active: body.active !== false,
      },
    })
    return NextResponse.json({ ok: true, pkg })
  } catch {
    return NextResponse.json({ error: 'Create failed' }, { status: 500 })
  }
}

/** PUT { id, ...patch } — update a package. */
export async function PUT(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  try {
    const body = await req.json()
    const data: Record<string, unknown> = {}
    if (body.name !== undefined) data.name = String(body.name).slice(0, 40)
    if (body.description !== undefined) data.description = String(body.description).slice(0, 160)
    if (body.priceUsd !== undefined) data.priceUsd = Math.round((Number(body.priceUsd) || 0) * 100) / 100
    if (body.durationDays !== undefined) data.durationDays = Math.max(1, Math.floor(Number(body.durationDays)))
    if (body.placements !== undefined) {
      data.placements = Array.isArray(body.placements) ? body.placements.join(',') : String(body.placements)
    }
    if (body.minBudget !== undefined) data.minBudget = Math.round((Number(body.minBudget) || 0) * 100) / 100
    if (body.order !== undefined) data.order = Math.floor(Number(body.order))
    if (body.active !== undefined) data.active = !!body.active
    const pkg = await db.adPackage.update({ where: { id: String(body.id || '') }, data })
    return NextResponse.json({ ok: true, pkg })
  } catch {
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
}

/** DELETE ?id= — remove a package (existing campaigns keep their snapshot via SetNull). */
export async function DELETE(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const id = new URL(req.url).searchParams.get('id') || ''
  try {
    await db.adPackage.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }
}
