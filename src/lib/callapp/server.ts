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
  if (!user || user.blocked) return null
  return user
}

export async function requireAdmin(req: Request) {
  const user = await requireUser(req)
  if (!user || user.role !== 'admin') return null
  return user
}

/* ---------------- signed media URLs ----------------
 * Media files are private (chat voice notes, images, story media).
 * They are only reachable with a short-lived HMAC token scoped to
 * (mediaId + userId). Avatars stay public since they are profile photos.
 */
const MEDIA_TTL_MS = 6 * 60 * 60 * 1000 // 6h

/**
 * Signed media token, self-contained: `${exp}.${userId}.${sig}`.
 * sig = HMAC(mediaId.userId.exp). Verifiable without auth headers so plain
 * <img>/<audio>/<video> tags can load protected media. Viewer-scoped and
 * short-lived, so a shared URL leaks at most until expiry.
 */
export function signMediaToken(mediaId: string, userId: string, ttlMs = MEDIA_TTL_MS): string {
  const exp = Math.floor(Date.now() + ttlMs).toString(36)
  const base = `${mediaId}.${userId}.${exp}`
  const sig = crypto.createHmac('sha256', SECRET).update(base).digest('hex').slice(0, 20)
  return `${exp}.${userId}.${sig}`
}

export function verifyMediaToken(mediaId: string, token: string | null): boolean {
  if (!token) return false
  const parts = token.split('.')
  if (parts.length !== 3) return false
  const [expStr, userId, sig] = parts
  const exp = parseInt(expStr, 36)
  if (!exp || exp < Date.now() || !userId) return false
  const base = `${mediaId}.${userId}.${expStr}`
  const expect = crypto.createHmac('sha256', SECRET).update(base).digest('hex').slice(0, 20)
  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))
  } catch {
    return false
  }
}

/** Build a signed, viewer-scoped media URL. */
export function mediaUrl(mediaId: string | null | undefined, viewerId: string | null): string | null {
  if (!mediaId) return null
  if (!viewerId) return `/api/media/${mediaId}`
  return `/api/media/${mediaId}?t=${signMediaToken(mediaId, viewerId)}`
}

/* ---------------- settings ---------------- */

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  try {
    const row = await db.adminSetting.findUnique({ where: { key } })
    if (!row) return fallback
    return JSON.parse(row.value) as T
  } catch {
    return fallback
  }
}

export async function setSetting(key: string, value: unknown) {
  await db.adminSetting.upsert({
    where: { key },
    update: { value: JSON.stringify(value) },
    create: { key, value: JSON.stringify(value) },
  })
}

export interface FinanceSettings {
  creatorEarnPercent: number
  platformCommission: number
  roomHostPercent: number
  minWithdrawal: number
  withdrawalMethods: string[]
}

export async function getFinance(): Promise<FinanceSettings> {
  return getSetting<FinanceSettings>('finance', {
    creatorEarnPercent: 50,
    platformCommission: 50,
    roomHostPercent: 70,
    minWithdrawal: 5000,
    withdrawalMethods: ['bank', 'jazzcash', 'easypaisa', 'usdt'],
  })
}

/* ---------------- wallet helpers (atomic + idempotent) ---------------- */

export interface WalletDelta {
  coins?: number
  earnings?: number
}

/**
 * Apply a wallet delta and record a transaction. If idempotencyKey already
 * exists, the previous transaction is returned and NOTHING is applied again
 * (prevents duplicate deductions / credits).
 */
export async function applyWalletDelta(
  userId: string,
  kind: string,
  delta: WalletDelta,
  note: string,
  refId?: string,
  idempotencyKey?: string
): Promise<{ applied: boolean; wallet: { coins: number; earnings: number } }> {
  if (idempotencyKey) {
    const existing = await db.walletTx.findUnique({ where: { idempotencyKey } })
    if (existing) {
      const w = await ensureWallet(userId)
      return { applied: false, wallet: { coins: w.coins, earnings: w.earnings } }
    }
  }
  const wallet = await ensureWallet(userId)
  const coins = Math.max(0, wallet.coins + (delta.coins ?? 0))
  const earnings = Math.max(0, Math.round((wallet.earnings + (delta.earnings ?? 0)) * 100) / 100)
  await db.wallet.update({
    where: { userId },
    data: {
      coins,
      earnings,
      totalSpent: delta.coins && delta.coins < 0 ? { increment: -delta.coins } : undefined,
      totalEarned: delta.earnings && delta.earnings > 0 ? { increment: delta.earnings } : undefined,
      totalTopUp: delta.coins && delta.coins > 0 && kind === 'purchase' ? { increment: delta.coins } : undefined,
    },
  })
  await db.walletTx.create({
    data: {
      userId,
      kind,
      coins: delta.coins ?? 0,
      earnings: delta.earnings ?? 0,
      note,
      refId: refId ?? null,
      idempotencyKey: idempotencyKey ?? null,
      balanceAfter: coins,
      earningsAfter: earnings,
    },
  })
  return { applied: true, wallet: { coins, earnings } }
}

export async function ensureWallet(userId: string) {
  let w = await db.wallet.findUnique({ where: { userId } })
  if (!w) w = await db.wallet.create({ data: { userId } })
  return w
}

/* ---------------- simple in-memory rate limiter ---------------- */

const buckets = new Map<string, { count: number; resetAt: number }>()

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const b = buckets.get(key)
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (b.count >= limit) return false
  b.count += 1
  return true
}

/* ---------------- misc ---------------- */

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
 * Tries, in order:
 *   1. exact digit match
 *   2. national format — leading zeros stripped
 *   3. national format with my own country code prepended (e.g. 0333… → 92 333…)
 *   4. the 9-digit subscriber suffix (last resort)
 * Returns Map<contactPhone, user>.
 */
export async function matchRegisteredUsers(
  phones: string[],
  excludeUserId: string,
  myPhone?: string
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

  // Candidate country codes taken from my own registered number (1–4 digit prefixes).
  const ccs: string[] = []
  const mine = (myPhone || '').replace(/\D/g, '')
  for (let l = 1; l <= 4 && l < mine.length; l++) ccs.push(mine.slice(0, l))

  const result = new Map<string, MatchableUser>()
  for (const p of phones) {
    const d = (p || '').replace(/\D/g, '')
    let u = exact.get(d)
    if (!u && d.startsWith('0')) {
      const nat = d.replace(/^0+/, '')
      u = exact.get(nat)
      if (!u) {
        for (const cc of ccs) {
          u = exact.get(cc + nat)
          if (u) break
        }
      }
    }
    if (!u) {
      const k = phoneSuffixKey(d)
      if (k.length >= 9) u = suffix.get(k)
    }
    if (u) result.set(p, u)
  }
  return result
}

export function publicUser(u: {
  id: string
  name: string
  phone: string
  about: string
  avatarKey: number
  avatarUrl: string | null
  lastSeen: Date
  email?: string | null
  emailVerified?: boolean
  role?: string
}) {
  return {
    id: u.id,
    name: u.name,
    phone: u.phone,
    about: u.about,
    avatarKey: u.avatarKey,
    avatarUrl: u.avatarUrl,
    lastSeen: u.lastSeen.toISOString(),
    email: u.email ?? null,
    emailVerified: u.emailVerified ?? false,
    role: u.role ?? 'user',
  }
}

export function makeOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

/* ---------------- password hashing (scrypt, no external deps) ---------------- */

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 32).toString('hex')
  return `scrypt:${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string | null): boolean {
  if (!stored) return false
  const parts = stored.split(':')
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false
  const [, salt, hash] = parts
  const test = crypto.scryptSync(password, salt, 32).toString('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(test, 'hex'))
  } catch {
    return false
  }
}
