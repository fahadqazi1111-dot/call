import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, normalizePhone, normalizeUsername, matchRegisteredUsers } from '@/lib/callapp/server'

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

/**
 * POST: add a contact.
 * Body (any one of):
 *   - { username }    add a registered CALL user by @username
 *   - { userId }      add a registered CALL user by id
 *   - { name, phone } add a manual entry (existing flow)
 *   - { phone }       add with the matched user's name (or fallback to the number)
 *
 * For username / userId, the contact row uses the *found user's* name and phone
 * so they appear in the contact book exactly as a synced device contact would.
 * The unique (ownerId, phone) constraint prevents duplicates — upserting is safe.
 *
 * Returns { ok: true, contact: {...} } on success.
 */
export async function POST(req: Request) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = (await req.json().catch(() => ({}))) as {
      username?: string
      userId?: string
      name?: string
      phone?: string
    }

    let name: string | undefined = body.name
    let phoneRaw: string | undefined = body.phone

    // Username-based lookup → resolve to that user's name + phone.
    if (body.username) {
      const uname = normalizeUsername(body.username)
      if (uname.length < 3) {
        return NextResponse.json({ error: 'Username is too short' }, { status: 400 })
      }
      const u = await db.user.findUnique({
        where: { username: uname },
        select: { id: true, name: true, phone: true, blocked: true },
      })
      if (!u || u.blocked || u.id === me.id) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }
      name = u.name
      phoneRaw = u.phone
    } else if (body.userId) {
      const u = await db.user.findUnique({
        where: { id: body.userId },
        select: { id: true, name: true, phone: true, blocked: true },
      })
      if (!u || u.blocked || u.id === me.id) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }
      name = u.name
      phoneRaw = u.phone
    }

    const phone = normalizePhone(phoneRaw || '')
    if (!phone) {
      return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 })
    }
    const finalName = String(name || '').trim().slice(0, 40) || phone

    const contact = await db.contact.upsert({
      where: { ownerId_phone: { ownerId: me.id, phone } },
      update: { name: finalName },
      create: { ownerId: me.id, phone, name: finalName },
    })

    const u = (await matchRegisteredUsers([phone], me.id, me.phone)).get(phone)
    return NextResponse.json({
      ok: true,
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

/**
 * DELETE: remove a contact by id.
 * Query form (?id=) — kept for backward compatibility with the old client.
 * Ownership is verified (ownerId === me.id) so no one can delete someone else's
 * contact rows. The dedicated `/api/contacts/[id]` route does the same.
 */
export async function DELETE(req: Request) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  await db.contact.deleteMany({ where: { id, ownerId: me.id } })
  return NextResponse.json({ ok: true })
}
