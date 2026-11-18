import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/callapp/server'

/** GET: viewers of my story (owner only). */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params
  const story = await db.story.findUnique({ where: { id } })
  if (!story) return NextResponse.json({ error: 'Story not found' }, { status: 404 })
  if (story.userId !== me.id && me.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const views = await db.storyView.findMany({
    where: { storyId: id },
    orderBy: { createdAt: 'desc' },
    include: { viewer: { select: { id: true, name: true, avatarKey: true, avatarUrl: true } } },
  })
  return NextResponse.json({
    count: views.length,
    viewers: views.map((v) => ({
      id: v.viewer.id,
      name: v.viewer.name,
      avatarKey: v.viewer.avatarKey,
      avatarUrl: v.viewer.avatarUrl,
      at: v.createdAt.toISOString(),
    })),
  })
}
