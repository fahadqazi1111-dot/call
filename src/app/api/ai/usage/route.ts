import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, getSetting } from '@/lib/callapp/server'

/** GET: my CALL AI usage today + limits. */
export async function GET(req: Request) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const day = new Date().toISOString().slice(0, 10)
  const cfg = await getSetting<{
    dailyTextLimit: number
    dailyImageLimit: number
    dailyVoiceLimit: number
    voiceReplies: boolean
    imageGen: boolean
    provider: string
    defaultModel: string
  }>('ai', {
    dailyTextLimit: 100,
    dailyImageLimit: 10,
    dailyVoiceLimit: 40,
    voiceReplies: true,
    imageGen: true,
    provider: 'zai',
    defaultModel: 'default',
  })
  const usage = await db.aiUsage.findUnique({
    where: { userId_day: { userId: me.id, day } },
  })
  return NextResponse.json({
    usage: {
      text: usage?.textCount ?? 0,
      image: usage?.imageCount ?? 0,
      voice: usage?.voiceCount ?? 0,
    },
    limits: {
      text: cfg.dailyTextLimit,
      image: cfg.dailyImageLimit,
      voice: cfg.dailyVoiceLimit,
      voiceReplies: cfg.voiceReplies,
      imageGen: cfg.imageGen,
    },
    provider: { name: cfg.provider, model: cfg.defaultModel },
  })
}
