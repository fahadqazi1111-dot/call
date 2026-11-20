import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  normalizePhone,
  rateLimit,
  signToken,
  ensureWallet,
  publicUser,
  generateUniqueUsername,
  verifyGooglePendingToken,
} from '@/lib/callapp/server'
import { sendWelcomeToUser } from '@/lib/callapp/official'

/**
 * Verify a phone OTP.
 *
 * Two modes:
 *
 * 1) **Pre-registration check** (default): no `googlePendingToken` in the
 *    body. The OTP row is marked consumed on success; the response is just
 *    `{ ok, verified, phone, verifiedAt }`. The signup endpoint later
 *    re-checks that a consumed, unexpired OTP exists for this phone.
 *
 * 2) **Complete Google signup**: a `googlePendingToken` is also sent. We
 *    verify that signed token (stateless, no DB row), re-check that no
 *    user already exists with this `googleId` or `email` (race safety),
 *    consume the OTP row, then create the `User` with the verified phone
 *    from the OTP row and the Google identity from the pending token. The
 *    response carries `{ ok, created, token, user }` so the client can
 *    `loginSuccess()` directly.
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
    if (!rateLimit(`otpverify:${normalized}`, 10, 60_000)) {
      return NextResponse.json(
        { error: 'Too many attempts. Wait a minute and try again.' },
        { status: 429 }
      )
    }

    // Optional: complete a Google signup that was deferred during /api/auth/google.
    const googlePending = body.googlePendingToken
      ? verifyGooglePendingToken(body.googlePendingToken)
      : null
    if (body.googlePendingToken && !googlePending) {
      return NextResponse.json(
        { error: 'Your Google session expired. Please sign in with Google again.' },
        { status: 401 }
      )
    }

    // Race-safety: make sure no account exists yet for this phone (when
    // completing Google signup) and no account exists for this googleId/email
    // (someone could have completed signup in another tab).
    if (googlePending) {
      const phoneTaken = await db.user.findUnique({ where: { phone: normalized } })
      if (phoneTaken) {
        return NextResponse.json(
          { error: 'This phone number is already linked to an account. Log in instead.' },
          { status: 409 }
        )
      }
      const idTaken =
        (await db.user.findUnique({ where: { googleId: googlePending.googleId } })) ||
        (googlePending.email
          ? await db.user.findUnique({ where: { email: googlePending.email } })
          : null)
      if (idTaken) {
        // The Google identity is already linked — return as a soft conflict;
        // the client should just log in with Google again to get a session.
        return NextResponse.json(
          { error: 'This Google account already exists. Log in with Google to continue.' },
          { status: 409 }
        )
      }
    }

    const otp = await db.otp.findFirst({
      where: { phone: normalized, consumed: false, code },
      orderBy: { createdAt: 'desc' },
    })
    if (!otp || otp.expiresAt.getTime() < Date.now()) {
      return NextResponse.json(
        { error: 'Code is wrong or expired. Request a new one.' },
        { status: 400 }
      )
    }
    // Consume the OTP row in both modes — one code, one use.
    await db.otp.update({ where: { id: otp.id }, data: { consumed: true } })

    if (googlePending) {
      const username = await generateUniqueUsername(googlePending.name || 'user')
      const user = await db.user.create({
        data: {
          phone: normalized,
          email: googlePending.email || null,
          emailVerified: googlePending.emailVerified,
          googleId: googlePending.googleId,
          name: googlePending.name,
          username,
          avatarUrl: googlePending.avatarUrl || null,
          avatarKey: Math.floor(Math.random() * 8),
        },
      })
      await ensureWallet(user.id)
      void sendWelcomeToUser({ id: user.id, name: user.name, email: user.email })
      return NextResponse.json({
        ok: true,
        created: true,
        verified: true,
        phone: normalized,
        verifiedAt: new Date().toISOString(),
        token: signToken(user.id),
        user: publicUser(user),
      })
    }

    return NextResponse.json({
      ok: true,
      verified: true,
      phone: normalized,
      verifiedAt: new Date().toISOString(),
    })
  } catch (e) {
    console.error('[auth/otp/verify] failed:', (e as Error).message)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
