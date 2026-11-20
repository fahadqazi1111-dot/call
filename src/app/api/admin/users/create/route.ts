import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  requireAdmin,
  hashPassword,
  generateUniqueUsername,
  ensureWallet,
  rateLimit,
  normalizePhone,
  normalizeUsername,
  usernameError,
} from '@/lib/callapp/server'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/**
 * POST { name, username?, phone, email?, password, role: 'user'|'team'|'admin' }
 * Manually create a user (regular or staff) from the admin panel. Admins can
 * provision accounts without going through OTP — useful for support, demos,
 * and staff sign-in by phone. Wallet is created automatically.
 */
export async function POST(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!rateLimit(`usercreate:${admin.id}`, 20, 60_000)) {
    return NextResponse.json({ error: 'Too many attempts. Try again shortly.' }, { status: 429 })
  }

  try {
    const body = await req.json()
    const name = String(body.name || '').trim().slice(0, 40)
    if (name.length < 2) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

    const rawPhone = String(body.phone || '').trim()
    const phone = normalizePhone(rawPhone)
    if (!phone) return NextResponse.json({ error: 'A valid phone number is required' }, { status: 400 })
    const existingPhone = await db.user.findUnique({ where: { phone } })
    if (existingPhone) return NextResponse.json({ error: 'A user with this phone already exists' }, { status: 400 })

    const email = body.email ? String(body.email).trim().toLowerCase() : null
    if (email && !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
    }
    if (email) {
      const existingEmail = await db.user.findUnique({ where: { email } })
      if (existingEmail) return NextResponse.json({ error: 'A user with this email already exists' }, { status: 400 })
    }

    const password = String(body.password || '')
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    // Username: validate the admin-provided one, otherwise generate from the name.
    let username: string
    if (body.username && String(body.username).trim()) {
      const normalized = normalizeUsername(String(body.username))
      const err = usernameError(normalized)
      if (err) return NextResponse.json({ error: err }, { status: 400 })
      const taken = await db.user.findUnique({ where: { username: normalized } })
      if (taken) return NextResponse.json({ error: 'This username is already taken' }, { status: 400 })
      username = normalized
    } else {
      username = await generateUniqueUsername(name)
    }

    const role = body.role === 'admin' ? 'admin' : body.role === 'team' ? 'team' : 'user'

    const user = await db.user.create({
      data: {
        name,
        email,
        phone,
        username,
        passwordHash: hashPassword(password),
        role,
        emailVerified: !!email,
        avatarKey: Math.floor(Math.random() * 8),
      },
    })

    // Provision an empty wallet so the user can receive gifts / earnings.
    await ensureWallet(user.id)

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        phone: user.phone,
        email: user.email,
        role: user.role,
      },
    })
  } catch (e) {
    console.error('[admin/users/create] failed', e)
    return NextResponse.json({ error: 'Could not create the user' }, { status: 500 })
  }
}
