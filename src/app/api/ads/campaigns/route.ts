import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, rateLimit } from '@/lib/callapp/server'
import { createCheckout, safeJson } from '@/lib/callapp/payments'
import { providerFeeFor } from '@/lib/callapp/server'

/**
 * GET — my advertising campaigns (dashboard: status, stats, payments).
 * POST — create a campaign: draft → checkout (Payment purpose ad_campaign).
 *        Unpaid campaigns are NEVER served or activated.
 */
export async function GET(req: Request) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const campaigns = await db.ad.findMany({
    where: { ownerId: me.id, isUserAd: true },
    orderBy: { createdAt: 'desc' },
    include: { pkg: { select: { name: true, durationDays: true, priceUsd: true } } },
  })
  const payments = await db.payment.findMany({
    where: { userId: me.id, purpose: 'ad_campaign' },
    orderBy: { createdAt: 'desc' },
    take: 30,
  })
  return NextResponse.json({
    campaigns: campaigns.map((c) => ({
      id: c.id,
      title: c.title,
      body: c.body,
      imageUrl: c.imageUrl,
      mediaKind: c.mediaKind,
      linkUrl: c.linkUrl,
      placements: c.placements.split(',').filter(Boolean),
      pkg: c.pkg,
      budget: c.budget,
      totalCost: c.totalCost,
      status: c.status,
      rejectionReason: c.rejectionReason,
      impressions: c.impressions,
      clicks: c.clicks,
      startsAt: c.startsAt ? c.startsAt.toISOString() : null,
      endsAt: c.endsAt ? c.endsAt.toISOString() : null,
      createdAt: c.createdAt.toISOString(),
    })),
    payments: payments.map((p) => ({
      id: p.id,
      status: p.status,
      amount: p.amount,
      isTest: p.isTest,
      meta: safeJson(p.meta),
      createdAt: p.createdAt.toISOString(),
    })),
  })
}

interface CreateBody {
  title: string
  body?: string
  imageUrl?: string
  mediaKind?: 'image' | 'video'
  linkUrl?: string
  placements?: string[]
  packageId: string
  budget?: number
  clientKey?: string
}

export async function POST(req: Request) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!rateLimit(`adcreate:${me.id}`, 8, 60_000)) {
    return NextResponse.json({ error: 'Too many attempts' }, { status: 429 })
  }
  try {
    const body = (await req.json()) as CreateBody
    const title = String(body.title || '').trim().slice(0, 60)
    if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    const pkg = await db.adPackage.findUnique({ where: { id: String(body.packageId || '') } })
    if (!pkg || !pkg.active) return NextResponse.json({ error: 'Package unavailable' }, { status: 400 })

    const placements = Array.isArray(body.placements) && body.placements.length
      ? body.placements.filter((p) => pkg.placements.includes(p)).join(',')
      : pkg.placements
    if (!placements) return NextResponse.json({ error: 'No valid placement selected' }, { status: 400 })

    const budget = Math.max(pkg.minBudget, Math.round((Number(body.budget) || 0) * 100) / 100)
    const totalCost = pkg.priceUsd

    // idempotency: retried submissions reuse the same campaign + payment
    const clientKey = String(body.clientKey || '').slice(0, 80) || null
    if (clientKey) {
      const existing = await db.payment.findUnique({ where: { clientKey } })
      if (existing?.status === 'pending') {
        const info = await createCheckout(existing)
        return NextResponse.json({ ok: true, paymentId: existing.id, amount: existing.amount, ...info })
      }
    }

    const campaign = await db.ad.create({
      data: {
        ownerId: me.id,
        title,
        body: String(body.body || '').slice(0, 200),
        imageUrl: body.imageUrl ? String(body.imageUrl).slice(0, 300) : null,
        mediaKind: body.mediaKind === 'video' ? 'video' : 'image',
        linkUrl: body.linkUrl ? String(body.linkUrl).slice(0, 300) : null,
        placements,
        packageId: pkg.id,
        budget,
        totalCost,
        status: 'pending_payment',
        isUserAd: true,
      },
    })

    const fee = await providerFeeFor(totalCost)
    const payment = await db.payment.create({
      data: {
        userId: me.id,
        provider: 'pending',
        purpose: 'ad_campaign',
        status: 'pending',
        amount: totalCost,
        currency: 'USD',
        feeAmount: fee,
        meta: JSON.stringify({ campaignId: campaign.id, campaignTitle: title }),
        clientKey,
      },
    })
    const info = await createCheckout(payment)
    await db.payment.update({ where: { id: payment.id }, data: { provider: info.provider, isTest: info.isTest } })

    return NextResponse.json({
      ok: true,
      campaign: { id: campaign.id, title: campaign.title, totalCost },
      paymentId: payment.id,
      amount: totalCost,
      ...info,
    })
  } catch {
    return NextResponse.json({ error: 'Campaign creation failed' }, { status: 500 })
  }
}
