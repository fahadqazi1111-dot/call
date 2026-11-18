import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

const UPLOAD_DIR = '/home/z/my-project/db/uploads'

const MIME_BY_EXT: Record<string, string> = {
  webm: 'audio/webm',
  ogg: 'audio/ogg',
  m4a: 'audio/mp4',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  aac: 'audio/aac',
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
}

const EXT_LIST = Object.keys(MIME_BY_EXT)

/** GET: stream a stored voice note by id. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  if (!/^[a-f0-9]{32}$/.test(id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  for (const ext of EXT_LIST) {
    const file = path.join(UPLOAD_DIR, `${id}.${ext}`)
    try {
      const data = await fs.readFile(file)
      return new Response(new Uint8Array(data), {
        headers: {
          'Content-Type': MIME_BY_EXT[ext],
          'Content-Length': String(data.length),
          'Cache-Control': 'public, max-age=31536000, immutable',
          'Accept-Ranges': 'none',
        },
      })
    } catch {
      // try next extension
    }
  }
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}
