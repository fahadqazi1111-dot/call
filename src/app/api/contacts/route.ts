import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, normalizePhone, matchRegisteredUsers } from '@/lib/callapp/server'

/** GET: list my contacts, each with the matched registered CALL user (if any). */
export async function GET(req: Request) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const contacts = await db.contact.findMany({
    where: { ownerId: me.id },
    orderBy: [{ name: 'asc' }],
  })
  // Smart matching: exact digits, national format (0-prefix), my country code, and subscriber-suffix.
  const matched = await matchRegisteredUsers(
    contacts.map((c) => c.phone),
    me.id,
    me.phone
  )
  const list = contacts.map((c) => {
    const u = matched.get(c.phone)
    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      user: u && u.id !== me.id
        ? {
            id: u.id,
            name: u.name,
            about: u.about,
            avatarKey: u.avatarKey,
            avatarUrl: u.avatarUrl,
            lastSeen: u.lastSeen.toISOString(),
            role: u.role,
            isOfficial: u.isOfficial,
          }
        : null,
    }
  })
  return NextResponse.json({ contacts: list })
}

/** POST: add a contact manually { name, phone }. */
export async function POST(req: Request) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { name, phone } = await req.json()
    const normalized = normalizePhone(phone || '')
    if (!normalized) return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 })
    const contact = await db.contact.upsert({
      where: { ownerId_phone: { ownerId: me.id, phone: normalized } },
      update: { name: String(name || '').trim().slice(0, 40) || normalized },
      create: {
        ownerId: me.id,
        phone: normalized,
        name: String(name || '').trim().slice(0, 40) || normalized,
      },
    })
    const u = (await matchRegisteredUsers([normalized], me.id, me.phone)).get(normalized)
    return NextResponse.json({
      contact: {
        id: contact.id,
        name: contact.name,
        phone: contact.phone,
        user: u && u.id !== me.id
          ? {
              id: u.id,
              name: u.name,
              about: u.about,
              avatarKey: u.avatarKey,
              avatarUrl: u.avatarUrl,
              lastSeen: u.lastSeen.toISOString(),
              role: u.role,
              isOfficial: u.isOfficial,
            }
          : null,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

/** DELETE: remove contact ?id= */
export async function DELETE(req: Request) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  await db.contact.deleteMany({ where: { id, ownerId: me.id } })
  return NextResponse.json({ ok: true })
}
