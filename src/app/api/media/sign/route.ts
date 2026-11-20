import { NextResponse } from 'next/server'
import { requireUser, signMediaToken } from '@/lib/callapp/server'

/** POST { ids: string[] } — batch-sign media URLs for the current viewer. */
export async function POST(req: Request) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await req.json()
    const ids: string[] = Array.isArray(body.ids)
      ? body.ids.filter((i: string) => /^[a-f0-9]{32}$/.test(i)).slice(0, 100)
      : []
    const map: Record<string, string> = {}
    for (const id of ids) {
      map[id] = `/api/media/${id}?t=${signMediaToken(id, me.id)}`
    }
    return NextResponse.json({ ok: true, urls: map })
  } catch {
    return NextResponse.json({ error: 'Sign failed' }, { status: 500 })
  }
}
