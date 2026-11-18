import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  requireUser,
  publicUser,
  ensureWallet,
  normalizeUsername,
  usernameError,
  nextUsernameChangeAt,
} from '@/lib/callapp/server'

export async function GET(req: Request) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const wallet = await ensureWallet(me.id)
  return NextResponse.json({
    user: publicUser(me),
    wallet: { coins: wallet.coins, earnings: wallet.earnings },
  })
}

export async function PUT(req: Request) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await req.json()
    const data: { name?: string; about?: string; avatarKey?: number; avatarUrl?: string | null; username?: string; usernameChangedAt?: Date } = {}
    if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim().slice(0, 40)
    if (typeof body.about === 'string') data.about = body.about.slice(0, 120)
    if (typeof body.avatarKey === 'number') data.avatarKey = Math.abs(body.avatarKey) % 8
    if (body.avatarUrl === null) data.avatarUrl = null
    if (typeof body.avatarUrl === 'string' && /^\/api\/media\/[a-f0-9]{32}$/.test(body.avatarUrl)) {
      data.avatarUrl = body.avatarUrl
    }

    /* ---------- username change (1-week cooldown rule) ----------
     * Every user has one globally unique @username.
     * - It cannot be changed for the FIRST week after signup.
     * - After that it can be changed once, then the user must wait
     *   another full week before the next change, and so on. */
    if (typeof body.username === 'string' && body.username.trim()) {
      const next = normalizeUsername(body.username)
      if (next !== me.username) {
        const nextChangeAt = nextUsernameChangeAt(me)
        if (Date.now() < nextChangeAt) {
          return NextResponse.json(
            {
              error: `You can change your username on ${new Date(nextChangeAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`,
              nextChangeAt: new Date(nextChangeAt).toISOString(),
            },
            { status: 403 }
          )
        }
        const unameErr = usernameError(next)
        if (unameErr) return NextResponse.json({ error: unameErr }, { status: 400 })
        const taken = await db.user.findUnique({ where: { username: next }, select: { id: true } })
        if (taken && taken.id !== me.id) {
          return NextResponse.json({ error: `@${next} is already taken — try another` }, { status: 400 })
        }
        data.username = next
        data.usernameChangedAt = new Date()
      }
    }

    const user = await db.user.update({ where: { id: me.id }, data })
    return NextResponse.json({ user: publicUser(user) })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
