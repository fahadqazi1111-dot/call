import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'

/**
 * GET /api/health — deployment self-check.
 *
 * Returns whether the Next.js server is up and whether it can actually
 * reach the database. Never exposes credentials or raw driver messages —
 * only the Prisma error code (e.g. P1001 "can't reach database server",
 * P1003 "database file not found") so problems are diagnosable from the
 * browser without leaking internals.
 *
 * On Hostinger the quickest check after a deploy is:
 *   https://<your-domain>/api/health
 *   -> { "ok": true, "db": "up" }                      everything works
 *   -> { "ok": true, "db": "down", "code": "P1001" }   fix DATABASE_URL
 */
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`
    return NextResponse.json({ ok: true, db: 'up' })
  } catch (e) {
    const code = e instanceof Prisma.PrismaClientKnownRequestError ? e.code : 'DB_ERROR'
    console.error('[health] database check failed:', e)
    return NextResponse.json({ ok: true, db: 'down', code }, { status: 503 })
  }
}
