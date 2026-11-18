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

export function publicUser(u: { id: string; name: string; phone: string; about: string; avatarKey: number; lastSeen: Date }) {
  return {
    id: u.id,
    name: u.name,
    phone: u.phone,
    about: u.about,
    avatarKey: u.avatarKey,
    lastSeen: u.lastSeen.toISOString(),
  }
}

export function makeOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}
