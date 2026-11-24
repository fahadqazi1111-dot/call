import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { rateLimit } from '@/lib/callapp/server'
import { sendEmailOtp } from '@/lib/callapp/otpDelivery'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/**
 * POST: request an email verification code.
 *
 * When SMTP is configured in the admin panel (Admin → Email/SMTP), the code
 * is emailed for real. Otherwise the free-sandbox behaviour applies: the code
 * is returned as `devCode` so the UI can surface it in a yellow banner that
 * explains production requires SMTP setup. We never pretend to send email.
 *
 * Cooldown: 60 seconds between requests for the same email. Rate-limited to
 * 5 per minute per email.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const email = String(body.email || '').trim().toLowerCase()
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
    }
    if (!rateLimit(`emailotp:${email}`, 5, 60_000)) {
      return NextResponse.json(
        { error: 'Too many requests. Wait a minute and try again.' },
        { status: 429 }
      )
    }
    // Resend cooldown: 60s between fresh codes for the same email.
    const recent = await db.emailOtp.findFirst({
      where: { email },
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
    // `purpose` scopes the code so the verify + change-email flows can
    // distinguish it from a generic `verify` (registration) or `reset`
    // (forgot-password) code. Default to 'verify' to preserve the existing
    // registration + verify-email behaviour when callers don't send one.
    // When `change_email` is requested, the code is issued to the NEW email
    // address supplied in `body.email` (this route already sends to
    // `body.email`, so no destination override is needed — the change-email
    // caller just passes the new address here directly).
    const rawPurpose = typeof body.purpose === 'string' ? body.purpose : 'verify'
    const purpose =
      rawPurpose === 'reset' || rawPurpose === 'change_email' ? rawPurpose : 'verify'
    // Invalidate previous unconsumed codes for this email/purpose combo.
    await db.emailOtp.updateMany({
      where: { email, purpose, consumed: false },
      data: { consumed: true },
    })
    const code = String(Math.floor(100000 + Math.random() * 900000))
    await db.emailOtp.create({
      data: { email, code, purpose, expiresAt: new Date(Date.now() + 10 * 60 * 1000) },
    })

    const delivery = await sendEmailOtp(email, code, purpose)
    // Backwards-compatible shape: devCode is always present (empty string when
    // a real email was sent), so the existing forgot-password and verify-email
    // flows keep working unchanged.
    return NextResponse.json({
      ok: true,
      email,
      channel: delivery.channel,
      sandbox: delivery.sandbox,
      delivered: !delivery.sandbox,
      devCode: delivery.sandbox ? delivery.code : '',
      code: delivery.sandbox ? delivery.code : undefined,
      expiresInSec: 600,
    })
  } catch (e) {
    console.error('[auth/email/request-code] failed:', (e as Error).message)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
