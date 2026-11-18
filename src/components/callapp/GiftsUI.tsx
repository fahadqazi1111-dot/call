'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Gift as GiftIcon, Loader2, ChevronLeft, Users, Sparkles, Info } from 'lucide-react'
import { api } from '@/lib/callapp/api'
import { toast } from 'sonner'
import { Avatar } from './Avatar'
import { PaymentModal, waitForPayment, type PendingPayment } from './PaymentModal'
import type { GiftItem, GiftRecipient } from '@/lib/callapp/types'

export interface GiftAnim {
  key: string
  emoji: string
  name: string
  animKind: string
  from: string
  to: string
  durationMs: number
  tier: number
}

/* ---------------- animation layer (unchanged visuals, money tiers) ---------------- */

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
  castle: 'gift-fly-big',
  fireworks: 'gift-burst',
  generic: 'gift-float',
}

function tierOf(price: number): number {
  if (price >= 30) return 3
  if (price >= 5) return 2
  return 1
}

export function GiftAnimationLayer({ gifts }: { gifts: GiftAnim[] }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-40 overflow-hidden">
      {gifts.map((g) => (
        <div
          key={g.key}
          className={`absolute ${ANIM_CLASSES[g.animKind] ?? 'gift-float'}`}
          style={{ animationDuration: `${g.durationMs}ms` }}
        >
          <div className="flex items-center gap-2 rounded-2xl bg-black/70 px-3 py-2 text-white shadow-xl backdrop-blur">
            <span className={g.tier >= 3 ? 'text-[46px]' : g.tier === 2 ? 'text-[38px]' : 'text-[30px]'}>{g.emoji}</span>
            <div className="leading-tight">
              <div className="text-[12px] font-bold">{g.name}</div>
              <div className="text-[10.5px] text-white/75">{g.from} → {g.to}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

/** Play a delivered gift event (payload from REST fulfillment → socket relay). */
export function animFromPayload(payload: {
  gift: { name: string; emoji: string; animKind: string; durationMs: number; priceUsd?: number }
  from: { name: string }
  to: { name: string }
}): GiftAnim {
  const price = payload.gift.priceUsd ?? 0
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    emoji: payload.gift.emoji,
    name: payload.gift.name,
    animKind: payload.gift.animKind,
    from: payload.from.name,
    to: payload.to.name,
    durationMs: payload.gift.durationMs,
    tier: tierOf(price),
  }
}

export function soundTierFor(price: number): number {
  return Math.min(3, tierOf(price))
}

/* ---------------- TikTok-style gift panel ---------------- */

interface PickerProps {
  context: 'room' | 'live' | 'battle'
  /** Optional pre-selected recipient (e.g. the tile the viewer tapped). Must never be the viewer. */
  preselectedRecipientId?: string
  extra?: { roomId?: string; liveId?: string; battleId?: string; battleSide?: number }
  onSent: (payload: unknown) => void
  onClose: () => void
  /** test-mode flag surfaced by the parent screen (from checkout or parent state) */
}

export function GiftPickerSheet({ context, preselectedRecipientId, extra, onSent, onClose }: PickerProps) {
  const [gifts, setGifts] = useState<GiftItem[]>([])
  const [recipients, setRecipients] = useState<GiftRecipient[]>([])
  const [commission, setCommission] = useState(30)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<GiftItem | null>(null)
  const [recipientId, setRecipientId] = useState<string | null>(preselectedRecipientId ?? null)
  const [checkout, setCheckout] = useState<{ payment: PendingPayment } | null>(null)
  const [busy, setBusy] = useState(false)
  const stage = recipients.length > 1 && !recipientId ? 'recipient' : 'gift'

  useEffect(() => {
    void (async () => {
      try {
        const [g, r] = await Promise.all([
          api.gifts(context === 'battle' ? 'live' : context),
          api.giftRecipients({
            context,
            roomId: extra?.roomId,
            liveId: extra?.liveId,
            battleId: extra?.battleId,
            battleSide: extra?.battleSide,
          }),
        ])
        setGifts(g.gifts)
        setCommission(g.platformCommission ?? 30)
        setRecipients(r.recipients)
        if (r.recipients.length === 1) setRecipientId(r.recipients[0].id)
        if (r.recipients.length === 0) {
          toast.error('No eligible gift recipients right now — only hosts can receive gifts')
          onClose()
        }
      } catch (e) {
        toast.error((e as Error).message || 'Could not load gifts')
        onClose()
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const recipient = useMemo(() => recipients.find((r) => r.id === recipientId) ?? null, [recipients, recipientId])

  const startCheckout = async (gift: GiftItem) => {
    if (!recipientId) {
      setSelected(gift)
      return
    }
    setBusy(true)
    try {
      const res = await api.giftCheckout({
        giftId: gift.id,
        toUserId: recipientId,
        context,
        roomId: extra?.roomId,
        liveId: extra?.liveId,
        battleId: extra?.battleId,
        battleSide: extra?.battleSide,
        clientKey: `gift:${gift.id}:${recipientId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
      })
      if (res.alreadyPaid) {
        toast.success('Gift already delivered')
        onClose()
        return
      }
      if (res.provider === 'stripe' && res.checkoutUrl) {
        toast.loading('Opening secure checkout…', { duration: 2500 })
        window.location.href = res.checkoutUrl
        return
      }
      setCheckout({
        payment: {
          id: res.paymentId,
          amount: res.amount,
          currency: res.currency,
          isTest: res.isTest,
          provider: res.provider,
          description: `${gift.name} for ${recipient?.name ?? 'host'}`,
          emoji: gift.emoji,
        },
      })
    } catch (e) {
      toast.error((e as Error).message || 'Checkout failed')
    } finally {
      setBusy(false)
    }
  }

  const onPaid = async (payment: PendingPayment) => {
    // fetch fulfillment status; animation arrives via socket relay for everyone
    const final = await waitForPayment(payment.id, 8000)
    if (final?.status === 'successful') {
      const gift = selected
      if (gift && recipient) {
        onSent({
          ok: true,
          sendId: final.id,
          gift: { name: gift.name, emoji: gift.emoji, animKind: gift.animKind, sound: gift.sound, durationMs: gift.durationMs, priceUsd: gift.priceUsd },
          from: { id: 'me', name: 'You', avatarKey: 0, avatarUrl: null },
          to: { id: recipient.id, name: recipient.name, avatarKey: recipient.avatarKey, avatarUrl: recipient.avatarUrl },
          battle: null,
        })
      }
      toast.success(`Gift delivered to ${recipient?.name ?? 'host'}`)
      setCheckout(null)
      onClose()
    } else {
      toast.error('Payment is still processing — it will complete automatically')
      setCheckout(null)
      onClose()
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50" onClick={onClose} role="dialog" aria-modal="true" aria-label="Send a gift">
        <div
          className="w-full max-w-[560px] rounded-t-[24px] bg-white pb-[max(env(safe-area-inset-bottom),14px)] shadow-2xl sm:mb-4 sm:rounded-[24px]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* header */}
          <div className="flex items-center justify-between border-b border-cline px-4 py-3">
            <div className="flex items-center gap-2">
              {stage === 'recipient' ? (
                <button
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-csoft text-cink"
                  onClick={() => setRecipientId(null)}
                  aria-label="Back to gifts"
                >
                  <ChevronLeft size={17} />
                </button>
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FFF0F3] text-[#E1306C]">
                  <GiftIcon size={16} />
                </span>
              )}
              <div>
                <div className="text-[14.5px] font-extrabold text-cink">{stage === 'recipient' ? 'Choose a recipient' : 'Send a gift'}</div>
                <div className="text-[11px] text-cmut">Direct payment · no coins</div>
              </div>
            </div>
            <button onClick={onClose} aria-label="Close" className="text-[12.5px] font-bold text-cmut hover:text-cink">
              Close
            </button>
          </div>

          {/* recipient strip (context) */}
          {stage === 'gift' && recipients.length > 0 && (
            <button
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left transition hover:bg-cbg"
              onClick={() => recipients.length > 1 && setRecipientId(null)}
            >
              <Users size={14} className="flex-none text-cmut" />
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-bold uppercase tracking-wide text-cmut">Gift goes to</div>
                <div className="truncate text-[13.5px] font-bold text-cink">{recipient?.name ?? 'Select a host'}</div>
              </div>
              {recipients.length > 1 && <span className="text-[11.5px] font-bold text-cbrand">Change</span>}
            </button>
          )}

          {loading ? (
            <div className="flex h-44 items-center justify-center text-cmut">
              <Loader2 size={22} className="animate-spin" />
            </div>
          ) : stage === 'recipient' ? (
            /* ---- recipient selection ---- */
            <ul className="max-h-[300px] overflow-y-auto app-scroll px-3 py-2">
              {recipients.map((r) => (
                <li key={r.id}>
                  <button
                    className="flex w-full items-center gap-3 rounded-2xl px-2.5 py-2.5 text-left transition hover:bg-cbg"
                    onClick={() => {
                      setRecipientId(r.id)
                      if (selected) void startCheckout(selected)
                    }}
                  >
                    <Avatar name={r.name} avatarKey={r.avatarKey} size={42} src={r.avatarUrl} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14px] font-bold text-cink">{r.name}</div>
                      <div className="text-[11px] text-cmut">
                        {r.role === 'host' ? 'Host' : r.role === 'cohost' ? 'Co-host' : `Battle team ${r.side === 0 ? 'A' : 'B'}`}
                        {r.role === 'battle' && r.score > 0 ? ` · $${r.score.toFixed(2)} scored` : ''}
                      </div>
                    </div>
                    <span className="rounded-full bg-csoft px-2.5 py-1 text-[11px] font-bold text-cbrand">Select</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            /* ---- gift grid (money prices) ---- */
            <div className="px-4 pb-2 pt-2">
              <div className="grid max-h-[300px] grid-cols-4 gap-2 overflow-y-auto app-scroll">
                {gifts.map((g) => (
                  <button
                    key={g.id}
                    className={`flex flex-col items-center gap-1 rounded-[14px] border px-1 py-2.5 transition hover:border-[#E1306C] hover:bg-[#FFF0F3] ${
                      selected?.id === g.id ? 'border-[#E1306C] bg-[#FFF0F3]' : 'border-cline bg-white'
                    }`}
                    disabled={busy}
                    onClick={() => {
                      setSelected(g)
                      void startCheckout(g)
                    }}
                  >
                    <span className={g.priceUsd >= 10 ? 'text-[30px]' : 'text-[26px]'}>{g.emoji}</span>
                    <span className="max-w-full truncate text-[10px] font-bold text-cink">{g.name}</span>
                    <span className="rounded-full bg-[#FFE8EE] px-1.5 py-0.5 text-[10px] font-extrabold text-[#D6336C]">
                      ${g.priceUsd.toFixed(2)}
                    </span>
                  </button>
                ))}
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-[11px] text-cmut">
                <Info size={12} className="flex-none" />
                The host earns ≈{100 - commission}% after commission and processing fees — credited the moment your
                payment is verified.
              </div>
            </div>
          )}
        </div>
      </div>

      {checkout && <PaymentModal payment={checkout.payment} onPaid={() => void onPaid(checkout.payment)} onClose={() => setCheckout(null)} />}
    </>
  )
}


/* ---------------- ad banner (placements) ---------------- */

export function AdBanner({ placement }: { placement: 'chats' | 'rooms' | 'profile' }) {
  const [ad, setAd] = useState<{ id: string; title: string; body: string; linkUrl: string | null } | null>(null)
  const firedRef = useRef(false)

  useEffect(() => {
    void (async () => {
      try {
        const res = await api.ads(placement)
        if (res.ads.length) setAd(res.ads[0])
      } catch {}
    })()
  }, [placement])

  useEffect(() => {
    if (ad && !firedRef.current) {
      firedRef.current = true
      void api.adEvent(ad.id, 'impression').catch(() => {})
    }
  }, [ad])

  if (!ad) return null
  return (
    <button
      className="mx-2 mb-2 flex items-center gap-3 rounded-[18px] border border-cline bg-white px-3.5 py-3 text-left transition hover:bg-cbg"
      onClick={() => {
        if (ad.linkUrl) window.open(ad.linkUrl, '_blank', 'noopener')
        void api.adEvent(ad.id, 'click').catch(() => {})
      }}
    >
      <span className="rounded-md bg-[#E7EEFF] px-1.5 py-0.5 text-[9px] font-extrabold tracking-wide text-cbrand">AD</span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-bold text-cink">{ad.title}</div>
        {ad.body && <div className="truncate text-[11.5px] text-cmut">{ad.body}</div>}
      </div>
      <Sparkles size={15} className="flex-none text-cmut" />
    </button>
  )
}
