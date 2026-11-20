import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, rateLimit } from '@/lib/callapp/server'

function dayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10)
}

/**
 * POST /api/ads/[id]/[action] — impression / click tracking with DEDUP:
 *  - every event is recorded as an AdEvent row keyed by (ad, kind, viewer, day);
 *    duplicates from the same viewer on the same day are rejected by the DB
 *    unique index, and the public counter only moves on genuinely new events
 *  - rate limited per viewer to blunt trivial inflation
 * The viewer is identified by the auth token when present, otherwise by an
 * anonymous device key passed from the client.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string; action: string }> }) {
  const { id, action } = await ctx.params
  if (action !== 'impression' && action !== 'click') {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }
  let viewerKey = ''
  const me = await requireUser(req)
  if (me) {
    viewerKey = `u:${me.id}`
  } else {
    try {
      const body = await req.json()
      viewerKey = `d:${String(body?.viewerKey || '').slice(0, 60)}`
    } catch {
      viewerKey = ''
    }
  }
  if (!viewerKey) return NextResponse.json({ ok: true, counted: false })
  if (!rateLimit(`adevent:${viewerKey}:${id}`, 40, 60_000)) {
    return NextResponse.json({ ok: true, counted: false })
  }

  try {
    const ad = await db.ad.findUnique({ where: { id }, select: { id: true, status: true } })
    if (!ad) return NextResponse.json({ ok: false }, { status: 404 })
    // only count events for ads that are actually running
    if (ad.status !== 'active') return NextResponse.json({ ok: true, counted: false })

    const created = await db.adEvent
      .create({
        data: { adId: id, kind: action, viewerKey, dayKey: dayKey() },
      })
      .catch(() => null)

    if (!created) {
      // duplicate (same viewer, same ad, same day) — do not inflate counters
      return NextResponse.json({ ok: true, counted: false })
    }
    await db.ad.update({
      where: { id },
      data: action === 'impression' ? { impressions: { increment: 1 } } : { clicks: { increment: 1 } },
    })
    return NextResponse.json({ ok: true, counted: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
