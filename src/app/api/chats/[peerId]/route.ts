import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/callapp/server'
import { getOrCreateConversation } from '@/lib/callapp/conv'

/**
 * DELETE: "delete chat" for ME only — hides the conversation from my list and
 * clears my view of its history (clearedBeforeAt). Stored as per-user
 * ConversationState, so the peer's copy of the chat is untouched.
 */
export async function DELETE(req: Request, ctx: { params: Promise<{ peerId: string }> }) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { peerId } = await ctx.params
    const peer = await db.user.findUnique({ where: { id: peerId }, select: { id: true } })
    if (!peer) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    const conv = await getOrCreateConversation(me.id, peerId)
    await db.conversationState.upsert({
      where: { conversationId_userId: { conversationId: conv.id, userId: me.id } },
      update: { deleted: true, clearedBeforeAt: new Date() },
      create: { conversationId: conv.id, userId: me.id, deleted: true, clearedBeforeAt: new Date() },
    })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

/**
 * PATCH { action: 'archive' | 'unarchive' | 'mute' | 'unmute' } — per-user
 * conversation flags. Returns { ok }.
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ peerId: string }> }) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await req.json()
    const action = String(body.action || '')
    const patch =
      action === 'archive'
        ? { archived: true }
        : action === 'unarchive'
          ? { archived: false }
          : action === 'mute'
            ? { muted: true }
            : action === 'unmute'
              ? { muted: false }
              : null
    if (!patch) return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    const { peerId } = await ctx.params
    const peer = await db.user.findUnique({ where: { id: peerId }, select: { id: true } })
    if (!peer) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    const conv = await getOrCreateConversation(me.id, peerId)
    await db.conversationState.upsert({
      where: { conversationId_userId: { conversationId: conv.id, userId: me.id } },
      update: patch,
      create: { conversationId: conv.id, userId: me.id, ...patch },
    })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
