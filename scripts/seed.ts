import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/** One-time seed: default admin settings, gift catalog, coin packages. Idempotent. */
async function main() {
  /* ---------- admin settings ---------- */
  const settings: Record<string, unknown> = {
    finance: {
      creatorEarnPercent: 50, // % of gift price credited to recipient earnings
      platformCommission: 50, // % kept by platform
      roomHostPercent: 70, // % of paid-room entry fee credited to host earnings
      minWithdrawal: 5000, // diamonds
      withdrawalMethods: ['bank', 'jazzcash', 'easypaisa', 'usdt'],
    },
    rooms: {
      maxSpeakers: 5,
      maxEntryFee: 5000, // coins cap for paid-room entry fee
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
    adminSetupCode: 'CALL-ADMIN-2024',
  }
  for (const [key, value] of Object.entries(settings)) {
    await prisma.adminSetting.upsert({
      where: { key },
      update: {},
      create: { key, value: JSON.stringify(value) },
    })
  }

  /* ---------- gift catalog ---------- */
  const gifts = [
    { name: 'Rose', emoji: '🌹', animKind: 'rose', category: 'both', priceCoins: 1, earnValue: 0.5, sortOrder: 1 },
    { name: 'Heart', emoji: '❤️', animKind: 'heart', category: 'both', priceCoins: 5, earnValue: 2.5, sortOrder: 2 },
    { name: 'Flowers', emoji: '💐', animKind: 'flower', category: 'both', priceCoins: 20, earnValue: 10, sortOrder: 3 },
    { name: 'Crown', emoji: '👑', animKind: 'crown', category: 'both', priceCoins: 100, earnValue: 50, sortOrder: 4 },
    { name: 'Diamond', emoji: '💎', animKind: 'diamond', category: 'both', priceCoins: 200, earnValue: 100, sortOrder: 5 },
    { name: 'Car', emoji: '🏎️', animKind: 'car', category: 'both', priceCoins: 500, earnValue: 250, durationMs: 3200, sortOrder: 6 },
    { name: 'Rocket', emoji: '🚀', animKind: 'rocket', category: 'both', priceCoins: 1000, earnValue: 500, durationMs: 3500, sortOrder: 7 },
    { name: 'Dragon', emoji: '🐉', animKind: 'dragon', category: 'both', priceCoins: 2000, earnValue: 1000, durationMs: 4000, sortOrder: 8 },
    { name: 'Lion', emoji: '🦁', animKind: 'lion', category: 'both', priceCoins: 3000, earnValue: 1500, durationMs: 4000, sortOrder: 9 },
    { name: 'Super Lion', emoji: '🦁✨', animKind: 'superlion', category: 'both', priceCoins: 5000, earnValue: 2500, durationMs: 4500, sortOrder: 10 },
    { name: 'Fireworks', emoji: '🎆', animKind: 'fireworks', category: 'both', priceCoins: 7500, earnValue: 3750, durationMs: 4500, sortOrder: 11 },
    { name: 'Magic Castle', emoji: '🏰', animKind: 'castle', category: 'both', priceCoins: 10000, earnValue: 5000, durationMs: 5000, sortOrder: 12 },
  ]
  for (const g of gifts) {
    const existing = await prisma.gift.findFirst({ where: { name: g.name, category: g.category } })
    if (!existing) await prisma.gift.create({ data: g })
  }

  /* ---------- coin packages ---------- */
  const pkgs = [
    { name: 'Starter', coins: 100, bonus: 0, priceUsd: 0.99, order: 1 },
    { name: 'Basic', coins: 500, bonus: 25, priceUsd: 4.99, order: 2 },
    { name: 'Popular', coins: 1200, bonus: 120, priceUsd: 9.99, order: 3 },
    { name: 'Pro', coins: 3000, bonus: 400, priceUsd: 24.99, order: 4 },
    { name: 'Mega', coins: 8000, bonus: 1500, priceUsd: 49.99, order: 5 },
    { name: 'Legend', coins: 20000, bonus: 5000, priceUsd: 99.99, order: 6 },
  ]
  for (const p of pkgs) {
    const existing = await prisma.coinPackage.findFirst({ where: { name: p.name } })
    if (!existing) await prisma.coinPackage.create({ data: p })
  }

  console.log('Seed complete: settings, gifts, packages ready.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
