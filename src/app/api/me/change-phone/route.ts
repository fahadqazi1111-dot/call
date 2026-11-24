import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, publicUser, normalizePhone, rateLimit } from '@/lib/callapp/server'

/**
 * POST: change the signed-in user's phone number.
 *
 * Security model — THREE-step verify-then-commit pattern:
 *
 *   1. The user verifies their CURRENT phone number (OTP sent to current
 * *      number, consumed via /api/auth/otp/verify). This is proof-of-
 *      possession — prevents account takeover by someone who stole a
 *      session token but doesn't control the phone.
 *   2. The user requests a phone OTP for the NEW number (`POST /api/auth/otp`).
 *   3. They verify it (`POST /api/auth/otp/verify`).
 *   4. They submit here with `{ currentCode, newPhone, code, clientKey }`.
 *      We re-check BOTH OTPs (current + new), then swap the phone.
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
    const currentCode = String(body.currentCode || '').trim()
    if (!newPhone) {
      return NextResponse.json({ error: 'Enter a valid phone number' }, { status: 400 })
    }
    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: 'Enter the 6-digit code for your new number' }, { status: 400 })
    }
    if (!/^\d{6}$/.test(currentCode)) {
      return NextResponse.json(
        { error: 'Enter the 6-digit code sent to your current number' },
        { status: 400 },
      )
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

    // STEP 1: Verify the CURRENT phone number.
    // The user must have requested an OTP for their current number AND
    // verified it within the last 10 minutes. This proves they still
    // control the current number before they can change it.
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000)
    const currentOtp = await db.otp.findFirst({
      where: {
        phone: me.phone,
        code: currentCode,
        consumed: true,
        createdAt: { gte: tenMinAgo },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    })
    if (!currentOtp) {
      return NextResponse.json(
        { error: 'Verify your current phone number first. Request a code to your current number and enter it.' },
        { status: 400 },
      )
    }

    // STEP 2: Verify the NEW phone number.
    // The OTP must have been requested AND verified (consumed) within the
    // last 10 minutes. This is the proof-of-possession for the new number.
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
        { error: 'Verify your new phone number. Request a code to the new number and enter it.' },
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
