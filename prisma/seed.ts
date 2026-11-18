/**
 * Seed the system accounts:
 *  - CALL Official (the official app account that welcomes new users)
 *  - The first admin (logs in on the normal login screen with email + password)
 *
 * Run: bun prisma/seed.ts   (idempotent — safe to run repeatedly)
 */
import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'

const db = new PrismaClient()

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 32).toString('hex')
  return `scrypt:${salt}:${hash}`
}

const DEFAULT_ADMIN_EMAIL = 'admin@call.app'
const DEFAULT_ADMIN_PASSWORD = 'Admin@CALL2024'

async function main() {
  // ---- CALL Official ----
  let official = await db.user.findFirst({ where: { isOfficial: true } })
  if (!official) {
    official = await db.user.findUnique({ where: { username: 'official' } })
    if (official) {
      official = await db.user.update({ where: { id: official.id }, data: { isOfficial: true } })
    } else {
      official = await db.user.create({
        data: {
          phone: '0000000000',
          email: 'official@call.app',
          name: 'CALL',
          username: 'official',
          about: 'The official CALL account. Messages from the CALL team are sent from here.',
          isOfficial: true,
          avatarKey: 0,
        },
      })
    }
  }
  console.log(`[seed] CALL Official ready: ${official.username} (${official.id})`)

  // ---- Default admin (only when no email+password admin exists yet) ----
  const admins = await db.user.findMany({ where: { role: 'admin' } })
  const usableAdmin = admins.find((a) => a.email && a.passwordHash)
  if (usableAdmin) {
    console.log(`[seed] Admin already exists: ${usableAdmin.email} — skipping default admin`)
    return
  }
  // Legacy admins promoted via the old setup code (phone-only, no email) can
  // not log in under the email+password model — demote them so admin access
  // is exclusively via the seeded email + password account.
  for (const a of admins) {
    if (a.id !== usableAdmin?.id) {
      await db.user.update({ where: { id: a.id }, data: { role: 'user' } })
      console.log(`[seed] Demoted legacy phone-only admin: ${a.username} (${a.email ?? a.phone})`)
    }
  }
  const existingEmail = await db.user.findUnique({ where: { email: DEFAULT_ADMIN_EMAIL } })
  if (existingEmail) {
    await db.user.update({
      where: { id: existingEmail.id },
      data: { role: 'admin', passwordHash: hashPassword(DEFAULT_ADMIN_PASSWORD) },
    })
    console.log(`[seed] Promoted existing account ${DEFAULT_ADMIN_EMAIL} to admin`)
    return
  }
  let phone = '0000000001'
  while (await db.user.findUnique({ where: { phone } })) {
    phone = `000000${Math.floor(100000 + Math.random() * 899999)}`
  }
  await db.user.create({
    data: {
      name: 'CALL Admin',
      email: DEFAULT_ADMIN_EMAIL,
      phone,
      username: 'admin',
      passwordHash: hashPassword(DEFAULT_ADMIN_PASSWORD),
      role: 'admin',
      emailVerified: true,
      about: 'CALL team',
      avatarKey: 1,
    },
  })
  console.log('[seed] Default admin created')
  console.log('================================================')
  console.log(`  Admin login: ${DEFAULT_ADMIN_EMAIL}`)
  console.log(`  Password:    ${DEFAULT_ADMIN_PASSWORD}`)
  console.log('  (log in on the normal login screen — the admin')
  console.log('   panel opens automatically after login)')
  console.log('================================================')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
