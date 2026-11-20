import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * One-time backfill: give every existing user a unique @username derived
 * from their display name. Idempotent — only touches users whose username
 * is still null. Safe to re-run.
 */
function slugBase(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 14)
  return base.length >= 3 ? base : `user${base || ''}`
}

async function main() {
  const users = await prisma.user.findMany({ where: { username: null }, select: { id: true, name: true } })
  let count = 0
  for (const u of users) {
    let candidate = slugBase(u.name || 'user')
    // ensure uniqueness
    for (let i = 0; i < 200; i++) {
      const taken = await prisma.user.findUnique({ where: { username: candidate } })
      if (!taken) break
      candidate = `${slugBase(u.name || 'user')}${Math.floor(1000 + Math.random() * 9000)}`
    }
    await prisma.user.update({ where: { id: u.id }, data: { username: candidate } })
    count++
    console.log(`${u.name} -> @${candidate}`)
  }
  console.log(`Backfilled ${count} username(s).`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
