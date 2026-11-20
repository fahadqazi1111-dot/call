import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, verifyPassword, rateLimit } from '@/lib/callapp/server'

/**
 * POST /api/me/delete — permanently delete the authenticated user's account.
 *
 * App Store / Play Store compliance requirement: users must be able to delete
 * their account and personal data from within the app.
 *
 * What gets deleted (via the User row's cascade relations in the Prisma
 * schema):
 *   - contacts, conversations, messages they sent, calls, wallet, stories,
 *     story views, notifications, group memberships, AI conversations, OTP
 *     records, message hides, conversation states, blocks issued/received,
 *     reports filed/received, group memberships, group messages, payments.
 *
 * What is RETAINED (anonymized) for financial audit / legal compliance:
 *   - LedgerEntry rows: `userId` set to the literal string 'deleted-user'. The
 *     `note` and amounts are kept because they may be needed for tax/audit
 *     purposes. LedgerEntry has no FK to User, so this is a plain column
 *     update.
 *   - GiftSend rows: senderId / recipientId anonymized to 'deleted-user'. Since
 *     GiftSend is FK-constrained to User, we upsert a single sentinel
 *     'deleted-user' User (blocked=true so it never surfaces in normal
 *     queries) before repointing these rows. This keeps the gift history
 *     intact for tax/audit without leaking PII.
 *
 * Avatar media files on disk are not removed by the DB cascade; they remain
 * as orphaned files (acceptable — a cron can sweep them later).
 *
 * The user must provide their password to confirm when they have one set.
 * Phone-only accounts (no password) require only `confirm: true`.
 *
 * Rate-limited to 3 attempts per hour per IP to prevent abuse.
 */
export async function POST(req: Request) {
  // ---- rate limit (3 / hour / IP) ----
  const ip =
    (req.headers.get('x-forwarded-for') || '').split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  if (!rateLimit(`delete-account:${ip}`, 3, 3600_000)) {
    return NextResponse.json(
      { error: 'Too many attempts. Please try again later.' },
      { status: 429 }
    )
  }

  // ---- auth ----
  const user = await requireUser(req)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // ---- parse + validate body ----
    const body = (await req.json().catch(() => ({}))) as {
      password?: string
      confirm?: boolean
    }
    if (body.confirm !== true) {
      return NextResponse.json(
        { error: 'Confirmation required to delete your account.' },
        { status: 400 }
      )
    }

    // ---- password gate (only when the user has one) ----
    if (user.passwordHash) {
      const password = typeof body.password === 'string' ? body.password : ''
      if (!verifyPassword(password, user.passwordHash)) {
        // Do NOT delete — wrong password.
        return NextResponse.json({ error: 'Password incorrect' }, { status: 400 })
      }
    }

    // ---- transaction: anonymize audit rows, then delete the user ----
    await db.$transaction([
      // Sentinel 'deleted-user' so FK-constrained GiftSend rows can be
      // repointed without violating the FK. Created once; upsert is
      // idempotent across many user deletions.
      db.user.upsert({
        where: { id: 'deleted-user' },
        update: {},
        create: {
          id: 'deleted-user',
          phone: '0000000000',
          username: 'deleted_user',
          name: 'Deleted User',
          about: 'This account has been deleted.',
          blocked: true,
          role: 'user',
        },
      }),
      // 1) Anonymize LedgerEntry rows (no FK to User — plain column).
      db.ledgerEntry.updateMany({
        where: { userId: user.id },
        data: { userId: 'deleted-user' },
      }),
      // 2) Anonymize GiftSend rows where this user is the sender.
      db.giftSend.updateMany({
        where: { senderId: user.id },
        data: { senderId: 'deleted-user' },
      }),
      // 3) Anonymize GiftSend rows where this user is the recipient.
      db.giftSend.updateMany({
        where: { recipientId: user.id },
        data: { recipientId: 'deleted-user' },
      }),
      // 4) Delete the user — cascades to every related table per the schema.
      db.user.delete({ where: { id: user.id } }),
    ])

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[me/delete] failed:', e)
    return NextResponse.json(
      { error: 'Something went wrong while deleting your account.' },
      { status: 500 }
    )
  }
}
