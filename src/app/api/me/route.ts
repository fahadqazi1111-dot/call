import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, publicUser } from '@/lib/callapp/server'

export async function GET(req: Request) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({ user: publicUser(me) })
}

export async function PUT(req: Request) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await req.json()
    const data: { name?: string; about?: string; avatarKey?: number; avatarUrl?: string | null } = {}
    if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim().slice(0, 40)
    if (typeof body.about === 'string') data.about = body.about.slice(0, 120)
    if (typeof body.avatarKey === 'number') data.avatarKey = Math.abs(body.avatarKey) % 8
    if (body.avatarUrl === null) data.avatarUrl = null
    if (typeof body.avatarUrl === 'string' && /^\/api\/media\/[a-f0-9]{32}$/.test(body.avatarUrl)) {
      data.avatarUrl = body.avatarUrl
    }
    const user = await db.user.update({ where: { id: me.id }, data })
    return NextResponse.json({ user: publicUser(user) })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
