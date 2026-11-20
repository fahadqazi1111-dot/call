import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { normalizePhone, rateLimit } from '@/lib/callapp/server'

/**
 * Verify a phone OTP WITHOUT creating a user.
 *
 * This endpoint is used by the registration flow to prove the user controls
 * the phone number BEFORE the account is created. The OTP row is marked
 * consumed on success; the registration endpoint later re-checks that a
 * consumed, unexpired OTP exists for this phone within the last 10 minutes
 * — so a malicious client cannot simply pass `phoneVerified: true`.
 *
 * The login/OTP-signup flow (which auto-creates the account) is unchanged and
 * lives at /api/auth/verify.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const normalized = normalizePhone(body.phone || '')
    if (!normalized) {
      return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 })
    }
    const code = String(body.code || '').trim()
    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: 'Enter the 6-digit code' }, { status: 400 })
    }
    if (!rateLimit(`otpverify:${normalized}`, 10, 60_000)) {
      return NextResponse.json(
        { error: 'Too many attempts. Wait a minute and try again.' },
        { status: 429 }
      )
    }
    const otp = await db.otp.findFirst({
      where: { phone: normalized, consumed: false, code },
      orderBy: { createdAt: 'desc' },
    })
    if (!otp || otp.expiresAt.getTime() < Date.now()) {
      return NextResponse.json(
        { error: 'Code is wrong or expired. Request a new one.' },
        { status: 400 }
      )
    }
    await db.otp.update({ where: { id: otp.id }, data: { consumed: true } })
    return NextResponse.json({
      ok: true,
      verified: true,
      phone: normalized,
      verifiedAt: new Date().toISOString(),
    })
  } catch (e) {
    console.error('[auth/otp/verify] failed:', (e as Error).message)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
