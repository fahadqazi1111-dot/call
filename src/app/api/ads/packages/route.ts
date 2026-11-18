import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

/** GET — active advertising packages for user campaign creation. */
export async function GET() {
  const packages = await db.adPackage.findMany({ where: { active: true }, orderBy: { order: 'asc' } })
  return NextResponse.json({
    packages: packages.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      priceUsd: p.priceUsd,
      durationDays: p.durationDays,
      placements: p.placements.split(',').filter(Boolean),
      minBudget: p.minBudget,
    })),
  })
}
