/**
 * Test fixture for gift-flow verification:
 *   - creates/finds a second user (Sara) with a known token
 *   - opens a live broadcast hosted by Sara
 *   - credits the admin's wallet with $50 through the ledger (admin_adjustment)
 *   - prints tokens for browser testing
 * Run: bun run scripts/gift-test-fixture.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const { signToken } = await import('../src/lib/callapp/server')
  const { applyLedgerDelta } = await import('../src/lib/callapp/server')

  // --- user B: the host we'll watch ---
  let sara = await prisma.user.findUnique({ where: { email: 'sara@test.call' } })
  if (!sara) {
    sara = await prisma.user.create({
      data: {
        phone: '0000000010',
        email: 'sara@test.call',
        emailVerified: true,
        name: 'Sara Khan',
        username: 'sarakhan',
        avatarKey: 3,
      },
    })
  }

  // --- live session hosted by Sara ---
  const live = await prisma.liveSession.findFirst({
    where: { hostId: sara.id, status: 'live' },
  })
  if (!live) {
    await prisma.liveSession.create({
      data: { hostId: sara.id, title: 'Sara nightly chill stream', mode: 'solo', status: 'live' },
    })
  }

  // --- admin wallet credit ($50) ---
  const admin = await prisma.user.findUnique({ where: { email: 'fahadqazi1111@gmail.com' } })
  if (!admin) throw new Error('admin missing — run seed first')
  const credit = await applyLedgerDelta(
    admin.id,
    'admin_adjustment',
    { available: 50 },
    'Test credit — $50 for gift-flow verification',
    'admin',
    admin.id,
    `testcredit:${Date.now()}`
  )

  console.log('SARA_TOKEN=' + signToken(sara.id))
  console.log('ADMIN_TOKEN=' + signToken(admin.id))
  console.log('ADMIN_WALLET=' + JSON.stringify(credit.wallet))
  console.log('LIVE_ID=' + (live?.id ?? (await prisma.liveSession.findFirst({ where: { hostId: sara.id, status: 'live' } }))?.id))
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
