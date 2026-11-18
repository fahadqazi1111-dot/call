import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * One-time seed: default admin settings, money-priced gift catalog, ad packages.
 * Idempotent. NO coins/diamonds/points — every price is real money (USD).
 */
async function main() {
  /* ---------- admin settings ---------- */
  const settings: Record<string, unknown> = {
    finance: {
      currency: 'USD',
      platformCommission: 30, // % of each verified gift kept by the platform
      roomHostPercent: 70, // % of paid-room entry fee credited to the host
      paymentFeePercent: 2.9, // estimated provider fee % — tracked separately, never merged into commission
      paymentFeeFixed: 0.3, // estimated provider fixed fee per transaction
      minWithdrawal: 25, // USD — bank transfer only
      withdrawalMethods: ['bank'],
    },
    rooms: {
      maxSpeakers: 5,
      maxEntryFee: 50, // USD cap for paid-room entry fee
      allowPaidRooms: true,
    },
    live: {
      maxViewers: 25, // mesh WebRTC cap per live session
      battleDurations: [60, 120, 180],
      allowBattles: true,
    },
    ai: {
      provider: 'zai',
      defaultModel: 'default',
      dailyTextLimit: 100,
      dailyImageLimit: 10,
      dailyVoiceLimit: 40,
      voiceReplies: true,
      imageGen: true,
    },
    ads: { enabled: true, placements: ['chats', 'rooms', 'profile'] },
    payments: {
      provider: 'sandbox', // sandbox = clearly labeled test checkout; set to "stripe" + keys for production
      stripeSecretKey: '',
      stripeWebhookSecret: '',
    },
    adminSetupCode: 'CALL-ADMIN-2024',
  }
  for (const [key, value] of Object.entries(settings)) {
    await prisma.adminSetting.upsert({
      where: { key },
      update: {},
      create: { key, value: JSON.stringify(value) },
    })
  }

  /* ---------- gift catalog (real money prices, admin-configurable) ---------- */
  const gifts = [
    { name: 'Rose', emoji: '🌹', animKind: 'rose', category: 'both', priceUsd: 0.6, sortOrder: 1 },
    { name: 'Flower', emoji: '🌺', animKind: 'flower', category: 'both', priceUsd: 1.0, sortOrder: 2 },
    { name: 'Heart', emoji: '❤️', animKind: 'heart', category: 'both', priceUsd: 1.5, sortOrder: 3 },
    { name: 'Bouquet', emoji: '💐', animKind: 'flower', category: 'both', priceUsd: 2.5, durationMs: 2600, sortOrder: 4 },
    { name: 'Crown', emoji: '👑', animKind: 'crown', category: 'both', priceUsd: 5.0, durationMs: 2800, sortOrder: 5 },
    { name: 'Race Car', emoji: '🏎️', animKind: 'car', category: 'both', priceUsd: 8.0, durationMs: 3200, sortOrder: 6 },
    { name: 'Rocket', emoji: '🚀', animKind: 'rocket', category: 'both', priceUsd: 10.0, durationMs: 3500, sortOrder: 7 },
    { name: 'Fireworks', emoji: '🎆', animKind: 'fireworks', category: 'both', priceUsd: 15.0, durationMs: 4000, sortOrder: 8 },
    { name: 'Dragon', emoji: '🐉', animKind: 'dragon', category: 'both', priceUsd: 20.0, durationMs: 4000, sortOrder: 9 },
    { name: 'Lion', emoji: '🦁', animKind: 'lion', category: 'both', priceUsd: 30.0, durationMs: 4200, sortOrder: 10 },
    { name: 'Magic Castle', emoji: '🏰', animKind: 'castle', category: 'both', priceUsd: 50.0, durationMs: 5000, sortOrder: 11 },
    { name: 'Galaxy', emoji: '🌌', animKind: 'superlion', category: 'both', priceUsd: 99.0, durationMs: 5200, sortOrder: 12 },
  ]
  for (const g of gifts) {
    const existing = await prisma.gift.findFirst({ where: { name: g.name } })
    if (!existing) {
      await prisma.gift.create({
        data: {
          ...g,
          sound: Number(g.priceUsd) >= 10 ? 'gift_big' : 'gift',
          description: `${g.name} gift — delivered with a real-time animation.`,
          platformMap: JSON.stringify({
            android: `call_gift_${g.animKind}`,
            ios: `call_gift_${g.animKind}`,
          }),
        },
      })
    }
  }

  /* ---------- advertising packages (user campaigns) ---------- */
  const adPkgs = [
    { name: 'Starter', description: '3-day campaign across one placement of your choice.', priceUsd: 5, durationDays: 3, placements: 'chats,rooms,profile', minBudget: 0, order: 1 },
    { name: 'Growth', description: '7-day campaign, best for reaching new audiences.', priceUsd: 15, durationDays: 7, placements: 'chats,rooms,profile', minBudget: 10, order: 2 },
    { name: 'Pro', description: '14-day campaign with priority rotation.', priceUsd: 40, durationDays: 14, placements: 'chats,rooms,profile', minBudget: 25, order: 3 },
    { name: 'Premium', description: '30-day flagship campaign, maximum exposure.', priceUsd: 99, durationDays: 30, placements: 'chats,rooms,profile', minBudget: 50, order: 4 },
  ]
  for (const p of adPkgs) {
    const existing = await prisma.adPackage.findFirst({ where: { name: p.name } })
    if (!existing) await prisma.adPackage.create({ data: p })
  }

  console.log('Seed complete: settings, money gift catalog, ad packages ready.')

  /* ---------- first admin (idempotent) — logs in on the normal login screen ---------- */
  const adminEmail = 'admin@call.app'
  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } })
  if (!existingAdmin) {
    const { hashPassword } = await import('../src/lib/callapp/server')
    await prisma.user.create({
      data: {
        phone: '0000000001',
        email: adminEmail,
        emailVerified: true,
        passwordHash: hashPassword('CallAdmin2024!'),
        role: 'admin',
        name: 'CALL Admin',
        username: 'calladmin',
      },
    })
    console.log('First admin created: admin@call.app / CallAdmin2024!')
  } else if (existingAdmin.role !== 'admin') {
    await prisma.user.update({ where: { id: existingAdmin.id }, data: { role: 'admin' } })
  }

  /* ---------- default admin #2 (idempotent) — fahadqazi1111@gmail.com / 12345678 ---------- */
  const defAdminEmail = 'fahadqazi1111@gmail.com'
  const defAdmin = await prisma.user.findUnique({ where: { email: defAdminEmail } })
  const { hashPassword } = await import('../src/lib/callapp/server')
  if (!defAdmin) {
    await prisma.user.create({
      data: {
        phone: '0000000002',
        email: defAdminEmail,
        emailVerified: true,
        passwordHash: hashPassword('12345678'),
        role: 'admin',
        name: 'Fahad Mazhar',
        username: 'fahadqazi',
      },
    })
    console.log('Default admin created: fahadqazi1111@gmail.com / 12345678')
  } else {
    const patch: { role?: string; emailVerified?: boolean; passwordHash?: string } = {}
    if (defAdmin.role !== 'admin') patch.role = 'admin'
    if (!defAdmin.emailVerified) patch.emailVerified = true
    // never overwrite a password the user has chosen themselves
    if (!defAdmin.passwordHash) patch.passwordHash = hashPassword('12345678')
    if (Object.keys(patch).length) {
      await prisma.user.update({ where: { id: defAdmin.id }, data: patch })
      console.log('Default admin ensured: fahadqazi1111@gmail.com (role admin)')
    }
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
