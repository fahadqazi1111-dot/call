import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/callapp/server'

/** POST { title, body, kind } — broadcast a notification to every user. */
export async function POST(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  try {
    const body = await req.json()
    const title = String(body.title || '').trim().slice(0, 120)
    const text = String(body.body || '').trim().slice(0, 300)
    if (!title) return NextResponse.json({ error: 'Title required' }, { status: 400 })
    const users = await db.user.findMany({ where: { blocked: false }, select: { id: true } })
    await db.notification.createMany({
      data: users.map((u) => ({
        userId: u.id,
        kind: 'security',
        title,
        body: text,
      })),
    })
    return NextResponse.json({ ok: true, delivered: users.length })
  } catch {
    return NextResponse.json({ error: 'Broadcast failed' }, { status: 500 })
  }
}
