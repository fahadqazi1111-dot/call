import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import crypto from 'crypto'
import ZAI from 'z-ai-web-dev-sdk'
import { db } from '@/lib/db'
import { requireUser, getSetting, rateLimit } from '@/lib/callapp/server'
import { ensureUploadDir, mediaPath } from '@/lib/callapp/uploadDir'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

/** POST { prompt, conversationId? } — generate an image with CALL. */
export async function POST(req: Request) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!rateLimit(`aiimage:${me.id}`, 6, 60_000)) {
    return NextResponse.json({ error: 'Generating too fast' }, { status: 429 })
  }
  try {
    const body = await req.json()
    const prompt = String(body.prompt || '').trim().slice(0, 800)
    if (!prompt) return NextResponse.json({ error: 'Prompt required' }, { status: 400 })

    const cfg = await getSetting<{ dailyImageLimit: number; imageGen: boolean }>('ai', {
      dailyImageLimit: 10,
      imageGen: true,
    })
    if (!cfg.imageGen) {
      return NextResponse.json({ error: 'Image generation is disabled by the admin' }, { status: 400 })
    }
    const usage = await db.aiUsage.upsert({
      where: { userId_day: { userId: me.id, day: today() } },
      update: {},
      create: { userId: me.id, day: today() },
    })
    if (usage.imageCount >= cfg.dailyImageLimit) {
      return NextResponse.json({ error: `Daily image limit reached (${cfg.dailyImageLimit})` }, { status: 429 })
    }

    const zai = await ZAI.create()
    const response = await zai.images.generations.create({ prompt, size: '1024x1024' })
    const base64 = response.data[0]?.base64
    if (!base64) return NextResponse.json({ error: 'Generation returned no image' }, { status: 500 })

    const id = crypto.randomUUID().replace(/-/g, '')
    await ensureUploadDir()
    await fs.writeFile(mediaPath(id, 'png'), Buffer.from(base64, 'base64'))

    await db.aiUsage.update({
      where: { userId_day: { userId: me.id, day: today() } },
      data: { imageCount: { increment: 1 } },
    })

    // optionally attach to conversation as image messages
    let conversationId = String(body.conversationId || '')
    if (conversationId) {
      const conv = await db.aiConversation.findUnique({ where: { id: conversationId } })
      if (!conv || conv.userId !== me.id) conversationId = ''
    }
    if (conversationId) {
      await db.aiMessage.create({ data: { conversationId, role: 'user', kind: 'text', text: `Generate image: ${prompt}` } })
      await db.aiMessage.create({ data: { conversationId, role: 'assistant', kind: 'image', text: prompt, mediaId: id } })
      await db.aiConversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } })
    }

    return NextResponse.json({ ok: true, mediaId: id, url: `/api/media/${id}`, prompt })
  } catch (e) {
    console.error('ai image error', e)
    return NextResponse.json({ error: 'Image generation failed' }, { status: 500 })
  }
}
