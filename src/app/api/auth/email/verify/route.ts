import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { signToken, readToken, rateLimit } from '@/lib/callapp/server'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/**
 * POST: verify an email code. Marks the email verified on the linked account,
 * or links the email to the current account (body.linkToken). Response
 * mirrors the phone OTP flow: { ok, token?, user? } when a session should
 * start, or { verified: true } when just verifying an existing account.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const email = String(body.email || '').trim().toLowerCase()
    const code = String(body.code || '').trim()
    if (!EMAIL_RE.test(email) || !/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: 'Invalid email or code' }, { status: 400 })
    }
    if (!rateLimit(`emailverify:${email}`, 10, 60_000)) {
      return NextResponse.json({ error: 'Too many attempts. Try again shortly.' }, { status: 429 })
    }
    // `purpose` scopes which kind of code is being verified. Defaults to
    // 'verify' (registration / verify-email). The change-email flow sends
    // purpose='change_email' so the OTP it requested (and now wants to
    // consume) is the one that gets matched.
    const rawPurpose = typeof body.purpose === 'string' ? body.purpose : 'verify'
    const purpose =
      rawPurpose === 'reset' || rawPurpose === 'change_email' ? rawPurpose : 'verify'
    const otp = await db.emailOtp.findFirst({
      where: { email, consumed: false, code, purpose },
      orderBy: { createdAt: 'desc' },
    })
    if (!otp || otp.expiresAt.getTime() < Date.now()) {
      return NextResponse.json({ error: 'Code is wrong or expired. Request a new one.' }, { status: 400 })
    }
    await db.emailOtp.update({ where: { id: otp.id }, data: { consumed: true } })

    // If a session token was supplied, link + verify that account's email.
    const userId = readToken(body.linkToken)
    if (userId) {
      const me = await db.user.findUnique({ where: { id: userId } })
      if (me) {
        if (me.email && me.email !== email) {
          return NextResponse.json({ error: 'Account already uses a different email' }, { status: 400 })
        }
        const clash = await db.user.findUnique({ where: { email } })
        if (clash && clash.id !== me.id) {
          return NextResponse.json({ error: 'Email already registered to another account' }, { status: 400 })
        }
        const user = await db.user.update({
          where: { id: me.id },
          data: { email, emailVerified: true },
        })
        return NextResponse.json({ verified: true, user: { id: user.id } })
      }
    }
    return NextResponse.json({ verified: true, email })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
