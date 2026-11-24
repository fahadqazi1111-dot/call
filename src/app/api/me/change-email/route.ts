import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, publicUser, rateLimit } from '@/lib/callapp/server'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/**
 * POST: change the signed-in user's email address.
 *
 * Security model — two-step verify-then-commit, mirrors `/api/me/change-phone`:
 *
 *   1. The user requests an email OTP for the NEW address with
 *      `purpose: 'change_email'` (`POST /api/auth/email/request-code`).
 *   2. They verify it (`POST /api/auth/email/verify`) — that route marks the
 *      `EmailOtp` row as `consumed: true`. The verify route also accepts the
 *      `purpose` field so a `change_email`-scoped code can be matched.
 *   3. They submit here with `{ newEmail, code, clientKey }`. We re-check
 *      that a consumed, unexpired OTP exists for that email+code pair within
 *      the last 10 minutes, uniqueness of the new email across users, then
 *      swap the email AND mark `emailVerified: true`.
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
    if (!EMAIL_RE.test(newEmail)) {
      return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 })
    }
    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: 'Enter the 6-digit code' }, { status: 400 })
    }
    if (me.email && me.email.toLowerCase() === newEmail) {
      return NextResponse.json(
        { error: 'This is already your email address' },
        { status: 400 },
      )
    }

    // Proof-of-possession: a code was issued to the new address AND verified
    // (consumed) within the last 10 minutes. Accept either 'change_email'
    // (preferred, scoped) or the legacy 'verify' purpose for back-compat
    // with callers that don't pass a purpose on the request-code call.
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000)
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
