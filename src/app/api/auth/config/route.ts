import { NextResponse } from 'next/server'
import { getSetting } from '@/lib/callapp/server'

/**
 * GET /api/auth/config — public auth configuration for the sign-in screen.
 * Only exposes non-secret values: the Google OAuth *client ID* (public by
 * design in Google Identity Services) so the client can render the GSI
 * button. Nothing else about credentials is ever exposed here.
 */
export async function GET() {
  try {
    const authCfg = await getSetting<{ googleClientId?: string }>('auth', {})
    return NextResponse.json({
      googleClientId: authCfg.googleClientId || null,
      googleEnabled: Boolean(authCfg.googleClientId),
    })
  } catch {
    return NextResponse.json({ googleClientId: null, googleEnabled: false })
  }
}
