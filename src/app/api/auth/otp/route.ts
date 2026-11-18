import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { makeOtp, normalizePhone } from '@/lib/callapp/server'

/**
 * Request an OTP for login. Zero-budget mode: the OTP is generated locally and
 * returned in the response so it can be shown in the app UI (no SMS gateway needed).
 */
export async function POST(req: Request) {
  try {
    const { phone } = await req.json()
    const normalized = normalizePhone(phone || '')
    if (!normalized) {
      return NextResponse.json({ error: 'Enter a valid phone number' }, { status: 400 })
    }
    // Placeholder numbers (staff/official accounts created with 000… numbers)
    // can never be used for OTP login — they authenticate by email + password.
    if (/^0{5}/.test(normalized)) {
      return NextResponse.json({ error: 'Enter a valid phone number' }, { status: 400 })
    }
    // Invalidate previous unconsumed codes
    await db.otp.updateMany({
      where: { phone: normalized, consumed: false },
      data: { consumed: true },
    })
    const code = makeOtp()
    const otp = await db.otp.create({
      data: {
        phone: normalized,
        code,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    })
    return NextResponse.json({
      ok: true,
      phone: normalized,
      devCode: otp.code,
      expiresInSec: 300,
    })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
