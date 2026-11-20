import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { normalizeUsername, usernameError, readToken } from '@/lib/callapp/server'

/**
 * GET /api/auth/username/check?u=fahad_q&token=...
 * Public availability check used live while typing a username.
 * - Validates format + reserved words (no DB hit needed to reject).
 * - Checks uniqueness in the database.
 * - When a valid session token is passed, "taken by me" counts as available
 *   (used by the profile username editor).
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const raw = url.searchParams.get('u') || ''
    const username = normalizeUsername(raw)
    if (raw && raw !== username) {
      return NextResponse.json({ ok: true, available: false, reason: 'Only lowercase letters, numbers and _ allowed' })
    }
    const err = usernameError(username)
    if (err) return NextResponse.json({ ok: true, available: false, reason: err })

    const taken = await db.user.findUnique({ where: { username }, select: { id: true } })
    if (!taken) return NextResponse.json({ ok: true, available: true })

    const token = req.headers.get('x-auth-token') || url.searchParams.get('token') || ''
    const myId = readToken(token)
    if (myId && taken.id === myId) return NextResponse.json({ ok: true, available: true, mine: true })

    return NextResponse.json({ ok: true, available: false, reason: `@${username} is already taken` })
  } catch {
    return NextResponse.json({ ok: false, available: false, reason: 'Could not check right now' }, { status: 500 })
  }
}
