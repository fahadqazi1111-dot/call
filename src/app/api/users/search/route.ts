import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, normalizeUsername, normalizePhone } from '@/lib/callapp/server'

/**
 * GET /api/users/search?q=<username | phone>
 * Search every registered CALL user by @username (prefix) or phone (exact digits).
 *
 * - Excludes the requester and any blocked accounts.
 * - Normalises `q` with `normalizeUsername()` (lowercase, [a-z0-9_]) before
 *   running a `startsWith` query on the already-lowercase `username` column.
 *   SQLite (dev DB) does not support `mode: 'insensitive'`, and `startsWith`
 *   on the normalised lowercase column is the accurate portable approach.
 * - As a bonus, if `q` looks like a phone number (≥7 digits) we also OR an
 *   exact-digit match against the user's `phone` column.
 * - Returns an array (NOT wrapped in `{ users: [...] }`) of public-user-like
 *   fields. Email / password / role are never returned.
 * - Min query length: 3 chars (after normalisation) OR 7 digits (phone).
 * - Max results: 10.
 */
export async function GET(req: Request) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const raw = (new URL(req.url).searchParams.get('q') || '').trim()
  if (!raw) return NextResponse.json([])

  const usernameNeedle = normalizeUsername(raw)
  const phoneNeedle = raw.replace(/\D/g, '')

  const branches: Record<string, unknown>[] = []
  if (usernameNeedle.length >= 3) {
    branches.push({ username: { startsWith: usernameNeedle } })
  }
  // Bonus: phone exact-digit match. Use the normalised digits only — never the
  // raw input — so a user typing "+92 300 1234567" still finds the right row.
  const phoneNorm = normalizePhone(phoneNeedle)
  if (phoneNorm) {
    branches.push({ phone: phoneNorm })
  }

  if (branches.length === 0) return NextResponse.json([])

  const users = await db.user.findMany({
    where: {
      blocked: false,
      id: { not: me.id },
      OR: branches as never,
    },
    select: {
      id: true,
      name: true,
      username: true,
      avatarKey: true,
      avatarUrl: true,
      phone: true,
      about: true,
      isOfficial: true,
    },
    orderBy: [{ isOfficial: 'desc' }, { name: 'asc' }],
    take: 10,
  })

  return NextResponse.json(users)
}
