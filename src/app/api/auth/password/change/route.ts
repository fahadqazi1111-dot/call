import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, verifyPassword, hashPassword, rateLimit } from '@/lib/callapp/server'

/**
 * POST: change (or first-time set) the signed-in user's own password.
 * - Users who already have a password must confirm the current one.
 * - Google / OTP-only users (no password yet) may set one directly.
 * Works for every role — regular users, team members and admins alike.
 */
export async function POST(req: Request) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!rateLimit(`pwchange:${me.id}`, 5, 60_000)) {
    return NextResponse.json({ error: 'Too many attempts. Try again shortly.' }, { status: 429 })
  }
  try {
    const body = await req.json()
    const current = typeof body.currentPassword === 'string' ? body.currentPassword : ''
    const next = String(body.newPassword || '')
    if (next.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }
    if (next.length > 72) {
      return NextResponse.json({ error: 'Password is too long (max 72 characters)' }, { status: 400 })
    }
    if (me.passwordHash) {
      if (!current || !verifyPassword(current, me.passwordHash)) {
        return NextResponse.json({ error: 'Your current password is incorrect' }, { status: 400 })
      }
      if (verifyPassword(next, me.passwordHash)) {
        return NextResponse.json({ error: 'New password must be different from the current one' }, { status: 400 })
      }
    }
    await db.user.update({ where: { id: me.id }, data: { passwordHash: hashPassword(next) } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
