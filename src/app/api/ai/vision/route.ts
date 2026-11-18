import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import ZAI from 'z-ai-web-dev-sdk'
import { requireUser, rateLimit } from '@/lib/callapp/server'

const UPLOAD_DIR = '/home/z/my-project/db/uploads'
const EXT_LIST = ['jpg', 'png', 'webp', 'gif']

/** POST { mediaId, question } — analyze an uploaded image with the vision model. */
export async function POST(req: Request) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!rateLimit(`aivision:${me.id}`, 12, 60_000)) {
    return NextResponse.json({ error: 'Too fast' }, { status: 429 })
  }
  try {
    const body = await req.json()
    const mediaId = String(body.mediaId || '')
    const question = String(body.question || 'Describe this image.').trim().slice(0, 600)
    if (!/^[a-f0-9]{32}$/.test(mediaId)) return NextResponse.json({ error: 'Invalid media' }, { status: 400 })

    // load the image file
    let buf: Buffer | null = null
    for (const ext of EXT_LIST) {
      try {
        buf = await fs.readFile(path.join(UPLOAD_DIR, `${mediaId}.${ext}`))
        break
      } catch {
        // next
      }
    }
    if (!buf) return NextResponse.json({ error: 'Image not found' }, { status: 404 })

    const zai = await ZAI.create()
    const completion = await zai.chat.completions.createVision({
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: question },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${buf.toString('base64')}` } },
          ],
        },
      ],
      thinking: { type: 'disabled' },
    })
    const reply = completion.choices[0]?.message?.content?.trim() || 'I could not analyze this image.'
    return NextResponse.json({ ok: true, reply })
  } catch (e) {
    console.error('ai vision error', e)
    return NextResponse.json({ error: 'Image analysis failed' }, { status: 500 })
  }
}
