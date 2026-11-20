import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { rateLimit, requireUser } from '@/lib/callapp/server'

const REPORT_REASONS = ['spam', 'harassment', 'inappropriate', 'scam', 'other']

/**
 * POST { userId, reason, details?, messageId? } — file a user report into the
 * admin moderation queue. Every admin gets a 'security' notification.
 * Returns { ok, reportId }.
 */
export async function POST(req: Request) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!rateLimit(`report:${me.id}`, 10, 60_000)) {
    return NextResponse.json({ error: 'Too many reports — try again later' }, { status: 429 })
  }
  try {
    const body = await req.json()
    const userId = String(body.userId || '')
    const reason = String(body.reason || '')
    const details = body.details ? String(body.details).slice(0, 2000) : null
    const messageId = body.messageId ? String(body.messageId) : null
    if (!userId || userId === me.id) return NextResponse.json({ error: 'Invalid user' }, { status: 400 })
    if (!REPORT_REASONS.includes(reason)) {
      return NextResponse.json({ error: 'Invalid reason' }, { status: 400 })
    }
    const target = await db.user.findUnique({ where: { id: userId }, select: { id: true, name: true } })
    if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const report = await db.userReport.create({
      data: {
        reporterId: me.id,
        reportedId: userId,
        reason,
        details,
        messageId,
      },
    })

    // alert every admin so reports never sit unnoticed
    const admins = await db.user.findMany({ where: { role: 'admin' }, select: { id: true } })
    if (admins.length) {
      await db.notification.createMany({
        data: admins.map((a) => ({
          userId: a.id,
          kind: 'security',
          title: 'New user report filed',
          body: `${me.name} reported ${target.name} for ${reason}.`,
          refType: 'user_report',
          refId: report.id,
        })),
      })
    }

    return NextResponse.json({ ok: true, reportId: report.id })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
