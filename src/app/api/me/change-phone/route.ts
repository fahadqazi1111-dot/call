import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, publicUser, normalizePhone, rateLimit } from '@/lib/callapp/server'

/**
 * POST: change the signed-in user's phone number.
 *
 * Security model — same two-step verify-then-commit pattern used by
 * `/api/me/change-email` and the password-change flow:
 *
 *   1. The user requests a phone OTP for the NEW number (`POST /api/auth/otp`).
 *   2. They verify it (`POST /api/auth/otp/verify`) — that route marks the
 *      `Otp` row as `consumed: true` (the pre-registration mode, no account
 *      is created).
 *   3. They submit here with the same `{ newPhone, code, clientKey }`. We
 *      re-check that a consumed, unexpired OTP exists for that phone+code
 *      pair (10-minute window), uniqueness of the new phone across users,
 *      then atomically swap the phone on the account.
 *
 * Rate-limited to 5 attempts per hour per user to deter abuse.
 */
export async function POST(req: Request) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  // 5 attempts per hour — generous enough for legitimate retries, tight
  // enough to block brute-force guessing of consumed-OTP pairs.
  if (!rateLimit(`changephone:${me.id}`, 5, 60 * 60 * 1000)) {
    return NextResponse.json(
      { error: 'Too many attempts. Please wait a while before trying again.' },
      { status: 429 },
    )
  }
  try {
    const body = await req.json()
    const newPhone = normalizePhone(String(body.newPhone || ''))
    const code = String(body.code || '').trim()
    if (!newPhone) {
      return NextResponse.json({ error: 'Enter a valid phone number' }, { status: 400 })
    }
    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: 'Enter the 6-digit code' }, { status: 400 })
    }
    if (newPhone === me.phone) {
      return NextResponse.json(
        { error: 'This is already your phone number' },
        { status: 400 },
      )
    }
    // Reject placeholder/staff numbers — they can never be reassigned.
    if (/^0{5}/.test(newPhone)) {
      return NextResponse.json({ error: 'Enter a valid phone number' }, { status: 400 })
    }

    // The OTP must have been requested AND verified (consumed) within the
    // last 10 minutes. This is the proof-of-possession for the new number.
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000)
    const otp = await db.otp.findFirst({
      where: {
        phone: newPhone,
        code,
        consumed: true,
        createdAt: { gte: tenMinAgo },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    })
    if (!otp) {
      return NextResponse.json(
        { error: 'Phone verification required. Request and verify a code first.' },
        { status: 400 },
      )
    }

    // Uniqueness check — another account may have grabbed this phone in the
    // meantime (race between OTP request and the swap).
    const clash = await db.user.findFirst({
      where: { phone: newPhone, NOT: { id: me.id } },
      select: { id: true },
    })
    if (clash) {
      return NextResponse.json(
        { error: 'This phone number is already in use' },
        { status: 409 },
      )
    }

    const updated = await db.user.update({
      where: { id: me.id },
      data: { phone: newPhone },
    })
    return NextResponse.json({ ok: true, user: publicUser(updated) })
  } catch (e) {
    console.error('[me/change-phone] failed:', (e as Error).message)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
