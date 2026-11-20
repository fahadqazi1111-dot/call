import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/callapp/server'

/** GET ?unreadOnly=1&limit=50 — my notifications. */
export async function GET(req: Request) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const url = new URL(req.url)
  const unreadOnly = url.searchParams.get('unreadOnly') === '1'
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 50))
  const [items, unread] = await Promise.all([
    db.notification.findMany({
      where: { userId: me.id, ...(unreadOnly ? { read: false } : {}) },
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
    db.notification.count({ where: { userId: me.id, read: false } }),
  ])
  return NextResponse.json({
    notifications: items.map((n) => ({
      id: n.id,
      kind: n.kind,
      title: n.title,
      body: n.body,
      refType: n.refType,
      refId: n.refId,
      read: n.read,
      createdAt: n.createdAt.toISOString(),
    })),
    unread,
  })
}

/** POST { ids?: string[], all?: boolean } — mark notifications read. */
export async function POST(req: Request) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await req.json()
    if (body.all) {
      await db.notification.updateMany({ where: { userId: me.id, read: false }, data: { read: true } })
    } else if (Array.isArray(body.ids) && body.ids.length) {
      await db.notification.updateMany({
        where: { userId: me.id, id: { in: body.ids.slice(0, 100) } },
        data: { read: true },
      })
    }
    const unread = await db.notification.count({ where: { userId: me.id, read: false } })
    return NextResponse.json({ ok: true, unread })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
