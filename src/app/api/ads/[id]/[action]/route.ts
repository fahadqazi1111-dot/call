import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

/** POST /api/ads/[id]/[action] — impression / click tracking (no auth needed, counted only). */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string; action: string }> }) {
  const { id, action } = await ctx.params
  if (action !== 'impression' && action !== 'click') {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }
  try {
    await db.ad.update({
      where: { id },
      data: action === 'impression' ? { impressions: { increment: 1 } } : { clicks: { increment: 1 } },
    })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 404 })
  }
}
