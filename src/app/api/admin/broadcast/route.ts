import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, requireStaff } from '@/lib/callapp/server'
import { getOfficialUser, sendOfficialMessage } from '@/lib/callapp/official'
import { relayToUser } from '@/lib/callapp/relay'

/**
 * Admin broadcasts WITH DELIVERY RECORDS.
 *
 * POST { title, body, senderId? } — broadcast to EVERY eligible user:
 *   - each recipient gets a BroadcastDelivery row (sent | failed) — unique per
 *     (broadcast, user) so retries can never duplicate a delivery
 *   - online users additionally receive a realtime notification through the
 *     socket relay
 * GET              — broadcast history with delivery statistics
 * POST retry       — { action: 'retry', broadcastId } re-sends ONLY to failed
 *                    recipients, recording new delivery attempts
 */
export async function GET(req: Request) {
  const admin = await requireStaff(req)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const broadcasts = await db.broadcast.findMany({
    orderBy: { createdAt: 'desc' },
    take: 30,
    include: { sender: { select: { id: true, name: true, username: true, role: true, isOfficial: true } } },
  })
  return NextResponse.json({
    broadcasts: broadcasts.map((b) => ({
      id: b.id,
      title: b.title,
      body: b.body,
      sender: b.sender,
      totalTargets: b.totalTargets,
      deliveredCount: b.deliveredCount,
      failedCount: b.failedCount,
      status: b.status,
      createdAt: b.createdAt.toISOString(),
    })),
  })
}

export async function POST(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  try {
    const body = await req.json()
    const action = String(body.action || 'send')

    if (action === 'retry') {
      const broadcastId = String(body.broadcastId || '')
      const broadcast = await db.broadcast.findUnique({
        where: { id: broadcastId },
        include: { sender: { select: { id: true, name: true, username: true, role: true, isOfficial: true } } },
      })
      if (!broadcast) return NextResponse.json({ error: 'Broadcast not found' }, { status: 404 })
      const failed = await db.broadcastDelivery.findMany({ where: { broadcastId, status: 'failed' } })
      let fixed = 0
      for (const d of failed) {
        try {
          await sendOfficialMessage(broadcast.senderId, d.userId, `${broadcast.title}\n\n${broadcast.body}`.trim())
          await db.broadcastDelivery.update({
            where: { id: d.id },
            data: { status: 'sent', error: null, deliveredAt: new Date() },
          })
          await relayToUser(d.userId, 'notify:incoming', {
            payload: {
              id: `bc-${broadcast.id}-${d.userId}-${Date.now()}`,
              kind: 'broadcast',
              title: broadcast.sender?.name || 'CALL',
              body: broadcast.title.slice(0, 140),
              createdAt: new Date().toISOString(),
            },
          })
          fixed += 1
        } catch (err) {
          await db.broadcastDelivery.update({
            where: { id: d.id },
            data: { status: 'failed', error: err instanceof Error ? err.message.slice(0, 200) : 'unknown' },
          })
        }
      }
      const deliveredCount = await db.broadcastDelivery.count({ where: { broadcastId, status: 'sent' } })
      const failedCount = await db.broadcastDelivery.count({ where: { broadcastId, status: 'failed' } })
      await db.broadcast.update({ where: { id: broadcastId }, data: { deliveredCount, failedCount } })
      return NextResponse.json({ ok: true, fixed, deliveredCount, failedCount })
    }

    const title = String(body.title || '').trim().slice(0, 120)
    const text = String(body.body || '').trim().slice(0, 2000)
    if (!title) return NextResponse.json({ error: 'Title required' }, { status: 400 })

    // Sender: official account by default; admin may pick any staff account.
    let sender = await getOfficialUser()
    const requestedId = String(body.senderId || '').trim()
    if (requestedId && requestedId !== sender.id) {
      const staff = await db.user.findUnique({ where: { id: requestedId } })
      if (staff && (staff.role === 'admin' || staff.role === 'team') && !staff.isOfficial) {
        sender = staff
      }
    }

    // every real user receives the broadcast (all roles, not just role==='user')
    const recipients = await db.user.findMany({
      where: {
        blocked: false,
        isOfficial: false,
        id: { not: sender.id },
      },
      select: { id: true },
    })

    const fullText = text ? `${title}\n\n${text}` : title
    const broadcast = await db.broadcast.create({
      data: {
        title,
        body: text,
        senderId: sender.id,
        createdBy: admin.id,
        totalTargets: recipients.length,
        status: 'processing',
      },
    })

    let delivered = 0
    let failed = 0
    for (const u of recipients) {
      try {
        await sendOfficialMessage(sender.id, u.id, fullText)
        await db.broadcastDelivery.create({
          data: { broadcastId: broadcast.id, userId: u.id, status: 'sent', deliveredAt: new Date() },
        })
        delivered += 1
        await relayToUser(u.id, 'notify:incoming', {
          payload: {
            id: `bc-${broadcast.id}-${u.id}`,
            kind: 'broadcast',
            title: sender.name,
            body: title.slice(0, 140),
            createdAt: new Date().toISOString(),
          },
        })
      } catch (err) {
        failed += 1
        await db.broadcastDelivery
          .create({
            data: {
              broadcastId: broadcast.id,
              userId: u.id,
              status: 'failed',
              error: err instanceof Error ? err.message.slice(0, 200) : 'unknown',
            },
          })
          .catch(() => {})
      }
    }

    await db.broadcast.update({
      where: { id: broadcast.id },
      data: { deliveredCount: delivered, failedCount: failed, status: 'completed' },
    })

    return NextResponse.json({
      ok: true,
      broadcastId: broadcast.id,
      delivered,
      failed,
      total: recipients.length,
      senderName: sender.name,
    })
  } catch {
    return NextResponse.json({ error: 'Broadcast failed' }, { status: 500 })
  }
}
