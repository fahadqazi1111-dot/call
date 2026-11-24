import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/callapp/server'

/**
 * POST /api/push/unregister
 * Body: { token: string }
 *
 * Removes a single device token — called on logout or when FCM issues a
 * fresh token. Tokens are not user-scoped in the request (the unique column
 * is `token` itself) so the row is deleted by token, not by (userId, token).
 * We still require auth so anonymous callers can't wipe other users' tokens.
 */
export async function POST(req: Request) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await req.json()
    const token = String(body?.token || '').trim()
    if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })
    await db.deviceToken.deleteMany({ where: { token } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[push/unregister] failed:', e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
