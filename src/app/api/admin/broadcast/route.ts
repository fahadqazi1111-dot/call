import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/callapp/server'
import { getOfficialUser, sendOfficialMessage } from '@/lib/callapp/official'

/**
 * POST { title, body, senderId? } — broadcast a message to EVERY user.
 *
 * The message lands in each user's chat as a real message from the selected
 * sender — the CALL Official account by default, or any staff account the
 * admin picks. A notification entry is created as well so the announcement is
 * visible in the notification center. Only full admins can broadcast.
 */
export async function POST(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  try {
    const body = await req.json()
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

    const recipients = await db.user.findMany({
      where: {
        blocked: false,
        isOfficial: false,
        role: 'user',
        id: { not: sender.id },
      },
      select: { id: true },
    })

    const fullText = text ? `${title}\n\n${text}` : title
    let delivered = 0
    for (const u of recipients) {
      try {
        await sendOfficialMessage(sender.id, u.id, fullText)
        delivered += 1
      } catch {}
    }
    return NextResponse.json({ ok: true, delivered, senderName: sender.name })
  } catch {
    return NextResponse.json({ error: 'Broadcast failed' }, { status: 500 })
  }
}
