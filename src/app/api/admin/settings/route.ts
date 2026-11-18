import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, getSetting, setSetting } from '@/lib/callapp/server'

/** GET: all admin settings. */
export async function GET(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const rows = await db.adminSetting.findMany()
  const settings: Record<string, unknown> = {}
  for (const r of rows) {
    try {
      settings[r.key] = JSON.parse(r.value)
    } catch {
      settings[r.key] = r.value
    }
  }
  // never expose the setup code itself
  if (settings.adminSetupCode) settings.adminSetupCode = true
  return NextResponse.json({ settings })
}

/** PUT { key, value } — update a settings block. */
export async function PUT(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  try {
    const body = await req.json()
    const key = String(body.key || '')
    const allowed = ['finance', 'rooms', 'live', 'ai', 'ads', 'auth', 'smtp', 'messaging']
    if (!allowed.includes(key)) return NextResponse.json({ error: 'Unknown settings key' }, { status: 400 })
    const existing = await getSetting<Record<string, unknown>>(key, {})
    const merged = { ...existing, ...body.value }
    await setSetting(key, merged)
    return NextResponse.json({ ok: true, settings: merged })
  } catch {
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
}
