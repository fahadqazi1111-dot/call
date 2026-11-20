import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { makeOtp, normalizePhone, rateLimit } from '@/lib/callapp/server'
import { sendOtp } from '@/lib/callapp/otpDelivery'

/**
 * Request an OTP for login or registration.
 *
 * Honest delivery: when an SMS provider is configured in Admin → Authentication,
 * the code is sent as a real SMS / WhatsApp message. When nothing is
 * configured, we fall back to SANDBOX mode — the code is returned in the
 * response (as `devCode`) and the UI shows a clear yellow banner explaining
 * that production requires SMS provider setup. We never pretend to send SMS.
 *
 * Cooldown: 60 seconds between requests for the same phone number to prevent
 * abuse. Rate-limited per IP/phone to 5 per minute.
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
    // Hard rate limit — 5 OTP requests per phone per minute.
    if (!rateLimit(`otp:req:${normalized}`, 5, 60_000)) {
      return NextResponse.json(
        { error: 'Too many requests. Wait a minute and try again.' },
        { status: 429 }
      )
    }
    // Resend cooldown — at most one fresh code every 60 seconds.
    const recent = await db.otp.findFirst({
      where: { phone: normalized },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    })
    if (recent && Date.now() - recent.createdAt.getTime() < 60_000) {
      const wait = Math.ceil((60_000 - (Date.now() - recent.createdAt.getTime())) / 1000)
      return NextResponse.json(
        {
          error: `Please wait ${wait}s before requesting another code.`,
          cooldownSec: wait,
        },
        { status: 429 }
      )
    }
    // Invalidate previous unconsumed codes — only one valid code at a time.
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
    const delivery = await sendOtp(normalized, code)
    // Backwards-compatible shape: devCode is always present (empty string when
    // a real SMS/email was sent), so the existing login flow keeps working.
    return NextResponse.json({
      ok: true,
      phone: normalized,
      channel: delivery.channel,
      sandbox: delivery.sandbox,
      devCode: delivery.sandbox ? delivery.code : '',
      // New explicit field, preferred by the new signup flow.
      code: delivery.sandbox ? delivery.code : undefined,
      expiresInSec: 300,
      otpId: otp.id,
    })
  } catch (e) {
    console.error('[auth/otp] failed:', (e as Error).message)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
