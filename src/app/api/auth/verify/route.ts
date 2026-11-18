import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  signToken,
  normalizePhone,
  publicUser,
  ensureWallet,
  normalizeUsername,
  usernameError,
  generateUniqueUsername,
} from '@/lib/callapp/server'
import { sendWelcomeToUser } from '@/lib/callapp/official'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/**
 * Verify OTP. If the phone is not registered yet, respond { needName: true } so
 * the client collects the display name + username, then resend with { name }
 * (and optional { username, email }) to finish signup. When username is omitted
 * on signup, one is auto-generated from the display name. The email is an
 * optional field so the CALL team can reach the user by email too.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const normalized = normalizePhone(body.phone || '')
    if (!normalized) {
      return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 })
    }
    const code = String(body.code || '').trim()
    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: 'Enter the 6-digit code' }, { status: 400 })
    }
    const otp = await db.otp.findFirst({
      where: { phone: normalized, consumed: false, code },
      orderBy: { createdAt: 'desc' },
    })
    if (!otp || otp.expiresAt.getTime() < Date.now()) {
      return NextResponse.json({ error: 'Code is wrong or expired. Request a new one.' }, { status: 400 })
    }

    let user = await db.user.findUnique({ where: { phone: normalized } })
    let isNew = false
    if (!user) {
      const name = String(body.name || '').trim()
      if (!name) {
        // Do NOT consume the code yet - it will be used once the name arrives.
        return NextResponse.json({ needName: true, phone: normalized })
      }
      // Resolve username: user's choice if provided and free, otherwise auto-generated.
      const requested = normalizeUsername(body.username || '')
      let username: string
      if (requested) {
        const unameErr = usernameError(requested)
        if (unameErr) return NextResponse.json({ error: unameErr }, { status: 400 })
        const taken = await db.user.findUnique({ where: { username: requested } })
        if (taken) {
          return NextResponse.json(
            { error: `@${requested} is already taken — try another`, usernameTaken: true },
            { status: 400 }
          )
        }
        username = requested
      } else {
        username = await generateUniqueUsername(name)
      }
      // Optional email (used for email communication — verification codes,
      // password reset, the welcome mail). Must not belong to another account.
      let signupEmail: string | null = null
      const rawEmail = String(body.email || '').trim().toLowerCase()
      if (rawEmail) {
        if (!EMAIL_RE.test(rawEmail)) {
          return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
        }
        const emailOwner = await db.user.findUnique({ where: { email: rawEmail } })
        if (emailOwner) {
          return NextResponse.json(
            { error: 'This email is already used by another CALL account' },
            { status: 400 }
          )
        }
        signupEmail = rawEmail
      }
      await db.otp.update({ where: { id: otp.id }, data: { consumed: true } })
      user = await db.user.create({
        data: {
          phone: normalized,
          name: name.slice(0, 40),
          username,
          email: signupEmail,
          avatarKey: Math.floor(Math.random() * 8),
        },
      })
      isNew = true
    } else {
      await db.otp.update({ where: { id: otp.id }, data: { consumed: true } })
      if (body.name && body.name.trim() && body.name.trim() !== user.name) {
        user = await db.user.update({ where: { id: user.id }, data: { name: String(body.name).trim().slice(0, 40) } })
      }
    }
    await db.user.update({ where: { id: user.id }, data: { lastSeen: new Date() } })
    await ensureWallet(user.id)
    // New account: greeting from the official CALL account + welcome email.
    if (isNew) {
      void sendWelcomeToUser({ id: user.id, name: user.name, email: user.email })
    }
    return NextResponse.json({
      ok: true,
      token: signToken(user.id),
      user: publicUser(user),
    })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
