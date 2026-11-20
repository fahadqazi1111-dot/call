import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, requireStaff } from '@/lib/callapp/server'

/**
 * GET ?view=campaigns|packages — admin advertising management.
 *   campaigns: house ads (ownerId null) AND user-created campaigns with owner
 *              info, payment state, impressions/clicks — approval workflow
 *   packages:  advertising packages (price / duration / placements / min budget)
 */
export async function GET(req: Request) {
  const admin = await requireStaff(req)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const view = new URL(req.url).searchParams.get('view') || 'campaigns'

  if (view === 'packages') {
    const packages = await db.adPackage.findMany({ orderBy: { order: 'asc' } })
    return NextResponse.json({ packages })
  }

  const ads = await db.ad.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      owner: { select: { id: true, name: true, username: true, email: true } },
      pkg: { select: { id: true, name: true, durationDays: true, priceUsd: true } },
    },
  })
  return NextResponse.json({
    ads: ads.map((a) => ({
      id: a.id,
      title: a.title,
      body: a.body,
      imageUrl: a.imageUrl,
      mediaKind: a.mediaKind,
      linkUrl: a.linkUrl,
      placements: a.placements,
      status: a.status,
      isUserAd: a.isUserAd,
      owner: a.owner,
      pkg: a.pkg,
      budget: a.budget,
      totalCost: a.totalCost,
      paymentId: a.paymentId,
      rejectionReason: a.rejectionReason,
      impressions: a.impressions,
      clicks: a.clicks,
      startsAt: a.startsAt ? a.startsAt.toISOString() : null,
      endsAt: a.endsAt ? a.endsAt.toISOString() : null,
      createdAt: a.createdAt.toISOString(),
    })),
  })
}

/** POST: create a house ad (admin-run promotion, ownerId null). */
export async function POST(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  try {
    const body = await req.json()
    const placements = Array.isArray(body.placements) ? body.placements.join(',') : String(body.placements || 'chats')
    const ad = await db.ad.create({
      data: {
        title: String(body.title || '').slice(0, 60),
        body: String(body.body || '').slice(0, 200),
        imageUrl: body.imageUrl ? String(body.imageUrl).slice(0, 300) : null,
        linkUrl: body.linkUrl ? String(body.linkUrl).slice(0, 300) : null,
        placements,
        weight: Math.max(1, Math.floor(Number(body.weight) || 1)),
        status: body.active === false ? 'paused' : 'active',
        isUserAd: false,
        startsAt: body.active === false ? null : new Date(),
      },
    })
    return NextResponse.json({ ok: true, ad })
  } catch {
    return NextResponse.json({ error: 'Create failed' }, { status: 500 })
  }
}

/**
 * PUT { id, ...patch } — update a house ad, OR
 * POST-like campaign actions via { id, action }:
 *   approve | reject | activate | pause | complete
 */
export async function PUT(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  try {
    const body = await req.json()
    const id = String(body.id || '')
    const ad = await db.ad.findUnique({ where: { id } })
    if (!ad) return NextResponse.json({ error: 'Ad not found' }, { status: 404 })

    // ---- campaign moderation actions (user-created ads) ----
    const action = String(body.action || '')
    if (action) {
      const now = new Date()
      if (action === 'approve' && ad.isUserAd) {
        if (!['pending_approval', 'approved', 'payment_completed'].includes(ad.status)) {
          return NextResponse.json({ error: `Cannot approve from status ${ad.status}` }, { status: 400 })
        }
        const pkg = ad.packageId ? await db.adPackage.findUnique({ where: { id: ad.packageId } }) : null
        const days = pkg?.durationDays ?? 7
        const endsAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)
        await db.ad.update({
          where: { id },
          data: { status: 'active', startsAt: now, endsAt, reviewedBy: admin.id, reviewedAt: now, rejectionReason: null },
        })
        if (ad.ownerId) {
          await db.notification.create({
            data: { userId: ad.ownerId, kind: 'ad', title: 'Ad campaign approved', body: `"${ad.title}" is now live.`, refType: 'ad', refId: ad.id },
          })
        }
        return NextResponse.json({ ok: true, status: 'active' })
      }
      if (action === 'reject' && ad.isUserAd) {
        const reason = String(body.reason || 'Does not meet content guidelines').slice(0, 200)
        await db.ad.update({
          where: { id },
          data: { status: 'rejected', reviewedBy: admin.id, reviewedAt: now, rejectionReason: reason },
        })
        if (ad.ownerId) {
          await db.notification.create({
            data: { userId: ad.ownerId, kind: 'ad', title: 'Ad campaign rejected', body: `"${ad.title}": ${reason}`, refType: 'ad', refId: ad.id },
          })
        }
        return NextResponse.json({ ok: true, status: 'rejected' })
      }
      if (action === 'activate' && ['paused', 'approved'].includes(ad.status)) {
        await db.ad.update({ where: { id }, data: { status: 'active', startsAt: ad.startsAt ?? now } })
        return NextResponse.json({ ok: true, status: 'active' })
      }
      if (action === 'pause' && ad.status === 'active') {
        await db.ad.update({ where: { id }, data: { status: 'paused' } })
        return NextResponse.json({ ok: true, status: 'paused' })
      }
      if (action === 'complete' && ['active', 'paused'].includes(ad.status)) {
        await db.ad.update({ where: { id }, data: { status: 'completed', endsAt: now } })
        return NextResponse.json({ ok: true, status: 'completed' })
      }
      return NextResponse.json({ error: 'Unknown or invalid action' }, { status: 400 })
    }

    // ---- house ad edits ----
    const data: Record<string, unknown> = {}
    if (body.title !== undefined) data.title = String(body.title).slice(0, 60)
    if (body.body !== undefined) data.body = String(body.body).slice(0, 200)
    if (body.imageUrl !== undefined) data.imageUrl = body.imageUrl ? String(body.imageUrl).slice(0, 300) : null
    if (body.linkUrl !== undefined) data.linkUrl = body.linkUrl ? String(body.linkUrl).slice(0, 300) : null
    if (body.weight !== undefined) data.weight = Math.max(1, Math.floor(Number(body.weight)))
    if (body.placements !== undefined) {
      data.placements = Array.isArray(body.placements) ? body.placements.join(',') : String(body.placements)
    }
    const updated = await db.ad.update({ where: { id }, data })
    return NextResponse.json({ ok: true, ad: updated })
  } catch {
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
}

/** DELETE ?id= — remove an ad / reject+delete a user campaign. */
export async function DELETE(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const id = new URL(req.url).searchParams.get('id') || ''
  try {
    await db.ad.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }
}
