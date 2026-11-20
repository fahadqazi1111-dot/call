import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/callapp/server'

/**
 * DELETE /api/contacts/[id]
 * Removes a contact by id. Ownership is verified via `ownerId === me.id` in the
 * deleteMany filter, so even a forged id cannot affect another user's contact
 * book. Returns { ok: true } regardless of whether a row was deleted.
 */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await requireUser(_req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  await db.contact.deleteMany({ where: { id, ownerId: me.id } })
  return NextResponse.json({ ok: true })
}
