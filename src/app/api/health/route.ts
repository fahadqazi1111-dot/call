import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'

/**
 * GET /api/health — deployment self-check.
 *
 * Returns whether the Next.js server is up, whether it can reach the database,
 * and whether socket.io is attached (the realtime layer that powers calls,
 * live, and voice rooms).
 *
 * On Hostinger the quickest check after a deploy is:
 *   https://<your-domain>/api/health
 *   -> { "ok": true, "db": "up", "socketio": true }   everything works
 *   -> { "ok": true, "db": "down", "code": "P1001" }  fix DATABASE_URL
 *   -> { "ok": true, "db": "up", "socketio": false }  WRONG start command!
 *       Use: node production-server.js (NOT next start — that has no socket.io)
 */
export async function GET() {
  // Check if socket.io is attached by testing if the /socket.io/ endpoint
  // responds. We can't directly check from inside Next.js, but we CAN check
  // if this route was loaded via the production-server.js (which attaches
  // socket.io) vs next start (which doesn't).
  // The production-server.js sets CALL_REALTIME_ATTACHED=1 when socket.io is
  // successfully attached. If this env var is missing, socket.io is NOT running.
  const socketioAttached = process.env.CALL_REALTIME_ATTACHED === '1'

  try {
    await db.$queryRaw`SELECT 1`
    return NextResponse.json({
      ok: true,
      db: 'up',
      socketio: socketioAttached,
      startCommand: socketioAttached ? 'production-server.js (correct)' : 'next start (WRONG — use: node production-server.js)',
    })
  } catch (e) {
    const code = e instanceof Prisma.PrismaClientKnownRequestError ? e.code : 'DB_ERROR'
    console.error('[health] database check failed:', e)
    return NextResponse.json({
      ok: true,
      db: 'down',
      code,
      socketio: socketioAttached,
      startCommand: socketioAttached ? 'production-server.js (correct)' : 'next start (WRONG — use: node production-server.js)',
    }, { status: 503 })
  }
}
