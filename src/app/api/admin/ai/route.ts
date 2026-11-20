import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, requireStaff, setSetting, getSetting } from '@/lib/callapp/server'
import { maskAiConfig, mergeAiConfig } from '@/lib/callapp/aiProviders'

/** GET: AI config + usage statistics. Provider API keys are always masked. */
export async function GET(req: Request) {
  const admin = await requireStaff(req)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const cfg = await getSetting<Record<string, unknown>>('ai', {})
  const auth = await getSetting<{ googleClientId?: string }>('auth', {})
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const usage = await db.aiUsage.findMany({
    where: { updatedAt: { gte: since } },
    orderBy: { updatedAt: 'desc' },
    take: 200,
  })
  const totals = usage.reduce(
    (acc, u) => ({
      text: acc.text + u.textCount,
      image: acc.image + u.imageCount,
      voice: acc.voice + u.voiceCount,
    }),
    { text: 0, image: 0, voice: 0 }
  )
  const [convCount, msgCount] = await Promise.all([
    db.aiConversation.count(),
    db.aiMessage.count(),
  ])
  return NextResponse.json({
    config: maskAiConfig(cfg),
    auth: { googleConfigured: !!auth.googleClientId },
    usage: { totals, conversations: convCount, messages: msgCount },
  })
}

/** PUT { config } — update AI settings (limits, toggles, providers, model). */
export async function PUT(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  try {
    const body = await req.json()
    const current = await getSetting<Record<string, unknown>>('ai', {})
    // merge that keeps stored API keys when the form sends masked values
    const merged = mergeAiConfig(body.config || {}, current)
    await setSetting('ai', merged)
    return NextResponse.json({ ok: true, config: maskAiConfig(merged) })
  } catch {
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
}
