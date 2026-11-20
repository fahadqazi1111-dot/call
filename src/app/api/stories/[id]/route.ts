import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/callapp/server'

/** DELETE: delete my own story (admin can delete any). */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params
  const story = await db.story.findUnique({ where: { id } })
  if (!story) return NextResponse.json({ ok: true })
  if (story.userId !== me.id && me.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  await db.story.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
