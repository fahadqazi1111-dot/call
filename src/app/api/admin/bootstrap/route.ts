import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { db } from '@/lib/db'
import { requireUser, getSetting, setSetting, rateLimit } from '@/lib/callapp/server'

/**
 * POST { code } — claim admin using the one-time setup code (seeded as
 * CALL-ADMIN-2024). On success the code is rotated to a random value so it
 * cannot be reused, and the user becomes an admin.
 */
export async function POST(req: Request) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!rateLimit(`adminboot:${me.id}`, 5, 60_000)) {
    return NextResponse.json({ error: 'Too many attempts' }, { status: 429 })
  }
  try {
    const body = await req.json()
    const code = String(body.code || '').trim()
    const expected = await getSetting<string>('adminSetupCode', '')
    if (!expected || code !== expected) {
      return NextResponse.json({ error: 'Invalid setup code' }, { status: 403 })
    }
    await db.user.update({ where: { id: me.id }, data: { role: 'admin' } })
    await setSetting('adminSetupCode', crypto.randomBytes(12).toString('hex'))
    return NextResponse.json({ ok: true, role: 'admin' })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
