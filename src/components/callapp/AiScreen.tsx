'use client'

import { useEffect, useRef, useState } from 'react'
import {
  X, Send, Mic, MicOff, ImagePlus, Sparkles, Volume2, Trash2, Loader2,
  Plus, MessageSquare, ImageIcon, Bot,
} from 'lucide-react'
import { api, uploadFile } from '@/lib/callapp/api'
import { useApp } from '@/lib/callapp/store'
import { CallLogoMark } from './CallLogo'
import type { AiConversationItem, AiMsg } from '@/lib/callapp/types'

/** CALL AI assistant: text, voice (ASR + TTS), image analysis & generation, history. */
export function AiScreen({ onClose }: { onClose: () => void }) {
  const [conversations, setConversations] = useState<AiConversationItem[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<AiMsg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [usage, setUsage] = useState<{ text: number; limits: { text: number; voiceReplies: boolean; imageGen: boolean } } | null>(null)
  const [imageMode, setImageMode] = useState<'ask' | 'generate'>('ask')
  const [attachedImage, setAttachedImage] = useState<{ id: string; preview: string } | null>(null)
  const [ttsOn, setTtsOn] = useState(true)
  const [listening, setListening] = useState(false)
  const chatEnd = useRef<HTMLDivElement>(null)
  const recRef = useRef<MediaRecorder | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void api.aiUsage().then((res) => setUsage({ text: res.usage.text, limits: res.limits })).catch(() => {})
    void loadConversations()
  }, [])

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const loadConversations = async () => {
    try {
      const res = await api.aiConversations()
      setConversations(res.conversations)
    } catch {}
  }

  const openConversation = async (id: string) => {
    setActiveId(id)
    try {
      const res = await api.aiConversation(id)
      setMessages(res.conversation.messages)
    } catch {}
  }

  const newConversation = () => {
    setActiveId(null)
    setMessages([])
  }

  const speak = async (text: string) => {
    if (!ttsOn) return
    try {
      const res = await api.aiSpeak(text.slice(0, 600))
      const { getMediaUrl } = await import('@/lib/callapp/media')
      const url = (await getMediaUrl(res.mediaId)) ?? `/api/media/${res.mediaId}`
      const audio = new Audio(url)
      void audio.play().catch(() => {})
    } catch {}
  }

  const send = async () => {
    const text = input.trim()
    if (!text || busy) return
    setInput('')
    setBusy(true)
    const optimistic: AiMsg = { id: `tmp${Date.now()}`, role: 'user', kind: 'text', text, createdAt: new Date().toISOString() }
    setMessages((m) => [...m, optimistic])
    try {
      if (attachedImage) {
        const res = await api.aiVision(attachedImage.id, text)
        const reply: AiMsg = {
          id: `v${Date.now()}`,
          role: 'assistant',
          kind: 'text',
          text: res.reply,
          createdAt: new Date().toISOString(),
        }
        const imgMsg: AiMsg = { ...optimistic, kind: 'image', mediaUrl: attachedImage.preview, id: `i${Date.now()}` }
        setMessages((m) => [...m.slice(0, -1), imgMsg, reply])
        void speak(res.reply)
        setAttachedImage(null)
      } else {
        const res = await api.aiChat({ conversationId: activeId ?? undefined, text })
        setActiveId(res.conversationId)
        setMessages((m) => [...m.slice(0, -1), res.userMessage, res.reply])
        void speak(res.reply.text)
        setUsage((u) => (u ? { ...u, text: u.text + 1 } : u))
      }
      void loadConversations()
    } catch (e) {
      setMessages((m) => [
        ...m,
        { id: `err${Date.now()}`, role: 'assistant', kind: 'text', text: `⚠️ ${(e as Error).message}`, createdAt: new Date().toISOString() },
      ])
    } finally {
      setBusy(false)
    }
  }

  const generateImage = async () => {
    const prompt = input.trim()
    if (!prompt || busy) return
    setInput('')
    setBusy(true)
    setMessages((m) => [...m, { id: `g${Date.now()}`, role: 'user', kind: 'text', text: `🎨 Generate: ${prompt}`, createdAt: new Date().toISOString() }])
    try {
      const res = await api.aiImage({ prompt, conversationId: activeId ?? undefined })
      setActiveId(res.conversationId ?? activeId)
      setMessages((m) => [
        ...m,
        { id: `gi${Date.now()}`, role: 'assistant', kind: 'image', text: prompt, mediaUrl: res.url, createdAt: new Date().toISOString() },
      ])
      void loadConversations()
    } catch (e) {
      setMessages((m) => [...m, { id: `gerr${Date.now()}`, role: 'assistant', kind: 'text', text: `⚠️ ${(e as Error).message}`, createdAt: new Date().toISOString() }])
    } finally {
      setBusy(false)
    }
  }

  const toggleListening = async () => {
    if (listening) {
      recRef.current?.stop()
      setListening(false)
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec = new MediaRecorder(stream)
      const chunks: Blob[] = []
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunks, { type: 'audio/webm' })
        setBusy(true)
        try {
          const res = await api.aiTranscribe(blob)
          if (res.text) {
            setInput(res.text)
          } else {
            setInput('')
          }
        } catch {
          setInput('')
        } finally {
          setBusy(false)
        }
      }
      recRef.current = rec
      rec.start()
      setListening(true)
      window.setTimeout(() => {
        if (recRef.current?.state === 'recording') {
          recRef.current.stop()
          setListening(false)
        }
      }, 8000)
    } catch {
      alert('Microphone permission needed')
    }
  }

  const onPickImage = async (file: File) => {
    try {
      const up = await uploadFile(file, 'image.jpg', 'media')
      setAttachedImage({ id: up.id, preview: URL.createObjectURL(file) })
      setImageMode('ask')
    } catch {
      alert('Upload failed')
    }
  }

  const deleteConversation = async (id: string) => {
    try {
      await api.aiDeleteConversation(id)
      if (activeId === id) newConversation()
      void loadConversations()
    } catch {}
  }

  return (
    <div className="fixed inset-0 z-[85] flex flex-col bg-white">
      {/* header */}
      <header className="flex items-center gap-3 border-b border-cline px-4 py-3.5">
        <button className="rounded-full bg-cbg p-2 text-cmut hover:text-cbrand" onClick={onClose} aria-label="Close CALL AI">
          <X size={20} />
        </button>
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-grad text-white">
          <CallLogoMark size={22} />
        </span>
        <div className="flex-1">
          <h2 className="text-[16px] font-extrabold text-cink">CALL Assistant</h2>
          <p className="text-[11px] text-cmut">
            {usage ? `${usage.text}/${usage.limits.text} messages today` : 'Your AI companion'}
          </p>
        </div>
        <button
          className={`rounded-full px-3 py-2 text-[11px] font-bold ${ttsOn ? 'bg-csoft text-cbrand' : 'bg-cbg text-cmut'}`}
          onClick={() => setTtsOn((v) => !v)}
          title="Toggle spoken replies"
        >
          <Volume2 size={14} className="mr-1 inline" /> {ttsOn ? 'Voice on' : 'Voice off'}
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* history sidebar (desktop) */}
        <aside className="hidden w-[260px] shrink-0 flex-col border-r border-cline md:flex">
          <button className="mx-3 mt-3 flex h-11 items-center justify-center gap-2 rounded-[14px] bg-cbrand text-sm font-bold text-white" onClick={newConversation}>
            <Plus size={16} /> New conversation
          </button>
          <div className="app-scroll flex-1 overflow-y-auto p-3">
            {conversations.map((c) => (
              <div
                key={c.id}
                className={`group flex items-center gap-2 rounded-xl px-2.5 py-2 ${activeId === c.id ? 'bg-csoft' : 'hover:bg-cbg'}`}
              >
                <button className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => void openConversation(c.id)}>
                  <MessageSquare size={15} className="flex-none text-cmut" />
                  <span className="truncate text-[13px] font-semibold text-cink">{c.title}</span>
                </button>
                <button className="text-cmut opacity-0 transition group-hover:opacity-100" onClick={() => void deleteConversation(c.id)} aria-label="Delete conversation">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {conversations.length === 0 && <p className="pt-6 text-center text-[12px] text-cmut">No history yet</p>}
          </div>
        </aside>

        {/* chat area */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="app-scroll flex-1 overflow-y-auto px-4 py-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center pt-10 text-center">
                <div className="bob-anim">
                  <CallLogoMark size={64} />
                </div>
                <h3 className="pt-4 text-xl font-extrabold text-cink">Salam! I&apos;m CALL 🤖</h3>
                <p className="mt-2 max-w-sm text-sm text-cmut">
                  Ask me anything, get writing help, translate text, analyze images, or generate images.
                  Tap the mic to talk to me — I reply out loud.
                </p>
                <div className="mt-5 grid w-full max-w-md grid-cols-2 gap-2">
                  {['Translate "Good morning" to Urdu', 'Write a birthday caption', 'Suggest a story idea', 'Summarize my day plan'].map((s) => (
                    <button
                      key={s}
                      className="rounded-[14px] border border-cline px-3 py-2.5 text-left text-[12px] font-semibold text-cink hover:border-cbrand hover:bg-csoft"
                      onClick={() => setInput(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <button className="mt-4 text-[12px] font-semibold text-cbrand underline md:hidden" onClick={loadConversations}>
                  View conversation history
                </button>
              </div>
            )}
            {messages.map((m) => (
              <div key={m.id} className={`mb-3 flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.role === 'assistant' && m.kind === 'text' && (
                  <span className="mr-2 mt-1 flex h-8 w-8 flex-none items-center justify-center rounded-full bg-brand-grad text-white">
                    <CallLogoMark size={16} />
                  </span>
                )}
                <div
                  className={`max-w-[80%] rounded-[18px] px-4 py-2.5 text-[14px] leading-relaxed ${
                    m.role === 'user' ? 'bg-cbrand text-white' : 'bg-cbg text-cink'
                  }`}
                >
                  {m.kind === 'image' && m.mediaUrl ? (
                    <img src={m.mediaUrl} alt={m.text || 'AI image'} className="mb-1 max-h-64 rounded-xl" />
                  ) : null}
                  <span className="whitespace-pre-wrap">{m.text}</span>
                </div>
              </div>
            ))}
            {busy && (
              <div className="mb-3 flex justify-start">
                <span className="mr-2 mt-1 flex h-8 w-8 flex-none items-center justify-center rounded-full bg-brand-grad text-white">
                  <Bot size={15} />
                </span>
                <div className="rounded-[18px] bg-cbg px-4 py-3">
                  <Loader2 className="animate-spin text-cbrand" size={16} />
                </div>
              </div>
            )}
            <div ref={chatEnd} />
          </div>

          {/* composer */}
          <div className="border-t border-cline px-4 py-3">
            {attachedImage && (
              <div className="flex items-center gap-2 pb-2">
                <img src={attachedImage.preview} alt="Attached" className="h-12 w-12 rounded-lg object-cover" />
                <span className="text-[12px] text-cmut">Image attached — ask anything about it</span>
                <button className="ml-auto text-cmut" onClick={() => setAttachedImage(null)}>
                  <X size={16} />
                </button>
              </div>
            )}
            <div className="flex items-center gap-2">
              <button
                className={`flex h-11 w-11 flex-none items-center justify-center rounded-full ${listening ? 'bg-red-500 text-white animate-pulse' : 'bg-csoft text-cbrand'}`}
                onClick={() => void toggleListening()}
                title={listening ? 'Stop & transcribe' : 'Talk to CALL'}
              >
                {listening ? <MicOff size={18} /> : <Mic size={18} />}
              </button>
              <button className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-csoft text-cbrand" onClick={() => fileRef.current?.click()} title="Attach image">
                <ImagePlus size={18} />
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && void onPickImage(e.target.files[0])}
              />
              <input
                className="h-11 min-w-0 flex-1 rounded-full bg-[#F0F3FA] px-4 text-[15px] text-cink outline-none placeholder:text-[#7A8499]"
                placeholder={imageMode === 'generate' ? 'Describe the image to generate…' : attachedImage ? 'Ask about this image…' : 'Message CALL…'}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void (imageMode === 'generate' ? generateImage() : send())}
              />
              {usage?.limits.imageGen && (
                <button
                  className={`flex h-11 w-11 flex-none items-center justify-center rounded-full ${imageMode === 'generate' ? 'bg-[#7B3FE4] text-white' : 'bg-csoft text-cbrand'}`}
                  onClick={() => setImageMode((m) => (m === 'generate' ? 'ask' : 'generate'))}
                  title={imageMode === 'generate' ? 'Switch to chat' : 'Switch to image generation'}
                >
                  <ImageIcon size={18} />
                </button>
              )}
              <button
                className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-cbrand text-white"
                disabled={busy || !input.trim()}
                onClick={() => void (imageMode === 'generate' ? generateImage() : send())}
              >
                <Send size={18} />
              </button>
            </div>
            <p className="pt-1.5 text-center text-[10px] text-cmut">
              {imageMode === 'generate' ? '🎨 Image generation mode — press send to create' : 'CALL AI can make mistakes. Verify important info.'}
            </p>
          </div>
        </div>
      </div>

      {/* mobile history sheet */}
      {conversations.length > 0 && (
        <button
          className="fixed bottom-28 left-4 z-10 flex items-center gap-1.5 rounded-full bg-white/95 px-4 py-2.5 text-[12px] font-bold text-cink shadow-lg ring-1 ring-cline md:hidden"
          onClick={() => void openConversation(conversations[0].id)}
        >
          <Sparkles size={13} className="text-cbrand" /> Recent: {conversations[0].title.slice(0, 20)}
        </button>
      )}
    </div>
  )
}
