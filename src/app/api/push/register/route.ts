import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/callapp/server'

/**
 * POST /api/push/register
 * Body: { token: string, platform?: 'web' | 'android' | 'ios' }
 *
 * Upserts an FCM device token for the authenticated user. A user can have
 * multiple tokens (phone + tablet + web browser), so we don't replace —
 * we upsert by the unique `token` column.
 */
export async function POST(req: Request) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await req.json()
    const token = String(body?.token || '').trim()
    if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })
    const platform = String(body?.platform || 'web').trim().slice(0, 16) || 'web'
    await db.deviceToken.upsert({
      where: { token },
      update: { userId: me.id, platform, lastUsed: new Date() },
      create: { token, userId: me.id, platform },
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[push/register] failed:', e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
