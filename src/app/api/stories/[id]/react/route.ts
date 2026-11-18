import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, canViewStory } from '@/lib/callapp/server'

/** POST { emoji } — react to a story (one reaction per user, upsert). CONTACTS-ONLY gate. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params
  try {
    const body = await req.json()
    const emoji = String(body.emoji || '').slice(0, 8)
    if (!emoji) return NextResponse.json({ error: 'emoji required' }, { status: 400 })
    const story = await db.story.findUnique({ where: { id } })
    if (!story) return NextResponse.json({ error: 'Story not found' }, { status: 404 })
    if (story.userId === me.id) return NextResponse.json({ ok: true, self: true })
    if (!(await canViewStory(me, story.userId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    await db.storyReaction.upsert({
      where: { storyId_userId: { storyId: id, userId: me.id } },
      update: { emoji },
      create: { storyId: id, userId: me.id, emoji },
    })
    await db.notification.create({
      data: {
        userId: story.userId,
        kind: 'story_reaction',
        title: `${me.name} reacted ${emoji} to your story`,
        refType: 'story',
        refId: id,
      },
    })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Reaction failed' }, { status: 500 })
  }
}
