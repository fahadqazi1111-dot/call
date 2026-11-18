import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { signToken, verifyPassword, rateLimit, ensureWallet, publicUser } from '@/lib/callapp/server'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** POST: login with email + password. */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const email = String(body.email || '').trim().toLowerCase()
    const password = String(body.password || '')
    if (!EMAIL_RE.test(email)) return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
    if (!rateLimit(`pwlogin:${email}`, 8, 60_000)) {
      return NextResponse.json({ error: 'Too many attempts. Try again in a minute.' }, { status: 429 })
    }
    const user = await db.user.findUnique({ where: { email } })
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: 'Email or password is incorrect' }, { status: 401 })
    }
    if (user.blocked) return NextResponse.json({ error: 'This account is blocked' }, { status: 403 })
    await db.user.update({ where: { id: user.id }, data: { lastSeen: new Date() } })
    await ensureWallet(user.id)
    return NextResponse.json({ ok: true, token: signToken(user.id), user: publicUser(user) })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
