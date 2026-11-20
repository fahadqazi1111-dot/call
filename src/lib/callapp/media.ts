'use client'

import { getToken } from './api'

/**
 * Signed media URL helper with cache.
 * Chat media (voice notes, images) is private — the server requires a
 * viewer-scoped signed token. This helper batch-signs and caches URLs.
 */
const cache = new Map<string, string>()
let pending: Promise<Record<string, string>> | null = null

async function signBatch(ids: string[]): Promise<Record<string, string>> {
  const token = getToken()
  const res = await fetch('/api/media/sign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { 'x-auth-token': token } : {}) },
    body: JSON.stringify({ ids }),
  })
  const data = (await res.json()) as { urls?: Record<string, string> }
  return data.urls ?? {}
}

export async function getMediaUrl(mediaId: string): Promise<string | null> {
  if (!/^[a-f0-9]{32}$/.test(mediaId)) return null
  const cached = cache.get(mediaId)
  if (cached) return cached
  const urls = await (pending ?? signBatch([mediaId]))
  const url = urls[mediaId] ?? null
  if (url) cache.set(mediaId, url)
  return url
}

export function clearMediaCache() {
  cache.clear()
}
