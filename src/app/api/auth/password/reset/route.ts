import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { rateLimit, hashPassword, ensureWallet, publicUser, signToken } from '@/lib/callapp/server'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/**
 * POST: finish password reset — { email, code, newPassword }.
 * Verifies the 6-digit reset code, consumes it and sets the new password.
 * Responds with a fresh session so the user lands straight in the app.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const email = String(body.email || '').trim().toLowerCase()
    const code = String(body.code || '').trim()
    const newPassword = String(body.newPassword || '')
    if (!EMAIL_RE.test(email) || !/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: 'Invalid email or code' }, { status: 400 })
    }
    if (newPassword.length < 8) {
      return NextResponse.json({ error: 'New password must be at least 8 characters' }, { status: 400 })
    }
    if (!rateLimit(`pwreset:${email}`, 10, 60_000)) {
      return NextResponse.json({ error: 'Too many attempts. Try again shortly.' }, { status: 429 })
    }
    const otp = await db.emailOtp.findFirst({
      where: { email, consumed: false, code, purpose: 'reset' },
      orderBy: { createdAt: 'desc' },
    })
    if (!otp || otp.expiresAt.getTime() < Date.now()) {
      return NextResponse.json({ error: 'Code is wrong or expired. Request a new one.' }, { status: 400 })
    }
    const user = await db.user.findUnique({ where: { email } })
    if (!user) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }
    if (user.blocked) {
      return NextResponse.json({ error: 'This account is blocked' }, { status: 403 })
    }
    await db.$transaction([
      db.emailOtp.update({ where: { id: otp.id }, data: { consumed: true } }),
      db.user.update({
        where: { id: user.id },
        data: { passwordHash: hashPassword(newPassword), emailVerified: true, lastSeen: new Date() },
      }),
    ])
    // consume any other outstanding reset codes for this email
    await db.emailOtp.updateMany({
      where: { email, purpose: 'reset', consumed: false },
      data: { consumed: true },
    })
    await ensureWallet(user.id)
    return NextResponse.json({ ok: true, token: signToken(user.id), user: publicUser(user) })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
