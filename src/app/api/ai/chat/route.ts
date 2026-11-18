import { NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'
import { db } from '@/lib/db'
import { requireUser, getSetting, rateLimit } from '@/lib/callapp/server'

const SYSTEM_PROMPT = `You are CALL, the built-in AI assistant of the CALL messaging app ("One World. One Call.").
You help users with: answering questions, continuing conversations, writing assistance (emails, captions, replies),
and translating text when asked. Be friendly, concise and useful. Use the user's language
(they often mix English and Roman Urdu — mirror that naturally). You can also suggest app features
when relevant (voice rooms, live battles, stories, wallet).`

interface ChatBody {
  conversationId?: string
  text: string
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

/** POST { conversationId?, text } — chat with CALL. Enforces admin daily limits. */
export async function POST(req: Request) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!rateLimit(`aichat:${me.id}`, 20, 60_000)) {
    return NextResponse.json({ error: 'Sending messages too fast' }, { status: 429 })
  }
  try {
    const body = (await req.json()) as ChatBody
    const text = String(body.text || '').trim().slice(0, 4000)
    if (!text) return NextResponse.json({ error: 'Empty message' }, { status: 400 })

    const cfg = await getSetting<{
      dailyTextLimit: number
      voiceReplies: boolean
      imageGen: boolean
    }>('ai', { dailyTextLimit: 100, voiceReplies: true, imageGen: true })

    // ---- daily usage limit ----
    const usage = await db.aiUsage.upsert({
      where: { userId_day: { userId: me.id, day: today() } },
      update: {},
      create: { userId: me.id, day: today() },
    })
    if (usage.textCount >= cfg.dailyTextLimit) {
      return NextResponse.json(
        { error: `Daily limit reached (${cfg.dailyTextLimit} messages). Try again tomorrow.` },
        { status: 429 }
      )
    }

    // ---- conversation ----
    let conversationId = body.conversationId || ''
    if (conversationId) {
      const conv = await db.aiConversation.findUnique({ where: { id: conversationId } })
      if (!conv || conv.userId !== me.id) conversationId = ''
    }
    if (!conversationId) {
      const conv = await db.aiConversation.create({
        data: { userId: me.id, title: text.slice(0, 40) || 'New conversation' },
      })
      conversationId = conv.id
    }

    const userMsg = await db.aiMessage.create({
      data: { conversationId, role: 'user', kind: 'text', text },
    })

    // ---- history window ----
    const history = await db.aiMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: 24,
    })
    history.reverse()

    const zai = await ZAI.create()
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'assistant', content: SYSTEM_PROMPT },
        ...history
          .filter((m) => m.kind === 'text' && m.text)
          .map((m) => ({
            role: m.role === 'user' ? ('user' as const) : ('assistant' as const),
            content: m.text,
          })),
      ],
      thinking: { type: 'disabled' },
    })
    const reply = completion.choices[0]?.message?.content?.trim() || 'Sorry, I could not generate a reply.'

    const assistantMsg = await db.aiMessage.create({
      data: { conversationId, role: 'assistant', kind: 'text', text: reply },
    })
    await db.aiConversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } })
    await db.aiUsage.update({
      where: { userId_day: { userId: me.id, day: today() } },
      data: { textCount: { increment: 1 } },
    })

    return NextResponse.json({
      conversationId,
      userMessage: {
        id: userMsg.id,
        role: 'user',
        kind: 'text',
        text,
        createdAt: userMsg.createdAt.toISOString(),
      },
      reply: {
        id: assistantMsg.id,
        role: 'assistant',
        kind: 'text',
        text: reply,
        createdAt: assistantMsg.createdAt.toISOString(),
      },
      voiceReplies: cfg.voiceReplies,
      usageLeft: Math.max(0, cfg.dailyTextLimit - usage.textCount - 1),
    })
  } catch (e) {
    console.error('ai chat error', e)
    return NextResponse.json({ error: 'CALL is unavailable right now. Try again.' }, { status: 500 })
  }
}
