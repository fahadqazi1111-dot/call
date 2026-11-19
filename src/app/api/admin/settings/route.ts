import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, getSetting, setSetting } from '@/lib/callapp/server'
import { maskAiConfig, mergeAiConfig } from '@/lib/callapp/aiProviders'

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
  // provider API keys never leave the backend unmasked
  if (settings.ai && typeof settings.ai === 'object') {
    settings.ai = maskAiConfig(settings.ai as Record<string, unknown>)
  }
  return NextResponse.json({ settings })
}

/** PUT { key, value } — update a settings block. */
export async function PUT(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  try {
    const body = await req.json()
    const key = String(body.key || '')
    const allowed = ['finance', 'rooms', 'live', 'calls', 'ai', 'ads', 'auth', 'smtp', 'messaging', 'app']
    if (!allowed.includes(key)) return NextResponse.json({ error: 'Unknown settings key' }, { status: 400 })
    const existing = await getSetting<Record<string, unknown>>(key, {})
    // the AI block needs credential-safe merging (masked keys keep stored values)
    const merged =
      key === 'ai' ? mergeAiConfig(body.value || {}, existing) : { ...existing, ...body.value }
    await setSetting(key, merged)
    return NextResponse.json({ ok: true, settings: key === 'ai' ? maskAiConfig(merged) : merged })
  } catch {
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
}
