import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { signToken, rateLimit } from '@/lib/callapp/server'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/**
 * POST: request an email verification code.
 * NOTE: this deployment has no external mail provider (zero-cost build), so
 * the code is returned as devCode exactly like the sandbox phone OTP flow.
 * The UI labels it as sandbox verification. Swap in a mailer here later
 * without changing the client contract.
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
      data: { email, code, expiresAt: new Date(Date.now() + 10 * 60 * 1000) },
    })
    return NextResponse.json({ ok: true, email, devCode: code, expiresInSec: 600 })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
