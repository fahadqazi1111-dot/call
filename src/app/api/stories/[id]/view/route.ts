import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, canViewStory } from '@/lib/callapp/server'

/** POST: record a story view (viewer-scoped, unique). CONTACTS-ONLY gate. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params
  const story = await db.story.findUnique({ where: { id } })
  if (!story) return NextResponse.json({ error: 'Story not found' }, { status: 404 })
  if (story.userId === me.id) return NextResponse.json({ ok: true, self: true })
  if (!(await canViewStory(me, story.userId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  await db.storyView.upsert({
    where: { storyId_viewerId: { storyId: id, viewerId: me.id } },
    update: {},
    create: { storyId: id, viewerId: me.id },
  })
  return NextResponse.json({ ok: true })
}
