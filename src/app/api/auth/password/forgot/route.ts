import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { rateLimit } from '@/lib/callapp/server'
import { getSmtpSettings, sendCodeEmail } from '@/lib/callapp/mail'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/**
 * POST: "Forgot password" — emails a 6-digit reset code to the account
 * owner. Via Gmail SMTP when configured, otherwise the sandbox returns the
 * code in the response so the flow still works with zero setup.
 * Always rate-limited.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const email = String(body.email || '').trim().toLowerCase()
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
    }
    if (!rateLimit(`pwforgot:${email}`, 4, 60_000)) {
      return NextResponse.json({ error: 'Too many requests. Try again in a minute.' }, { status: 429 })
    }
    const user = await db.user.findUnique({ where: { email } })
    if (!user || !user.passwordHash) {
      return NextResponse.json(
        { error: 'No CALL account uses this email, or it was created with phone/Google only' },
        { status: 404 }
      )
    }
    const code = String(Math.floor(100000 + Math.random() * 900000))
    await db.emailOtp.create({
      data: { email, code, purpose: 'reset', expiresAt: new Date(Date.now() + 10 * 60 * 1000) },
    })

    const smtp = await getSmtpSettings()
    if (smtp) {
      try {
        await sendCodeEmail(smtp, email, 'reset', code)
        return NextResponse.json({ ok: true, email, delivered: true, expiresInSec: 600 })
      } catch {
        return NextResponse.json(
          { error: 'Could not send the email — ask the admin to check SMTP settings in the Admin panel' },
          { status: 502 }
        )
      }
    }
    return NextResponse.json({ ok: true, email, delivered: false, devCode: code, expiresInSec: 600 })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
