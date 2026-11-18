import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, hashPassword, generateUniqueUsername, rateLimit } from '@/lib/callapp/server'
import { listSenderOptions } from '@/lib/callapp/official'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/**
 * Staff team management — full admins only (team members cannot manage the
 * team). Team members get the yellow tick, admins the blue tick.
 */

/** GET — staff list + sender options (official account first). */
export async function GET(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const staff = await db.user.findMany({
    where: { role: { in: ['admin', 'team'] } },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      phone: true,
      role: true,
      blocked: true,
      avatarKey: true,
      avatarUrl: true,
      createdAt: true,
      lastSeen: true,
    },
  })
  const senders = await listSenderOptions()
  return NextResponse.json({ staff, senders })
}

/** POST { name, email, password, role: 'admin'|'team' } — create a staff account. */
export async function POST(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!rateLimit(`teamcreate:${admin.id}`, 10, 60_000)) {
    return NextResponse.json({ error: 'Too many attempts. Try again shortly.' }, { status: 429 })
  }
  try {
    const body = await req.json()
    const name = String(body.name || '').trim().slice(0, 40)
    const email = String(body.email || '').trim().toLowerCase()
    const password = String(body.password || '')
    const role = body.role === 'admin' ? 'admin' : 'team'
    if (name.length < 2) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    if (!EMAIL_RE.test(email)) return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }
    const existing = await db.user.findUnique({ where: { email } })
    if (existing) return NextResponse.json({ error: 'An account with this email already exists' }, { status: 400 })

    // Staff accounts use placeholder 000… numbers: they log in with email +
    // password only, and OTP requests for 0-sequences are rejected.
    let phone = `000000${String(Math.floor(100000 + Math.random() * 899999))}`
    while (await db.user.findUnique({ where: { phone } })) {
      phone = `000000${String(Math.floor(100000 + Math.random() * 899999))}`
    }
    const username = await generateUniqueUsername(name)
    const user = await db.user.create({
      data: {
        name,
        email,
        phone,
        username,
        passwordHash: hashPassword(password),
        role,
        emailVerified: true,
        avatarKey: Math.floor(Math.random() * 8),
      },
    })
    return NextResponse.json({
      ok: true,
      member: { id: user.id, name: user.name, email: user.email, role: user.role },
    })
  } catch {
    return NextResponse.json({ error: 'Could not create the team member' }, { status: 500 })
  }
}

/** PUT { id, role? | password? } — change a member's role or reset their password. */
export async function PUT(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  try {
    const body = await req.json()
    const id = String(body.id || '')
    if (!id) return NextResponse.json({ error: 'Missing member id' }, { status: 400 })
    const target = await db.user.findUnique({ where: { id } })
    if (!target) return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    if (target.isOfficial) {
      return NextResponse.json({ error: 'The official CALL account cannot be modified' }, { status: 400 })
    }
    if (target.id === admin.id) {
      return NextResponse.json({ error: 'You cannot change your own role or password here' }, { status: 400 })
    }

    if (body.password !== undefined) {
      const password = String(body.password || '')
      if (password.length < 8) {
        return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
      }
      await db.user.update({ where: { id }, data: { passwordHash: hashPassword(password) } })
    }
    if (body.role !== undefined) {
      const role = body.role === 'admin' ? 'admin' : body.role === 'team' ? 'team' : 'user'
      await db.user.update({ where: { id }, data: { role } })
    }
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
}

/** DELETE ?id= — remove a member from the team (becomes a normal user). */
export async function DELETE(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  const target = await db.user.findUnique({ where: { id } })
  if (!target) return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  if (target.isOfficial) {
    return NextResponse.json({ error: 'The official CALL account cannot be removed' }, { status: 400 })
  }
  if (target.id === admin.id) {
    return NextResponse.json({ error: 'You cannot remove yourself' }, { status: 400 })
  }
  await db.user.update({ where: { id }, data: { role: 'user' } })
  return NextResponse.json({ ok: true })
}
