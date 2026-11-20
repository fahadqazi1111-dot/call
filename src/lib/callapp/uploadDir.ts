import { promises as fs } from 'fs'
import path from 'path'

/**
 * Resolve the media upload directory.
 *
 * ORDER OF PREFERENCE:
 *   1. process.env.UPLOAD_DIR         (explicit override — recommended for production)
 *   2. process.cwd() + '/db/uploads'  (default — works for both dev and standalone prod builds)
 *
 * The old code hardcoded '/home/z/my-project/db/uploads', which only worked on this
 * exact dev machine. On Hostinger / VPS / any other deploy the absolute path did
 * not exist, fs.mkdir silently failed inside the catch-all try/catch, and EVERY
 * upload (profile pics, chat images, stories, AI images, voice notes) returned 500
 * with a generic "Upload failed" message and no log entry. This is the root cause
 * of all reported image-upload failures.
 *
 * Callers should use `ensureUploadDir()` once at startup or before each write —
 * it is idempotent and cheap (mkdir recursive).
 */
let cachedDir: string | null = null

export function getUploadDir(): string {
  if (cachedDir) return cachedDir
  const fromEnv = process.env.UPLOAD_DIR?.trim()
  const dir = fromEnv || path.join(process.cwd(), 'db', 'uploads')
  cachedDir = dir
  return dir
}

/** Idempotently ensure the upload directory exists. Safe to call on every request. */
export async function ensureUploadDir(): Promise<string> {
  const dir = getUploadDir()
  await fs.mkdir(dir, { recursive: true })
  return dir
}

/** Build the full path for a stored media file given its id + extension. */
export function mediaPath(id: string, ext: string): string {
  return path.join(getUploadDir(), `${id}.${ext}`)
}
