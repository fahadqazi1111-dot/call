import crypto from 'crypto'
import { db } from '@/lib/db'

const SECRET = 'call-app-hmac-secret-v1'

export function signToken(userId: string): string {
  const sig = crypto.createHmac('sha256', SECRET).update(userId).digest('hex').slice(0, 24)
  return `${userId}.${sig}`
}

export function readToken(token?: string | null): string | null {
  if (!token) return null
  const dot = token.indexOf('.')
  if (dot < 1) return null
  const userId = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  const expect = crypto.createHmac('sha256', SECRET).update(userId).digest('hex').slice(0, 24)
  return sig === expect ? userId : null
}

export async function requireUser(req: Request) {
  const userId = readToken(req.headers.get('x-auth-token'))
  if (!userId) return null
  const user = await db.user.findUnique({ where: { id: userId } })
  return user
}

/** Normalize a phone number to bare digits (min 7, max 15). */
export function normalizePhone(raw: string): string | null {
  const digits = (raw || '').replace(/\D/g, '')
  if (digits.length < 7 || digits.length > 15) return null
  return digits
}

export interface MatchableUser {
  id: string
  phone: string
  name: string
  about: string
  avatarKey: number
  avatarUrl: string | null
  lastSeen: Date
}

/**
 * Suffix key for phone matching: the national subscriber part.
 * Registered users store full digits with country code (923007654321),
 * while imported contacts are often local format (03218887766) or without
 * the country code. The last 9 digits are identical for all of these.
 */
export function phoneSuffixKey(raw: string): string {
  const d = (raw || '').replace(/\D/g, '')
  return d.length >= 9 ? d.slice(-9) : d
}

/**
 * Match a list of contact phone numbers against registered users.
 * Tries exact digit match first, then national-format (leading zeros stripped),
 * then the 9-digit subscriber suffix. Returns Map<contactPhone, user>.
 */
export async function matchRegisteredUsers(
  phones: string[],
  excludeUserId: string
): Promise<Map<string, MatchableUser>> {
  const users = await db.user.findMany({
    where: { NOT: { id: excludeUserId } },
    select: { id: true, phone: true, name: true, about: true, avatarKey: true, avatarUrl: true, lastSeen: true },
  })

  const exact = new Map<string, MatchableUser>()
  const suffix = new Map<string, MatchableUser>()
  for (const u of users) {
    exact.set(u.phone, u)
    const k = phoneSuffixKey(u.phone)
    if (k.length >= 9 && !suffix.has(k)) suffix.set(k, u)
  }

  const result = new Map<string, MatchableUser>()
  for (const p of phones) {
    const d = (p || '').replace(/\D/g, '')
    let u = exact.get(d)
    if (!u && d.startsWith('0')) u = exact.get(d.replace(/^0+/, ''))
    if (!u) {
      const k = phoneSuffixKey(d)
      if (k.length >= 9) u = suffix.get(k)
    }
    if (u) result.set(p, u)
  }
  return result
}

export function publicUser(u: { id: string; name: string; phone: string; about: string; avatarKey: number; avatarUrl: string | null; lastSeen: Date }) {
  return {
    id: u.id,
    name: u.name,
    phone: u.phone,
    about: u.about,
    avatarKey: u.avatarKey,
    avatarUrl: u.avatarUrl,
    lastSeen: u.lastSeen.toISOString(),
  }
}

export function makeOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}
