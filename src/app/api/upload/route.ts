import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import crypto from 'crypto'
import { requireUser } from '@/lib/callapp/server'

const UPLOAD_DIR = '/home/z/my-project/db/uploads'
const MAX_BYTES = 25 * 1024 * 1024

const EXT_BY_MIME: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mp4': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/aac': 'aac',
}

/** POST: upload a voice note (multipart 'file'). Returns a media id served at /api/media/{id}. */
export async function POST(req: Request) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'file required' }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'File too large (max 25MB)' }, { status: 400 })
    }
    const mime = file.type || 'audio/webm'
    const ext = EXT_BY_MIME[mime] || 'webm'
    const id = crypto.randomUUID().replace(/-/g, '')
    await fs.mkdir(UPLOAD_DIR, { recursive: true })
    const buf = Buffer.from(await file.arrayBuffer())
    await fs.writeFile(path.join(UPLOAD_DIR, `${id}.${ext}`), buf)
    return NextResponse.json({ ok: true, id, mime, size: buf.length })
  } catch {
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
