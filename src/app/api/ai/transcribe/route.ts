import { NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'
import { requireUser, rateLimit } from '@/lib/callapp/server'

/** POST (multipart file) — speech-to-text for talking to CALL. */
export async function POST(req: Request) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!rateLimit(`aiasr:${me.id}`, 20, 60_000)) {
    return NextResponse.json({ error: 'Too fast' }, { status: 429 })
  }
  try {
    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof File)) return NextResponse.json({ error: 'file required' }, { status: 400 })
    if (file.size > 15 * 1024 * 1024) {
      return NextResponse.json({ error: 'Audio too large (max 15MB)' }, { status: 400 })
    }
    const buf = Buffer.from(await file.arrayBuffer())
    const zai = await ZAI.create()
    const result = await zai.audio.asr.create({ file_base64: buf.toString('base64') })
    return NextResponse.json({ ok: true, text: result.text || '' })
  } catch (e) {
    console.error('ai asr error', e)
    return NextResponse.json({ error: 'Transcription failed' }, { status: 500 })
  }
}
