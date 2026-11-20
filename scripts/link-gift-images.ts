/**
 * One-off: attach the generated TikTok-style artwork (public/gifts/*.png)
 * to the existing gift catalog rows. Idempotent.
 * Run: bun run scripts/link-gift-images.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const map: Record<string, string> = {
  Rose: '/gifts/rose.png',
  Flower: '/gifts/rose.png',
  Heart: '/gifts/heart.png',
  Bouquet: '/gifts/rose.png',
  Crown: '/gifts/crown.png',
  'Race Car': '/gifts/car.png',
  Rocket: '/gifts/rocket.png',
  Fireworks: '/gifts/fireworks.png',
  Dragon: '/gifts/dragon.png',
  Lion: '/gifts/lion.png',
  'Magic Castle': '/gifts/castle.png',
  Galaxy: '/gifts/galaxy.png',
}

async function main() {
  let n = 0
  for (const [name, url] of Object.entries(map)) {
    const res = await prisma.gift.updateMany({ where: { name }, data: { imageUrl: url } })
    n += res.count
  }
  console.log(`Linked images to ${n} gift rows`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
