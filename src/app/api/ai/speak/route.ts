import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import crypto from 'crypto'
import ZAI from 'z-ai-web-dev-sdk'
import { db } from '@/lib/db'
import { requireUser, getSetting, rateLimit } from '@/lib/callapp/server'

const UPLOAD_DIR = '/home/z/my-project/db/uploads'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

/** POST { text } — spoken CALL reply (TTS), returns a playable media id. */
export async function POST(req: Request) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!rateLimit(`aispeak:${me.id}`, 20, 60_000)) {
    return NextResponse.json({ error: 'Too fast' }, { status: 429 })
  }
  try {
    const body = await req.json()
    const text = String(body.text || '').trim().slice(0, 1200)
    if (!text) return NextResponse.json({ error: 'Text required' }, { status: 400 })
    const cfg = await getSetting<{ dailyVoiceLimit: number; voiceReplies: boolean }>('ai', {
      dailyVoiceLimit: 40,
      voiceReplies: true,
    })
    if (!cfg.voiceReplies) {
      return NextResponse.json({ error: 'Voice replies are disabled by the admin' }, { status: 400 })
    }
    const usage = await db.aiUsage.upsert({
      where: { userId_day: { userId: me.id, day: today() } },
      update: {},
      create: { userId: me.id, day: today() },
    })
    if (usage.voiceCount >= cfg.dailyVoiceLimit) {
      return NextResponse.json({ error: `Daily voice limit reached (${cfg.dailyVoiceLimit})` }, { status: 429 })
    }

    const zai = await ZAI.create()
    const response = await zai.audio.tts.create({
      input: text,
      voice: 'tongtong',
      response_format: 'wav',
      stream: false,
    })
    const arrayBuffer = await response.arrayBuffer()

    const id = crypto.randomUUID().replace(/-/g, '')
    await fs.mkdir(UPLOAD_DIR, { recursive: true })
    await fs.writeFile(path.join(UPLOAD_DIR, `${id}.wav`), Buffer.from(new Uint8Array(arrayBuffer)))

    await db.aiUsage.update({
      where: { userId_day: { userId: me.id, day: today() } },
      data: { voiceCount: { increment: 1 } },
    })

    return NextResponse.json({ ok: true, mediaId: id, url: `/api/media/${id}` })
  } catch (e) {
    console.error('ai speak error', e)
    return NextResponse.json({ error: 'Speech generation failed' }, { status: 500 })
  }
}
