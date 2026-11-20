import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import crypto from 'crypto'
import ZAI from 'z-ai-web-dev-sdk'
import { db } from '@/lib/db'
import { requireUser, getSetting, rateLimit } from '@/lib/callapp/server'
import { ensureUploadDir, mediaPath } from '@/lib/callapp/uploadDir'

/** Voices allowed by the TTS engine. 'kazi' (clear standard voice) is the
 * default — far better for mixed English/Urdu content than the Chinese-accented
 * warm voices like 'tongtong'. */
const TTS_VOICES = ['tongtong', 'chuichui', 'xiaochen', 'jam', 'kazi', 'douji', 'luodo']
const DEFAULT_VOICE = 'kazi'
const MAX_TEXT_LEN = 1000

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Trim to maxLen chars at a sentence boundary (.!? followed by whitespace).
 * Falls back to the last word boundary — never cuts mid-word when avoidable. */
function truncateAtSentence(input: string, maxLen: number): string {
  const text = input.trim()
  if (text.length <= maxLen) return text
  const clipped = text.slice(0, maxLen)
  for (let i = clipped.length - 1; i >= Math.floor(maxLen * 0.5); i--) {
    const ch = clipped[i]
    const isSentenceEnd = ch === '.' || ch === '!' || ch === '?'
    if (isSentenceEnd && (i === clipped.length - 1 || /\s/.test(clipped[i + 1] ?? ' '))) {
      return clipped.slice(0, i + 1).trim()
    }
  }
  const lastSpace = clipped.lastIndexOf(' ')
  return (lastSpace > Math.floor(maxLen * 0.5) ? clipped.slice(0, lastSpace) : clipped).trim()
}

/** POST { text, voice?, speed? } — spoken CALL reply (TTS), returns a playable media id. */
export async function POST(req: Request) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!rateLimit(`aispeak:${me.id}`, 20, 60_000)) {
    return NextResponse.json({ error: 'Too fast' }, { status: 429 })
  }
  try {
    const body = await req.json()
    const rawText = String(body.text || '').trim()
    if (!rawText) return NextResponse.json({ error: 'Text required' }, { status: 400 })
    const voiceRaw = String(body.voice ?? '')
    const voice = TTS_VOICES.includes(voiceRaw) ? voiceRaw : DEFAULT_VOICE
    const speedRaw = Number(body.speed)
    const speed = Number.isFinite(speedRaw) ? Math.min(2, Math.max(0.5, speedRaw)) : 1
    const text = truncateAtSentence(rawText, MAX_TEXT_LEN)
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
      voice,
      speed,
      response_format: 'wav',
      stream: false,
    })
    const arrayBuffer = await response.arrayBuffer()

    const id = crypto.randomUUID().replace(/-/g, '')
    await ensureUploadDir()
    await fs.writeFile(mediaPath(id, 'wav'), Buffer.from(new Uint8Array(arrayBuffer)))

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
