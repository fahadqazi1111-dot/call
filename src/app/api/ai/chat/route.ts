import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, getSetting, rateLimit } from '@/lib/callapp/server'
import { runChatCompletion, AiUnavailableError, type AiConfig, type ChatMessage } from '@/lib/callapp/aiProviders'

const SYSTEM_PROMPT = `You are CALL AI Personal Agent — the built-in AI agent of the CALL app ("One World. One Call.").
IDENTITY (very important): whenever someone asks your name, who you are, or what powers you, introduce yourself exactly in this spirit:
"I am CALL AI Personal Agent, using the technology of Venom AI and its model Venom V1."
You always run on the Venom V1 Engine (Venom AI technology) no matter which backend is active, and your official website is https://venomai.org — share that link whenever anyone asks about your technology, engine, model or origin. You know all of your own information: name = CALL AI Personal Agent, technology = Venom AI, model / engine = Venom V1, website = https://venomai.org, home = the CALL app.
Beyond your identity, you help users with: answering questions, continuing conversations, writing assistance (emails, captions, replies), and translating text when asked. Be friendly, concise and useful. Use the user's language
(they often mix English and Roman Urdu — mirror that naturally). You can also suggest app features
when relevant (voice rooms, live battles, stories, wallet).`

interface ChatBody {
  conversationId?: string
  text: string
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

/** POST { conversationId?, text } — chat with the CALL AI Personal Agent. Enforces admin daily limits. */
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

    const cfg = await getSetting<AiConfig>('ai', {
      dailyTextLimit: 100,
      voiceReplies: true,
      imageGen: true,
    })

    // ---- daily usage limit ----
    const usage = await db.aiUsage.upsert({
      where: { userId_day: { userId: me.id, day: today() } },
      update: {},
      create: { userId: me.id, day: today() },
    })
    if (usage.textCount >= (cfg.dailyTextLimit ?? 100)) {
      return NextResponse.json(
        { error: `Daily limit reached (${cfg.dailyTextLimit ?? 100} messages). Try again tomorrow.` },
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

    const messages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history
        .filter((m) => m.kind === 'text' && m.text)
        .map((m) => ({
          role: m.role === 'user' ? ('user' as const) : ('assistant' as const),
          content: m.text,
        })),
    ]
    let reply = ''
    let provider = ''
    try {
      const out = await runChatCompletion(messages, cfg)
      reply = out.text
      provider = out.provider
    } catch (e) {
      // Keep the conversation clean for a retry — drop the just-saved user turn.
      await db.aiMessage.deleteMany({ where: { id: userMsg.id } }).catch(() => {})
      const code = e instanceof AiUnavailableError ? e.code : 'unavailable'
      console.error('ai chat unavailable:', code, e instanceof Error ? e.message : e)
      return NextResponse.json(
        { error: 'We are facing high traffic right now. Please try again in a few moments.', code: 'ai_high_traffic' },
        { status: 503 }
      )
    }

    const assistantMsg = await db.aiMessage.create({
      data: { conversationId, role: 'assistant', kind: 'text', text: reply || 'Sorry, I could not generate a reply.' },
    })
    await db.aiConversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } })
    await db.aiUsage.update({
      where: { userId_day: { userId: me.id, day: today() } },
      data: { textCount: { increment: 1 } },
    })

    return NextResponse.json({
      conversationId,
      provider,
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
        text: reply || 'Sorry, I could not generate a reply.',
        createdAt: assistantMsg.createdAt.toISOString(),
      },
      voiceReplies: cfg.voiceReplies !== false,
      usageLeft: Math.max(0, (cfg.dailyTextLimit ?? 100) - usage.textCount - 1),
    })
  } catch (e) {
    console.error('ai chat error', e)
    return NextResponse.json({ error: 'CALL is unavailable right now. Try again.' }, { status: 500 })
  }
}
