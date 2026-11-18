import { db } from '@/lib/db'
import { getSetting } from './server'
import { getSmtpSettings, sendWelcomeEmail } from './mail'
import { getOrCreateConversation } from './conv'

/**
 * CALL Official — the app's own system account.
 *
 * - Every new registration gets an automatic welcome message from the
 *   configured sender (official account by default, admin-selectable) plus a
 *   welcome email when the user has an email address and SMTP is configured.
 * - Users can NEVER reply to the official account (guarded in /api/messages).
 * - Admin broadcasts go out from the official account (or another staff
 *   account the admin picks) so every user receives the message in the same
 *   unified chat thread.
 */

export const OFFICIAL_PHONE = '0000000000'
export const OFFICIAL_EMAIL = 'official@call.app'
export const OFFICIAL_USERNAME = 'official'

export interface MessagingSettings {
  /** User id that sends automated messages (welcome). Default: official account. */
  welcomeSenderId: string | null
  /** Welcome message template; {name} is replaced with the user's first name. */
  welcomeText: string
}

export const DEFAULT_WELCOME_TEXT =
  'Welcome to CALL, {name}! Your account is ready and calling is completely free. Add contacts, start chats and enjoy unlimited voice and video calls. If you ever need help, this official account is where the CALL team will reach you.'

export async function getMessagingSettings(): Promise<MessagingSettings> {
  const s = await getSetting<Partial<MessagingSettings>>('messaging', {})
  return {
    welcomeSenderId: typeof s.welcomeSenderId === 'string' ? s.welcomeSenderId : null,
    welcomeText:
      typeof s.welcomeText === 'string' && s.welcomeText.trim() ? s.welcomeText : DEFAULT_WELCOME_TEXT,
  }
}

/** Find the CALL Official account, creating it on first use. */
export async function getOfficialUser() {
  let official = await db.user.findFirst({ where: { isOfficial: true } })
  if (official) return official
  official = await db.user.findUnique({ where: { username: OFFICIAL_USERNAME } })
  if (official) {
    return db.user.update({ where: { id: official.id }, data: { isOfficial: true } })
  }
  return db.user.create({
    data: {
      phone: OFFICIAL_PHONE,
      email: OFFICIAL_EMAIL,
      name: 'CALL',
      username: OFFICIAL_USERNAME,
      about: 'The official CALL account. Messages from the CALL team are sent from here.',
      isOfficial: true,
      avatarKey: 0,
    },
  })
}

/**
 * Send a one-way text message from a staff/official sender to a user.
 * Creates the conversation, message and a notification entry.
 */
export async function sendOfficialMessage(
  senderId: string,
  userId: string,
  text: string
): Promise<void> {
  const conv = await getOrCreateConversation(senderId, userId)
  const msg = await db.message.create({
    data: { conversationId: conv.id, senderId, type: 'text', content: text.slice(0, 2000) },
  })
  await db.conversation.update({ where: { id: conv.id }, data: { lastMessageAt: msg.createdAt } })
  const sender = await db.user.findUnique({ where: { id: senderId }, select: { name: true } })
  await db.notification.create({
    data: {
      userId,
      kind: 'message',
      title: sender?.name || 'CALL',
      body: text.slice(0, 140),
      refType: 'chat',
      refId: senderId,
    },
  })
}

/** Personalize the welcome template: {name} → first name. */
export function welcomeTextFor(template: string, name: string): string {
  const first = (name || 'there').trim().split(/\s+/)[0] || 'there'
  return template.replaceAll('{name}', first)
}

/**
 * Fire-and-forget welcome flow for a freshly registered user:
 * 1. chat message from the configured automated sender (official by default)
 * 2. welcome email when the account has an email and SMTP is configured
 * Never throws — registration must not fail because of greetings.
 */
export async function sendWelcomeToUser(user: { id: string; name: string; email?: string | null }) {
  try {
    const settings = await getMessagingSettings()
    let senderId = settings.welcomeSenderId
    if (senderId) {
      const sender = await db.user.findUnique({ where: { id: senderId }, select: { id: true } })
      if (!sender) senderId = null
    }
    if (!senderId) senderId = (await getOfficialUser()).id
    await sendOfficialMessage(senderId, user.id, welcomeTextFor(settings.welcomeText, user.name))
  } catch {}
  if (user.email) {
    try {
      const smtp = await getSmtpSettings()
      if (smtp) await sendWelcomeEmail(smtp, user.email, user.name)
    } catch {}
  }
}

/**
 * Sender options for admin messaging: the official account + every staff
 * member. The admin picks one of these for broadcasts / automated messages.
 */
export async function listSenderOptions() {
  const official = await getOfficialUser()
  const staff = await db.user.findMany({
    where: { role: { in: ['admin', 'team'] }, blocked: false },
    select: { id: true, name: true, username: true, role: true },
    orderBy: { name: 'asc' },
  })
  return {
    official: { id: official.id, name: official.name, username: official.username, role: 'official' },
    staff,
  }
}
