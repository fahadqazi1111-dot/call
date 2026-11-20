import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  signToken,
  hashPassword,
  rateLimit,
  ensureWallet,
  normalizePhone,
  normalizeUsername,
  usernameError,
  generateUniqueUsername,
  publicUser,
} from '@/lib/callapp/server'
import type { AuthPolicy } from '@/lib/callapp/authPolicy'
import { getAuthPolicy } from '@/lib/callapp/authPolicy'
import { sendWelcomeToUser } from '@/lib/callapp/official'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** Window during which a consumed OTP still counts as "verified" for registration. */
const OTP_VALIDITY_MS = 10 * 60 * 1000

export type { AuthPolicy }

/**
 * POST: register with email + phone + password + verified OTPs.
 *
 * Per the user's requirement #5:
 *   - Email registration: email + phone BOTH required, BOTH must be verified
 *     via OTP before the account is created.
 *   - Phone registration: phone required + OTP verified. Email optional.
 *
 * Verification is re-checked server-side: a consumed, unexpired OTP row must
 * exist for the supplied phone (and email, if provided) within the last
 * 10 minutes. A malicious client cannot simply pass `phoneVerified: true`.
 *
 * The admin can fine-tune these requirements in the admin panel:
 *   - auth.requirePhoneVerification (default: on)
 *   - auth.requireEmailVerification (default: on)
 *   - auth.allowEmailOnlyRegistration (default: off — phone always required)
 *   - auth.allowPhoneOnlyRegistration (default: on)
 */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const email = String(body.email || '').trim().toLowerCase()
    const name = String(body.name || '').trim().slice(0, 40)
    const password = String(body.password || '')
    const username = normalizeUsername(body.username || '')
    const phone = normalizePhone(body.phone || '')
    const policy = await getAuthPolicy()

    // ---- basic input validation ----
    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    if (!phone) return NextResponse.json({ error: 'A valid phone number is required' }, { status: 400 })
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }
    const hasEmail = EMAIL_RE.test(email)
    if (email && !hasEmail) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
    }
    // Phone is always required (the schema requires it AND it is the user's
    // primary contact identity on CALL).
    if (!policy.allowEmailOnlyRegistration && !phone) {
      return NextResponse.json({ error: 'A phone number is required' }, { status: 400 })
    }

    // ---- uniqueness checks ----
    if (!rateLimit(`pwreg:${email || phone}`, 5, 60_000)) {
      return NextResponse.json({ error: 'Too many attempts. Try again shortly.' }, { status: 429 })
    }
    if (email) {
      const emailTaken = await db.user.findUnique({ where: { email } })
      if (emailTaken) {
        return NextResponse.json(
          { error: 'An account with this email already exists' },
          { status: 400 }
        )
      }
    }
    const phoneTaken = await db.user.findUnique({ where: { phone } })
    if (phoneTaken) {
      return NextResponse.json(
        { error: 'An account with this phone number already exists' },
        { status: 400 }
      )
    }
    // Username — must be free if provided.
    let finalUsername = username
    if (finalUsername) {
      const unameErr = usernameError(finalUsername)
      if (unameErr) return NextResponse.json({ error: unameErr }, { status: 400 })
      const unameTaken = await db.user.findUnique({ where: { username: finalUsername } })
      if (unameTaken) {
        return NextResponse.json(
          { error: `@${finalUsername} is already taken — try another` },
          { status: 400 }
        )
      }
    } else {
      finalUsername = await generateUniqueUsername(name)
    }

    // ---- OTP verification re-check (server is the source of truth) ----
    let phoneVerified = false
    let emailVerified = false

    if (policy.requirePhoneVerification) {
      const phoneOtp = await db.otp.findFirst({
        where: {
          phone,
          consumed: true,
          createdAt: { gte: new Date(Date.now() - OTP_VALIDITY_MS) },
        },
        orderBy: { createdAt: 'desc' },
      })
      if (!phoneOtp) {
        return NextResponse.json(
          { error: 'Phone verification is required. Send a code and verify it first.' },
          { status: 400 }
        )
      }
      phoneVerified = true
    }

    if (email && policy.requireEmailVerification) {
      const emailOtp = await db.emailOtp.findFirst({
        where: {
          email,
          purpose: 'verify',
          consumed: true,
          createdAt: { gte: new Date(Date.now() - OTP_VALIDITY_MS) },
        },
        orderBy: { createdAt: 'desc' },
      })
      if (!emailOtp) {
        return NextResponse.json(
          { error: 'Email verification is required. Send a code and verify it first.' },
          { status: 400 }
        )
      }
      emailVerified = true
    } else if (email) {
      // Admin disabled email verification — mark as verified so the welcome
      // email can still go out.
      emailVerified = true
    }

    // ---- create account ----
    const user = await db.user.create({
      data: {
        email: email || null,
        name,
        phone,
        username: finalUsername,
        passwordHash: hashPassword(password),
        emailVerified,
        avatarKey: Math.floor(Math.random() * 8),
      },
    })
    await ensureWallet(user.id)
    void sendWelcomeToUser({ id: user.id, name: user.name, email: user.email })

    return NextResponse.json({
      ok: true,
      token: signToken(user.id),
      user: publicUser(user),
      emailVerified,
      phoneVerified,
    })
  } catch (e) {
    console.error('[auth/password/register] failed:', (e as Error).message)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
