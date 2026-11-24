import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/callapp/server'
import { sendPushToUser, sendPushToAll } from '@/lib/callapp/firebase'

/**
 * POST /api/admin/push
 * Body: { title: string, body: string, userId?: string, imageUrl?: string }
 *
 * Admin-only: send a custom push notification.
 *  - If `userId` is supplied, target only that user's devices.
 *  - Otherwise broadcast to every registered device on the platform.
 *
 * Returns { ok, sent } where `sent` is the count of successful deliveries
 * (best-effort — Firebase may still drop pushes after this count).
 */
export async function POST(req: Request) {
  const me = await requireAdmin(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await req.json()
    const title = String(body?.title || '').trim()
    const text = String(body?.body || '').trim()
    if (!title || !text) {
      return NextResponse.json({ error: 'title and body are required' }, { status: 400 })
    }
    const userId = body?.userId ? String(body.userId).trim() : undefined
    const imageUrl = body?.imageUrl ? String(body.imageUrl).trim() : undefined

    const payload = { title, body: text, imageUrl, data: { kind: 'admin' } }
    const sent = userId
      ? (await sendPushToUser(userId, payload), 1)
      : await sendPushToAll(payload)

    return NextResponse.json({ ok: true, sent })
  } catch (e) {
    console.error('[admin/push] failed:', e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
