import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, publicUser, rateLimit } from '@/lib/callapp/server'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/**
 * POST: change the signed-in user's email address.
 *
 * Security model — THREE-step verify-then-commit (mirrors change-phone):
 *
 *   1. Verify CURRENT email — user requests an OTP to their current email
 *      and verifies it. Prevents account takeover by session-token thieves.
 *   2. Verify NEW email — user requests an OTP to the NEW address with
 *      `purpose: 'change_email'` and verifies it.
 *   3. Submit here with `{ currentCode, newEmail, code, clientKey }`.
 *      We re-check BOTH OTPs, uniqueness, then swap the email.
 *
 * Rate-limited to 5 attempts per hour per user.
 */
export async function POST(req: Request) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!rateLimit(`changeemail:${me.id}`, 5, 60 * 60 * 1000)) {
    return NextResponse.json(
      { error: 'Too many attempts. Please wait a while before trying again.' },
      { status: 429 },
    )
  }
  try {
    const body = await req.json()
    const newEmail = String(body.newEmail || '').trim().toLowerCase()
    const code = String(body.code || '').trim()
    const currentCode = String(body.currentCode || '').trim()
    if (!EMAIL_RE.test(newEmail)) {
      return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 })
    }
    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: 'Enter the 6-digit code sent to your new email' }, { status: 400 })
    }
    if (!/^\d{6}$/.test(currentCode)) {
      return NextResponse.json(
        { error: 'Enter the 6-digit code sent to your current email' },
        { status: 400 },
      )
    }
    if (me.email && me.email.toLowerCase() === newEmail) {
      return NextResponse.json(
        { error: 'This is already your email address' },
        { status: 400 },
      )
    }

    // STEP 1: Verify the CURRENT email.
    // Only required if the user already has an email set. Phone-only
    // accounts (no email) skip this step.
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000)
    if (me.email) {
      const currentOtp = await db.emailOtp.findFirst({
        where: {
          email: me.email,
          code: currentCode,
          consumed: true,
          createdAt: { gte: tenMinAgo },
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      })
      if (!currentOtp) {
        return NextResponse.json(
          { error: 'Verify your current email first. Request a code to your current email and enter it.' },
          { status: 400 },
        )
      }
    }

    // STEP 2: Verify the NEW email.
    const otp = await db.emailOtp.findFirst({
      where: {
        email: newEmail,
        code,
        consumed: true,
        purpose: { in: ['change_email', 'verify'] },
        createdAt: { gte: tenMinAgo },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    })
    if (!otp) {
      return NextResponse.json(
        { error: 'Email verification required. Request and verify a code first.' },
        { status: 400 },
      )
    }

    // Uniqueness — another account may have grabbed this email in the
    // meantime.
    const clash = await db.user.findFirst({
      where: { email: newEmail, NOT: { id: me.id } },
      select: { id: true },
    })
    if (clash) {
      return NextResponse.json({ error: 'This email is already in use' }, { status: 409 })
    }

    const updated = await db.user.update({
      where: { id: me.id },
      data: { email: newEmail, emailVerified: true },
    })
    return NextResponse.json({ ok: true, user: publicUser(updated) })
  } catch (e) {
    console.error('[me/change-email] failed:', (e as Error).message)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
