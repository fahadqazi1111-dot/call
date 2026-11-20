import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, mediaUrl, rateLimit, canViewStory } from '@/lib/callapp/server'

const STORY_TTL_MS = 24 * 60 * 60 * 1000

/** GET: story feed — grouped by author, with signed media URLs + seen state. */
export async function GET(req: Request) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const now = new Date()

  // lazy cleanup of expired stories (cheap, indexed)
  await db.story.deleteMany({ where: { expiresAt: { lt: now } } })

  // CONTACTS-ONLY feed: only my own stories + stories from authors I actually
  // saved as contacts are ever returned. privacy stays as a per-story setting
  // ('contacts' default) — but the contact relationship is the hard floor.
  const stories = await db.story.findMany({
    where: { expiresAt: { gt: now } },
    orderBy: { createdAt: 'asc' },
    include: { _count: { select: { views: true } } },
  })

  const views = await db.storyView.findMany({ where: { viewerId: me.id }, select: { storyId: true } })
  const seen = new Set(views.map((v) => v.storyId))

  // contacts-only filter (server-side — cannot be bypassed by API calls)
  const allowed: typeof stories = []
  for (const s of stories) {
    if (s.userId === me.id) {
      allowed.push(s)
      continue
    }
    if (await canViewStory(me, s.userId)) allowed.push(s)
  }

  interface AuthorGroup {
    userId: string
    name: string
    avatarKey: number
    avatarUrl: string | null
    mine: boolean
    allSeen: boolean
    stories: Array<{
      id: string
      kind: string
      mediaUrl: string | null
      text: string | null
      overlayJson: string | null
      bgColor: string
      durationMs: number
      createdAt: string
      clipIndex: number
      groupId: string
      seen: boolean
      viewCount: number
      mine: boolean
    }>
  }

  const groups = new Map<string, AuthorGroup>()
  for (const s of allowed) {
    let g = groups.get(s.userId)
    if (!g) {
      const author =
        s.userId === me.id
          ? { id: me.id, name: me.name, avatarKey: me.avatarKey, avatarUrl: me.avatarUrl }
          : await db.user.findUnique({
              where: { id: s.userId },
              select: { id: true, name: true, avatarKey: true, avatarUrl: true },
            })
      if (!author) continue
      g = {
        userId: s.userId,
        name: author.name,
        avatarKey: author.avatarKey,
        avatarUrl: author.avatarUrl,
        mine: s.userId === me.id,
        allSeen: true,
        stories: [],
      }
      groups.set(s.userId, g)
    }
    const storySeen = seen.has(s.id)
    if (!storySeen && s.userId !== me.id) g.allSeen = false
    g.stories.push({
      id: s.id,
      kind: s.kind,
      mediaUrl: mediaUrl(s.mediaId, me.id),
      text: s.text,
      overlayJson: s.overlayJson,
      bgColor: s.bgColor,
      durationMs: s.kind === 'text' ? Math.max(4000, Math.min(12000, (s.text?.length ?? 20) * 220)) : s.durationMs,
      createdAt: s.createdAt.toISOString(),
      clipIndex: s.clipIndex,
      groupId: s.groupId,
      seen: storySeen,
      viewCount: s._count.views,
      mine: s.userId === me.id,
    })
  }

  const list = Array.from(groups.values()).sort((a, b) => {
    if (a.mine !== b.mine) return a.mine ? -1 : 1
    if (a.allSeen !== b.allSeen) return a.allSeen ? 1 : -1
    const aT = a.stories[0]?.createdAt ?? ''
    const bT = b.stories[0]?.createdAt ?? ''
    return bT.localeCompare(aT)
  })

  return NextResponse.json({ groups: list })
}

interface CreateClip {
  kind: 'photo' | 'video' | 'text' | 'voice'
  mediaId?: string
  text?: string
  overlayJson?: string
  bgColor?: string
  durationMs?: number
}

/** POST: publish a story (one group = ordered clips). */
export async function POST(req: Request) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!rateLimit(`story:${me.id}`, 10, 60_000)) {
    return NextResponse.json({ error: 'Publishing too fast' }, { status: 429 })
  }
  try {
    const body = await req.json()
    const clips: CreateClip[] = Array.isArray(body.clips) ? body.clips.slice(0, 10) : []
    if (clips.length === 0) return NextResponse.json({ error: 'At least one clip required' }, { status: 400 })
    const privacy = body.privacy === 'contacts' ? 'contacts' : 'all'
    const groupId = `sg${Date.now()}${Math.random().toString(36).slice(2, 8)}`
    const expiresAt = new Date(Date.now() + STORY_TTL_MS)

    let index = 0
    for (const c of clips) {
      if (!['photo', 'video', 'text', 'voice'].includes(c.kind)) continue
      if ((c.kind === 'photo' || c.kind === 'video' || c.kind === 'voice') && !/^[a-f0-9]{32}$/.test(c.mediaId || '')) {
        continue
      }
      if (c.kind === 'text' && !String(c.text || '').trim()) continue
      await db.story.create({
        data: {
          userId: me.id,
          groupId,
          clipIndex: index++,
          kind: c.kind,
          mediaId: c.mediaId ?? null,
          text: c.text ? String(c.text).slice(0, 500) : null,
          overlayJson: c.overlayJson ? String(c.overlayJson).slice(0, 4000) : null,
          bgColor: /^#[0-9a-fA-F]{6}$/.test(c.bgColor || '') ? c.bgColor! : '#2F5BE0',
          durationMs: Math.min(180_000, Math.max(3000, Number(c.durationMs) || 5000)),
          privacy,
          expiresAt,
        },
      })
    }
    if (index === 0) return NextResponse.json({ error: 'No valid clips' }, { status: 400 })
    return NextResponse.json({ ok: true, groupId, clips: index })
  } catch {
    return NextResponse.json({ error: 'Publish failed' }, { status: 500 })
  }
}
