'use client'

import { useEffect, useRef, useState } from 'react'
import { api } from '@/lib/callapp/api'
import { soundKit } from '@/lib/callapp/sound'
import { useApp } from '@/lib/callapp/store'
import type { GiftItem, GiftSendResult } from '@/lib/callapp/types'

/* ================= gift animation overlay ================= */

export interface GiftAnim {
  key: number
  emoji: string
  name: string
  animKind: string
  from: string
  to: string
  durationMs: number
  tier: number
}

export function GiftAnimationLayer({ gifts }: { gifts: GiftAnim[] }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-40 overflow-hidden" aria-live="polite">
      {gifts.map((g) => (
        <GiftAnimCard key={g.key} gift={g} />
      ))}
    </div>
  )
}

const ANIM_CLASSES: Record<string, string> = {
  rose: 'gift-float',
  heart: 'gift-float',
  flower: 'gift-float',
  crown: 'gift-drop',
  diamond: 'gift-drop',
  car: 'gift-drive',
  rocket: 'gift-rocket',
  dragon: 'gift-fly',
  lion: 'gift-fly',
  superlion: 'gift-fly-big',
  fireworks: 'gift-burst',
  castle: 'gift-fly-big',
  generic: 'gift-float',
}

function GiftAnimCard({ gift }: { gift: GiftAnim }) {
  const cls = ANIM_CLASSES[gift.animKind] ?? 'gift-float'
  const big = gift.tier >= 3
  return (
    <div className={`absolute ${cls}`} style={{ left: gift.animKind === 'fireworks' ? '50%' : `${12 + ((gift.key * 13) % 60)}%`, bottom: 80 }}>
      <div
        className={`flex flex-col items-center gap-1 rounded-2xl bg-black/70 px-4 py-3 text-white backdrop-blur ${big ? 'scale-125' : ''}`}
        style={{ animationDuration: `${gift.durationMs}ms` }}
      >
        <span className={big ? 'text-[52px]' : 'text-[38px]'}>{gift.emoji}</span>
        <span className="text-xs font-bold">{gift.name}</span>
        <span className="text-[10px] text-white/80">
          {gift.from} → {gift.to}
        </span>
      </div>
    </div>
  )
}

/* ================= gift picker sheet ================= */

export function GiftPickerSheet({
  context,
  recipientId,
  recipientName,
  extra,
  onSent,
  onClose,
}: {
  context: 'room' | 'live' | 'battle'
  recipientId: string
  recipientName: string
  extra?: { roomId?: string; liveId?: string; battleId?: string; battleSide?: number }
  onSent: (res: GiftSendResult) => void
  onClose: () => void
}) {
  const me = useApp((s) => s.me)
  const wallet = useApp((s) => s.wallet)
  const loadWallet = useApp((s) => s.loadWallet)
  const [gifts, setGifts] = useState<GiftItem[]>([])
  const [sending, setSending] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [recipient, setRecipient] = useState({ id: recipientId, name: recipientName })

  useEffect(() => {
    setRecipient({ id: recipientId, name: recipientName })
  }, [recipientId, recipientName])

  useEffect(() => {
    void api
      .gifts(context === 'battle' ? 'live' : context)
      .then((res) => setGifts(res.gifts))
      .catch(() => setError('Could not load gifts'))
    if (!wallet) void loadWallet()
  }, [context, wallet, loadWallet])

  const send = async (gift: GiftItem) => {
    if (!me) return
    setSending(gift.id)
    setError('')
    try {
      const res = await api.sendGift({
        giftId: gift.id,
        toUserId: recipient.id,
        context,
        roomId: extra?.roomId,
        liveId: extra?.liveId,
        battleId: extra?.battleId,
        battleSide: extra?.battleSide,
        idempotencyKey: `gift:${me.id}:${gift.id}:${Date.now()}:${Math.random().toString(36).slice(2, 6)}`,
      })
      soundKit.gift(Math.min(3, Math.floor(gift.priceCoins / 500)))
      onSent(res)
      void loadWallet()
      onClose()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSending(null)
    }
  }

  return (
    <div className="absolute inset-0 z-50 flex flex-col justify-end bg-black/40" onClick={onClose}>
      <div
        className="rounded-t-[24px] border-t border-cline bg-white p-4 pb-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Send a gift"
      >
        <div className="flex items-center gap-3 pb-3">
          <h3 className="flex-1 text-[16px] font-extrabold text-cink">
            Send a gift to <span className="text-cbrand">{recipient.name}</span>
          </h3>
          <div className="flex items-center gap-1.5 rounded-full bg-[#F0F3FA] px-3 py-1.5 text-[13px] font-bold text-cink">
            🪙 {wallet?.coins ?? 0}
          </div>
          <button className="rounded-full bg-cbg px-3 py-1.5 text-xs font-bold text-cmut" onClick={onClose}>
            ✕
          </button>
        </div>
        {error && <p className="pb-2 text-[12px] font-semibold text-cred">{error}</p>}
        <div className="grid max-h-[300px] grid-cols-4 gap-2 overflow-y-auto app-scroll">
          {gifts.map((g) => (
            <button
              key={g.id}
              className="flex flex-col items-center gap-1 rounded-[14px] border border-cline bg-white px-1 py-2.5 transition hover:border-cbrand hover:bg-csoft disabled:opacity-50"
              disabled={sending === g.id || (wallet?.coins ?? 0) < g.priceCoins}
              onClick={() => void send(g)}
            >
              <span className="text-[26px]">{g.emoji}</span>
              <span className="text-[10px] font-bold text-cink">{g.name}</span>
              <span className="rounded-full bg-[#FFF3D6] px-1.5 py-0.5 text-[10px] font-bold text-[#B7791F]">🪙 {g.priceCoins}</span>
            </button>
          ))}
        </div>
        <p className="pt-2 text-center text-[10px] text-cmut">
          Recipient earns {`≈50%`} of the gift value as diamonds (admin-configured).
        </p>
      </div>
    </div>
  )
}

/* ================= ad banner (non-intrusive, list screens only) ================= */

export function AdBanner({ placement }: { placement: 'chats' | 'rooms' | 'profile' }) {
  const [ad, setAd] = useState<{ id: string; title: string; body: string; linkUrl: string | null } | null>(null)
  const shown = useRef(false)

  useEffect(() => {
    let cancelled = false
    void api
      .ads(placement)
      .then((res) => {
        if (cancelled) return
        if (res.enabled && res.ads.length > 0) {
          const pick = res.ads[0]
          setAd(pick)
          if (!shown.current) {
            shown.current = true
            void api.adEvent(pick.id, 'impression').catch(() => {})
          }
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [placement])

  if (!ad) return null
  return (
    <div className="mx-4 my-3 flex items-center gap-3 rounded-[14px] border border-cline bg-[#F7F9FF] px-3.5 py-2.5">
      <span className="rounded-lg bg-csoft px-2 py-1 text-[10px] font-bold text-cbrand">AD</span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-bold text-cink">{ad.title}</div>
        <div className="truncate text-[11px] text-cmut">{ad.body}</div>
      </div>
      {ad.linkUrl && (
        <a
          href={ad.linkUrl}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="rounded-full bg-cbrand px-3 py-1.5 text-[11px] font-bold text-white"
          onClick={() => void api.adEvent(ad.id, 'click').catch(() => {})}
        >
          Open
        </a>
      )}
    </div>
  )
}
