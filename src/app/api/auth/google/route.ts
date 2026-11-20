import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  signToken,
  getSetting,
  ensureWallet,
  publicUser,
  rateLimit,
  signGooglePendingToken,
} from '@/lib/callapp/server'
import { sendWelcomeToUser } from '@/lib/callapp/official'

interface GoogleTokenInfo {
  aud?: string
  sub?: string
  email?: string
  email_verified?: string | boolean
  name?: string
  picture?: string
  error_description?: string
}

/**
 * POST { credential } — Google Identity Services ID token.
 *
 * Two outcomes:
 *  1) Returning user (matched by googleId or verified email): logs in
 *     immediately, returns a login token. Phone verification is NOT
 *     re-required for existing accounts.
 *  2) New Google identity: we do NOT create the account here. Instead we
 *     mint a short-lived, HMAC-signed `googlePendingToken` carrying the
 *     verified Google identity (googleId, email, name, emailVerified,
 *     avatarUrl) and return `{ googlePending: true, googlePendingToken,
 *     googleInfo }`. The client then routes the user to the phone-OTP step;
 *     /api/auth/otp/verify consumes the OTP + pending token and creates the
 *     User row with the real verified phone number — no fake phones, no
 *     account-creation bypass.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const credential = String(body.credential || '')
    if (!credential) return NextResponse.json({ error: 'credential required' }, { status: 400 })
    if (!rateLimit('google:global', 60, 60_000)) {
      return NextResponse.json({ error: 'Too many attempts, try again shortly' }, { status: 429 })
    }

    const authCfg = await getSetting<{ googleClientId?: string }>('auth', {})
    if (!authCfg.googleClientId) {
      return NextResponse.json(
        { error: 'Google sign-in is not configured yet. An admin must set the Google Client ID.' },
        { status: 400 }
      )
    }

    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`)
    if (!res.ok) return NextResponse.json({ error: 'Google token rejected' }, { status: 401 })
    const info = (await res.json()) as GoogleTokenInfo
    if (info.error_description) return NextResponse.json({ error: 'Google token rejected' }, { status: 401 })
    if (info.aud !== authCfg.googleClientId) {
      return NextResponse.json({ error: 'Google token audience mismatch' }, { status: 401 })
    }
    if (!info.sub) return NextResponse.json({ error: 'Google token missing subject' }, { status: 401 })

    const email = info.email?.toLowerCase() ?? null
    const emailVerified = email ? info.email_verified === 'true' || info.email_verified === true : false

    // 1) match by googleId, 2) by verified email — both are returning users.
    let user = await db.user.findUnique({ where: { googleId: info.sub } })
    if (!user && email) user = await db.user.findUnique({ where: { email } })
    if (user) {
      // Existing user — log them in directly. Link their googleId if missing.
      if (!user.googleId) {
        user = await db.user.update({ where: { id: user.id }, data: { googleId: info.sub } })
      }
      if (user.blocked) return NextResponse.json({ error: 'This account is blocked' }, { status: 403 })
      await db.user.update({ where: { id: user.id }, data: { lastSeen: new Date() } })
      await ensureWallet(user.id)
      return NextResponse.json({ ok: true, token: signToken(user.id), user: publicUser(user) })
    }

    // 3) New Google identity — DO NOT create the account yet.
    //    Mint a 10-minute pending token; the client must complete phone OTP
    //    before /api/auth/otp/verify creates the User row.
    const name = (info.name || (email ? email.split('@')[0] : 'CALL user')).slice(0, 40)
    const avatarUrl = info.picture || null
    const googlePendingToken = signGooglePendingToken({
      googleId: info.sub,
      email: email || '',
      name,
      emailVerified,
      avatarUrl,
    })
    return NextResponse.json({
      ok: true,
      googlePending: true,
      googlePendingToken,
      googleInfo: { name, email: email || '', avatarUrl },
    })
  } catch {
    return NextResponse.json({ error: 'Google sign-in failed' }, { status: 500 })
  }
}
