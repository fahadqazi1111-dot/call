import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  signToken,
  getSetting,
  ensureWallet,
  publicUser,
  rateLimit,
  generateUniqueUsername,
} from '@/lib/callapp/server'

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
 * The token is verified server-side against Google's free tokeninfo endpoint.
 * The expected client ID (audience) comes from the admin setting auth.googleClientId;
 * without it configured, Google sign-in is disabled and the endpoint says so.
 * On success we link Google identity to an existing matching email account or
 * create a new one — never a duplicate for the same person.
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

    // 1) match by googleId, 2) by verified email, 3) create new account.
    let user = await db.user.findUnique({ where: { googleId: info.sub } })
    if (!user && email) user = await db.user.findUnique({ where: { email } })
    if (!user) {
      let phone = `0${String(Math.floor(100000000 + Math.random() * 899999999))}`
      while (await db.user.findUnique({ where: { phone } })) {
        phone = `0${String(Math.floor(100000000 + Math.random() * 899999999))}`
      }
      // Google signups get an auto-generated unique username from their Google name.
      const username = await generateUniqueUsername(info.name || email?.split('@')[0] || 'user')
      user = await db.user.create({
        data: {
          googleId: info.sub,
          email,
          emailVerified: email ? info.email_verified === 'true' || info.email_verified === true : false,
          name: (info.name || 'CALL user').slice(0, 40),
          username,
          phone,
          avatarKey: Math.floor(Math.random() * 8),
        },
      })
    } else if (!user.googleId) {
      user = await db.user.update({ where: { id: user.id }, data: { googleId: info.sub } })
    }
    if (user.blocked) return NextResponse.json({ error: 'This account is blocked' }, { status: 403 })
    await db.user.update({ where: { id: user.id }, data: { lastSeen: new Date() } })
    await ensureWallet(user.id)
    return NextResponse.json({ ok: true, token: signToken(user.id), user: publicUser(user) })
  } catch {
    return NextResponse.json({ error: 'Google sign-in failed' }, { status: 500 })
  }
}
