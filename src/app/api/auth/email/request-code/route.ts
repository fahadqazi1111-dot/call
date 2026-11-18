import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { rateLimit } from '@/lib/callapp/server'
import { getSmtpSettings, sendCodeEmail } from '@/lib/callapp/mail'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/**
 * POST: request an email verification code.
 * When SMTP is configured in the admin panel the code is emailed for real;
 * otherwise the free-sandbox behaviour applies and the code is returned as
 * devCode so the UI can surface it. Client contract stays the same.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const email = String(body.email || '').trim().toLowerCase()
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
    }
    if (!rateLimit(`emailotp:${email}`, 5, 60_000)) {
      return NextResponse.json({ error: 'Too many requests. Try again in a minute.' }, { status: 429 })
    }
    const code = String(Math.floor(100000 + Math.random() * 900000))
    await db.emailOtp.create({
      data: { email, code, purpose: 'verify', expiresAt: new Date(Date.now() + 10 * 60 * 1000) },
    })

    const smtp = await getSmtpSettings()
    if (smtp) {
      try {
        await sendCodeEmail(smtp, email, 'verify', code)
        return NextResponse.json({ ok: true, email, delivered: true, expiresInSec: 600 })
      } catch {
        // fall through to sandbox so the flow never dead-ends
      }
    }
    return NextResponse.json({ ok: true, email, delivered: false, devCode: code, expiresInSec: 600 })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
