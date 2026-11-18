import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  signToken,
  hashPassword,
  rateLimit,
  ensureWallet,
  normalizeUsername,
  usernameError,
} from '@/lib/callapp/server'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** POST: register with email + password + a unique username of the user's choice. */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const email = String(body.email || '').trim().toLowerCase()
    const name = String(body.name || '').trim().slice(0, 40)
    const password = String(body.password || '')
    const username = normalizeUsername(body.username || '')
    if (!EMAIL_RE.test(email)) return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }
    const unameErr = usernameError(username)
    if (unameErr) return NextResponse.json({ error: unameErr }, { status: 400 })
    if (!rateLimit(`pwreg:${email}`, 5, 60_000)) {
      return NextResponse.json({ error: 'Too many attempts. Try again shortly.' }, { status: 429 })
    }
    const existing = await db.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 400 })
    }
    const usernameTaken = await db.user.findUnique({ where: { username } })
    if (usernameTaken) {
      return NextResponse.json({ error: `@${username} is already taken — try another` }, { status: 400 })
    }
    // Phone stays unique — create a placeholder phone derived from the email
    // (users can later link their real number via phone OTP; matching uses suffix).
    let phone = `0${String(Math.floor(100000000 + Math.random() * 899999999))}`
    while (await db.user.findUnique({ where: { phone } })) {
      phone = `0${String(Math.floor(100000000 + Math.random() * 899999999))}`
    }
    const user = await db.user.create({
      data: {
        email,
        name,
        phone,
        username,
        passwordHash: hashPassword(password),
        emailVerified: false,
        avatarKey: Math.floor(Math.random() * 8),
      },
    })
    await ensureWallet(user.id)
    return NextResponse.json({ ok: true, token: signToken(user.id), needEmailVerification: true })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
