import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import crypto from 'crypto'
import { requireUser, rateLimit } from '@/lib/callapp/server'

const UPLOAD_DIR = '/home/z/my-project/db/uploads'
const MAX_BYTES = 80 * 1024 * 1024 // 80MB — allows story video clips
const MAX_BYTES_AVATAR = 10 * 1024 * 1024

const EXT_BY_MIME: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mp4': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/aac': 'aac',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/webm': 'webmv',
  'video/quicktime': 'mov',
}

/** POST: upload media (voice note, image, avatar, story photo/video). Served at /api/media/{id}. */
export async function POST(req: Request) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!rateLimit(`upload:${me.id}`, 30, 60_000)) {
    return NextResponse.json({ error: 'Too many uploads, slow down' }, { status: 429 })
  }
  try {
    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'file required' }, { status: 400 })
    }
    const kind = String(form.get('kind') || 'media') // media | avatar | story
    const mime = file.type || 'audio/webm'
    const ext = EXT_BY_MIME[mime]
    if (!ext) {
      return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 })
    }
    const isAvatar = kind === 'avatar'
    if (file.size > (isAvatar ? MAX_BYTES_AVATAR : MAX_BYTES)) {
      return NextResponse.json({ error: `File too large (max ${isAvatar ? 10 : 80}MB)` }, { status: 400 })
    }
    const id = crypto.randomUUID().replace(/-/g, '')
    await fs.mkdir(UPLOAD_DIR, { recursive: true })
    const buf = Buffer.from(await file.arrayBuffer())
    await fs.writeFile(path.join(UPLOAD_DIR, `${id}.${ext}`), buf)
    return NextResponse.json({ ok: true, id, mime, size: buf.length })
  } catch {
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
