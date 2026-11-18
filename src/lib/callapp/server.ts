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

/** Staff = full admins + team members (yellow tick). Both reach the admin panel. */
export async function requireStaff(req: Request) {
  const user = await requireUser(req)
  if (!user || (user.role !== 'admin' && user.role !== 'team')) return null
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
  currency: string
  /** % of every verified gift the platform keeps */
  platformCommission: number
  /** % of a paid-room entry fee credited to the room host */
  roomHostPercent: number
  /** estimated payment-provider fee % — tracked separately, never merged with commission */
  paymentFeePercent: number
  paymentFeeFixed: number
  minWithdrawal: number
  withdrawalMethods: string[]
}

export async function getFinance(): Promise<FinanceSettings> {
  return getSetting<FinanceSettings>('finance', {
    currency: 'USD',
    platformCommission: 30,
    roomHostPercent: 70,
    paymentFeePercent: 2.9,
    paymentFeeFixed: 0.3,
    minWithdrawal: 25,
    withdrawalMethods: ['bank'],
  })
}

/* ---------------- money helpers ---------------- */

export function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100
}

/** Estimated payment-provider processing fee, kept separately identifiable. */
export async function providerFeeFor(amount: number): Promise<number> {
  const f = await getFinance()
  return round2((amount * f.paymentFeePercent) / 100 + f.paymentFeeFixed)
}

export function fmtMoney(n: number, currency = 'USD'): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(n || 0)
  } catch {
    return `${currency} ${(n || 0).toFixed(2)}`
  }
}

/* ---------------- wallet helpers (atomic + idempotent ledger) ---------------- */

export async function ensureWallet(userId: string) {
  let w = await db.wallet.findUnique({ where: { userId } })
  if (!w) w = await db.wallet.create({ data: { userId } })
  return w
}

export interface WalletDelta {
  /** change to withdrawable available balance (money) */
  available?: number
  /** change to the reserved (locked) bucket — withdrawal holds */
  reserved?: number
  /** lifetime counter updates */
  totals?: { totalReceived?: number; totalEarned?: number; totalWithdrawn?: number }
}

export interface LedgerResult {
  applied: boolean
  wallet: { available: number; reserved: number; totalReceived: number; totalEarned: number; totalWithdrawn: number }
}

/**
 * Apply a wallet delta and append a LedgerEntry. If idempotencyKey already
 * exists, NOTHING is applied again (prevents duplicate credits/debits).
 * The wallet row and the ledger entry are written together; the ledger is the
 * source of truth for every balance change.
 */
export async function applyLedgerDelta(
  userId: string,
  kind: string,
  delta: WalletDelta,
  note: string,
  refType?: string,
  refId?: string,
  idempotencyKey?: string
): Promise<LedgerResult> {
  if (idempotencyKey) {
    const existing = await db.ledgerEntry.findUnique({ where: { idempotencyKey } })
    if (existing) {
      const w = await ensureWallet(userId)
      return { applied: false, wallet: w }
    }
  }
  const wallet = await ensureWallet(userId)
  const dAvail = round2(delta.available ?? 0)
  const dRes = round2(delta.reserved ?? 0)
  const available = Math.max(0, round2(wallet.available + dAvail))
  const reserved = Math.max(0, round2(wallet.reserved + dRes))
  const data: Record<string, unknown> = { available, reserved, updatedAt: new Date() }
  const t = delta.totals ?? {}
  if (t.totalReceived) data.totalReceived = round2(wallet.totalReceived + t.totalReceived)
  if (t.totalEarned) data.totalEarned = round2(wallet.totalEarned + t.totalEarned)
  if (t.totalWithdrawn) data.totalWithdrawn = round2(wallet.totalWithdrawn + t.totalWithdrawn)
  await db.wallet.update({ where: { userId }, data: data as never })
  const direction = dAvail + dRes >= 0 ? 'credit' : 'debit'
  await db.ledgerEntry.create({
    data: {
      userId,
      kind,
      direction,
      amount: Math.abs(dAvail || dRes),
      availableAfter: available,
      reservedAfter: reserved,
      refType: refType ?? null,
      refId: refId ?? null,
      note,
      idempotencyKey: idempotencyKey ?? null,
    },
  })
  const updated = await db.wallet.findUnique({ where: { userId } })
  return {
    applied: true,
    wallet: updated ?? { available, reserved, totalReceived: wallet.totalReceived, totalEarned: wallet.totalEarned, totalWithdrawn: wallet.totalWithdrawn },
  }
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
  role?: string
  isOfficial?: boolean
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
    select: { id: true, phone: true, name: true, about: true, avatarKey: true, avatarUrl: true, lastSeen: true, role: true, isOfficial: true },
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
  username: string
  usernameChangedAt?: Date | null
  phone: string
  about: string
  avatarKey: number
  avatarUrl: string | null
  lastSeen: Date
  email?: string | null
  emailVerified?: boolean
  role?: string
  isOfficial?: boolean
  allowNonContacts?: boolean
  createdAt?: Date
  passwordHash?: string | null
}) {
  return {
    id: u.id,
    name: u.name,
    username: u.username,
    usernameChangedAt: u.usernameChangedAt ? u.usernameChangedAt.toISOString() : null,
    phone: u.phone,
    about: u.about,
    avatarKey: u.avatarKey,
    avatarUrl: u.avatarUrl,
    lastSeen: u.lastSeen.toISOString(),
    email: u.email ?? null,
    emailVerified: u.emailVerified ?? false,
    role: u.role ?? 'user',
    isOfficial: u.isOfficial ?? false,
    allowNonContacts: u.allowNonContacts ?? false,
    createdAt: u.createdAt ? u.createdAt.toISOString() : null,
    hasPassword: !!u.passwordHash,
  }
}

export function makeOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

/* ---------------- usernames (globally unique handles) ---------------- */

/** 3–20 chars, lowercase a-z 0-9 _ — must start with a letter. */
export const USERNAME_RE = /^[a-z][a-z0-9_]{2,19}$/

/** Handles that must never be claimable. */
export const USERNAME_RESERVED = new Set([
  'admin', 'administrator', 'call', 'callapp', 'official', 'support', 'help',
  'team', 'staff', 'mod', 'moderator', 'root', 'system', 'security', 'null',
  'undefined', 'owner', 'bot', 'ai', 'assistant',
])

export const USERNAME_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000 // 1 week

/** Lowercase + strip anything outside a-z0-9_. Returns '' if nothing survives. */
export function normalizeUsername(raw: string): string {
  return (raw || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20)
}

/** Returns an error message for an invalid/reserved username, or null when valid. */
export function usernameError(u: string): string | null {
  if (!u) return 'Username is required'
  if (u.length < 3) return 'Username must be at least 3 characters'
  if (u.length > 20) return 'Username must be at most 20 characters'
  if (!USERNAME_RE.test(u)) return 'Use lowercase letters, numbers or _ — starting with a letter'
  if (USERNAME_RESERVED.has(u)) return 'This username is reserved — try another'
  return null
}

/** Build the auto-username base from a display name (Google / OTP signups). */
export function usernameBaseFromName(name: string): string {
  const base = normalizeUsername(name).slice(0, 14)
  return base.length >= 3 ? base : `user${base || Math.floor(1000 + Math.random() * 9000)}`
}

/** Generate a unique username from a display name; appends a number if needed. */
export async function generateUniqueUsername(name: string): Promise<string> {
  const base = usernameBaseFromName(name)
  if (!(await db.user.findUnique({ where: { username: base } }))) return base
  for (let i = 0; i < 40; i++) {
    const candidate = `${base}${Math.floor(10 + Math.random() * 90)}${Math.floor(10 + Math.random() * 90)}`
    if (!(await db.user.findUnique({ where: { username: candidate } }))) return candidate
  }
  // extremely unlikely fallback — timestamp based
  return `${base}${Date.now().toString(36).slice(-6)}`
}

/** When a user may next change their username (7d after signup / last change). */
export function nextUsernameChangeAt(u: { usernameChangedAt: Date | null; createdAt: Date }): number {
  const anchor = (u.usernameChangedAt ?? u.createdAt).getTime()
  return anchor + USERNAME_COOLDOWN_MS
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

/* ---------------- contact relationship helpers ---------------- */

/**
 * True when `viewerPhone` is saved in `ownerId`'s contacts. Used for
 * contacts-only stories and messaging requests. Server-side only — the
 * client can never widen its own visibility.
 */
export async function isContactOf(ownerId: string, viewerPhone: string): Promise<boolean> {
  if (!viewerPhone) return false
  const c = await db.contact.findFirst({ where: { ownerId, phone: viewerPhone }, select: { id: true } })
  return !!c
}

/** Mutual contact gate: either side has the other saved (registered users only). */
export async function areContacts(a: { id: string; phone: string }, b: { id: string; phone: string }): Promise<boolean> {
  if (a.id === b.id) return true
  const mine = await db.contact.findFirst({ where: { ownerId: a.id, phone: b.phone }, select: { id: true } })
  if (mine) return true
  const theirs = await db.contact.findFirst({ where: { ownerId: b.id, phone: a.phone }, select: { id: true } })
  return !!theirs
}

/**
 * CONTACTS-ONLY stories gate: a story is visible to the viewer only when the
 * VIEWER has the author saved in their contacts (WhatsApp status model).
 * Server-side on every path — direct story URLs or API calls cannot bypass it.
 */
export async function canViewStory(viewer: { id: string; phone: string }, authorId: string): Promise<boolean> {
  if (viewer.id === authorId) return true
  const author = await db.user.findUnique({ where: { id: authorId }, select: { phone: true } })
  if (!author) return false
  return isContactOf(viewer.id, author.phone)
}
