import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, requireStaff } from '@/lib/callapp/server'

/** GET: all ads. */
export async function GET(req: Request) {
  const admin = await requireStaff(req)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const ads = await db.ad.findMany({ orderBy: { weight: 'desc' } })
  return NextResponse.json({ ads })
}

/** POST: create an ad. */
export async function POST(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  try {
    const body = await req.json()
    const placements = Array.isArray(body.placements) ? body.placements.join(',') : String(body.placements || 'chats')
    const ad = await db.ad.create({
      data: {
        title: String(body.title || '').slice(0, 60),
        body: String(body.body || '').slice(0, 200),
        imageUrl: body.imageUrl ? String(body.imageUrl).slice(0, 300) : null,
        linkUrl: body.linkUrl ? String(body.linkUrl).slice(0, 300) : null,
        placements,
        weight: Math.max(1, Math.floor(Number(body.weight) || 1)),
        active: body.active !== false,
      },
    })
    return NextResponse.json({ ok: true, ad })
  } catch {
    return NextResponse.json({ error: 'Create failed' }, { status: 500 })
  }
}

/** PUT { id, ...patch }: update an ad. */
export async function PUT(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  try {
    const body = await req.json()
    const data: Record<string, unknown> = {}
    if (body.title !== undefined) data.title = String(body.title).slice(0, 60)
    if (body.body !== undefined) data.body = String(body.body).slice(0, 200)
    if (body.active !== undefined) data.active = !!body.active
    if (body.weight !== undefined) data.weight = Math.max(1, Math.floor(Number(body.weight)))
    if (body.placements !== undefined) {
      data.placements = Array.isArray(body.placements) ? body.placements.join(',') : String(body.placements)
    }
    const ad = await db.ad.update({ where: { id: String(body.id || '') }, data })
    return NextResponse.json({ ok: true, ad })
  } catch {
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
}

/** DELETE ?id= — remove an ad. */
export async function DELETE(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const id = new URL(req.url).searchParams.get('id') || ''
  try {
    await db.ad.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }
}
