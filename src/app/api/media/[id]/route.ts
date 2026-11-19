import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { db } from '@/lib/db'
import { verifyMediaToken } from '@/lib/callapp/server'

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
  gif: 'image/gif',
  mp4: 'video/mp4',
  webmv: 'video/webm',
  mov: 'video/quicktime',
}

const EXT_LIST = Object.keys(MIME_BY_EXT)

/**
 * GET: stream a stored media file by id.
 * SECURITY: chat voice notes, images, videos and story media are private —
 * they require a valid signed viewer token (?t=..., short-lived, user-scoped).
 * Avatars are public profile photos, so if the media id is referenced as any
 * user's avatarUrl it is served without a token.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  if (!/^[a-f0-9]{32}$/.test(id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  let filePath: string | null = null
  let mime = 'application/octet-stream'
  for (const ext of EXT_LIST) {
    const p = path.join(UPLOAD_DIR, `${id}.${ext}`)
    try {
      await fs.access(p)
      filePath = p
      mime = MIME_BY_EXT[ext]
      break
    } catch {
      // try next extension
    }
  }
  if (!filePath) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  /* ---------- authorization ---------- */
  const url = new URL(req.url)
  const token = url.searchParams.get('t')
  let authorized = false
  if (token && verifyMediaToken(id, token)) {
    authorized = true
  } else {
    // public if used as an avatar
    const avatarUser = await db.user.findFirst({ where: { avatarUrl: { contains: id } }, select: { id: true } })
    if (avatarUser) authorized = true
    // public if used as a group photo (visible to anyone who can see the group)
    if (!authorized) {
      const groupRef = await db.group.findFirst({ where: { avatarUrl: { contains: id } }, select: { id: true } })
      if (groupRef) authorized = true
    }
    // public if used as an ad creative (ads are meant to be seen by every user)
    if (!authorized) {
      const adRef = await db.ad.findFirst({ where: { imageUrl: { contains: id } }, select: { id: true } })
      if (adRef) authorized = true
    }
  }
  if (!authorized) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  /* ---------- streaming with Range support (needed for video seeking) ---------- */
  const stat = await fs.stat(filePath)
  const range = req.headers.get('range')
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range)
    if (m) {
      const start = m[1] ? parseInt(m[1], 10) : 0
      const end = m[2] ? Math.min(parseInt(m[2], 10), stat.size - 1) : stat.size - 1
      if (start <= end && start < stat.size) {
        const chunk = await fs.open(filePath, 'r').then(async (fh) => {
          const len = end - start + 1
          const buf = Buffer.alloc(len)
          await fh.read(buf, 0, len, start)
          await fh.close()
          return buf
        })
        return new Response(new Uint8Array(chunk), {
          status: 206,
          headers: {
            'Content-Type': mime,
            'Content-Length': String(chunk.length),
            'Content-Range': `bytes ${start}-${end}/${stat.size}`,
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'private, max-age=600',
          },
        })
      }
    }
  }

  const data = await fs.readFile(filePath)
  return new Response(new Uint8Array(data), {
    headers: {
      'Content-Type': mime,
      'Content-Length': String(data.length),
      'Cache-Control': 'private, max-age=600',
      'Accept-Ranges': 'bytes',
    },
  })
}
