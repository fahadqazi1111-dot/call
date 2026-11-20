import { NextResponse } from 'next/server'
import { getSetting } from '@/lib/callapp/server'

/**
 * GET /api/config — public, unauthenticated app configuration.
 * The splash screen can be enabled/disabled from the admin panel;
 * the client reads this before rendering the splash.
 */
export async function GET() {
  const app = await getSetting<{ splashEnabled: boolean }>('app', { splashEnabled: true })
  return NextResponse.json({
    splashEnabled: app.splashEnabled !== false,
  })
}
