import { NextResponse } from 'next/server'
import { getSetting } from '@/lib/callapp/server'

/**
 * INTERNAL — used by the CALL socket mini-service to read the
 * admin-configurable conference capacity before creating a conference.
 * Guarded by the same shared internal relay secret the verify route uses.
 *
 * GET → { ok, maxParticipants }   (clamped 2..12, default 5)
 *
 * Admin config lives under the `calls` settings key:
 *   { maxConferenceParticipants: number }  (mapped to maxParticipants here)
 */
export async function GET(req: Request) {
  if (req.headers.get('x-internal-secret') !== 'call-internal-relay-v1') {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  }
  try {
    const cfg = await getSetting<{ maxConferenceParticipants?: number; maxParticipants?: number }>('calls', {
      maxConferenceParticipants: 5,
    })
    const raw = Number(cfg?.maxConferenceParticipants ?? cfg?.maxParticipants ?? 5)
    const maxParticipants = Math.max(2, Math.min(12, Math.round(raw) || 5))
    return NextResponse.json({ ok: true, maxParticipants })
  } catch {
    return NextResponse.json({ ok: true, maxParticipants: 5 })
  }
}
