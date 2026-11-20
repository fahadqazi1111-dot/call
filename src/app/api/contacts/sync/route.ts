import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, normalizePhone, matchRegisteredUsers } from '@/lib/callapp/server'

/**
 * Sync device contacts (Contact Picker API results or a pasted list).
 * Body: { contacts: [{ name, phone }] }
 * Saves them to my contact book and returns how many are registered on CALL.
 */
export async function POST(req: Request) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { contacts } = await req.json()
    if (!Array.isArray(contacts)) {
      return NextResponse.json({ error: 'contacts[] required' }, { status: 400 })
    }
    const seen = new Set<string>()
    const rows: { name: string; phone: string }[] = []
    for (const c of contacts) {
      const phone = normalizePhone(String(c?.phone ?? ''))
      if (!phone || seen.has(phone)) continue
      seen.add(phone)
      const name = String(c?.name ?? '').trim().slice(0, 40) || phone
      rows.push({ name, phone })
    }
    for (const r of rows) {
      await db.contact.upsert({
        where: { ownerId_phone: { ownerId: me.id, phone: r.phone } },
        update: { name: r.name },
        create: { ownerId: me.id, phone: r.phone, name: r.name },
      })
    }
    // Smart matching: exact digits, national format (0-prefix), my country code, and subscriber-suffix.
    const matched = await matchRegisteredUsers(
      rows.map((r) => r.phone),
      me.id,
      me.phone
    )
    return NextResponse.json({
      ok: true,
      saved: rows.length,
      matched: matched.size,
    })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
