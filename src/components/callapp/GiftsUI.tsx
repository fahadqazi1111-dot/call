'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Gift as GiftIcon, Loader2, ChevronLeft, Users, Sparkles, Info, Megaphone, ExternalLink, X } from 'lucide-react'
import { api } from '@/lib/callapp/api'
import { adViewerKey } from '@/lib/callapp/utils'
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

/* ---------------- animation layer (per-gift cinematic scenes) ---------------- */

function tierOf(price: number): number {
  if (price >= 30) return 3
  if (price >= 5) return 2
  return 1
}

/** deterministic pseudo-random per gift instance, so server & client layouts differ nicely */
function seeded(n: number): number {
  const x = Math.sin(n) * 10000
  return x - Math.floor(x)
}

function GiftLabel({ g }: { g: GiftAnim }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl bg-black/70 px-3 py-2 text-white shadow-xl backdrop-blur">
      <span className={g.tier >= 3 ? 'text-[34px]' : g.tier === 2 ? 'text-[28px]' : 'text-[22px]'}>{g.emoji}</span>
      <div className="leading-tight">
        <div className="text-[12px] font-bold">{g.name}</div>
        <div className="text-[10.5px] text-white/75">{g.from} → {g.to}</div>
      </div>
    </div>
  )
}

/** Build the per-gift animation scene. Each gift gets its own choreography. */
function GiftScene({ g }: { g: GiftAnim }) {
  const kind = g.animKind
  const emojiSize = g.tier >= 3 ? 'text-[92px]' : g.tier === 2 ? 'text-[74px]' : 'text-[58px]'

  // small helpers for particle fields
  const parts = (n: number) => Array.from({ length: n }, (_, i) => i)

  if (kind === 'lion') {
    // powerful roar: big lion scaling in + double shockwave ring + screen shake
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="lion-shake absolute inset-0 flex items-center justify-center">
          <span className={`lion-roar ${emojiSize}`}>{g.emoji}</span>
          <span className="lion-ring absolute h-24 w-24 rounded-full border-4 border-[#FFD166]" style={{ animationDelay: '120ms' }} />
          <span className="lion-ring absolute h-24 w-24 rounded-full border-2 border-[#F59E0B]/70" style={{ animationDelay: '420ms' }} />
        </div>
        <div className="absolute bottom-[34%]"><GiftLabel g={g} /></div>
      </div>
    )
  }

  if (kind === 'dragon') {
    // dragon flies across with a fire trail
    return (
      <div className="absolute inset-0">
        <div className="dragon-fly absolute left-0 top-[30%]">
          <span className={emojiSize}>{g.emoji}</span>
        </div>
        {parts(10).map((i) => (
          <span
            key={i}
            className="dragon-fire absolute text-[22px]"
            style={{
              top: `${26 + seeded(i + 1) * 16}%`,
              left: `${seeded(i + 7) * 80}%`,
              animationDelay: `${180 + i * 140}ms`,
            }}
          >
            {['🔥', '🔥', '💨'][i % 3]}
          </span>
        ))}
        <div className="absolute bottom-[16%] left-1/2 -translate-x-1/2"><GiftLabel g={g} /></div>
      </div>
    )
  }

  if (kind === 'rocket') {
    // launch from bottom with flame + smoke
    return (
      <div className="absolute inset-0">
        <div className="rocket-launch absolute bottom-[-80px] left-1/2 -translate-x-1/2">
          <span className={emojiSize}>{g.emoji}</span>
        </div>
        {parts(8).map((i) => (
          <span
            key={i}
            className="rocket-smoke absolute text-[20px]"
            style={{ left: `${42 + seeded(i + 3) * 16}%`, animationDelay: `${i * 130}ms` }}
          >
            💨
          </span>
        ))}
        <div className="absolute bottom-[18%] left-1/2 -translate-x-1/2"><GiftLabel g={g} /></div>
      </div>
    )
  }

  if (kind === 'fireworks') {
    // center burst with radiating particles
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        {parts(14).map((i) => (
          <span
            key={i}
            className="fw-burst absolute text-[26px]"
            style={{
              // @ts-expect-error css custom property
              '--a': `${(i / 14) * 360}deg`,
              '--d': `${60 + seeded(i + 2) * 90}px`,
              animationDelay: `${seeded(i) * 160}ms`,
            }}
          >
            {['✨', '🌟', '💥', '🎆'][i % 4]}
          </span>
        ))}
        <span className={`fw-core ${emojiSize}`}>{g.emoji}</span>
        <div className="absolute bottom-[30%]"><GiftLabel g={g} /></div>
      </div>
    )
  }

  if (kind === 'crown') {
    // drops from the top with rotating glow rays
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="crown-rays absolute h-56 w-56 rounded-full" />
        <span className={`crown-drop ${emojiSize}`}>{g.emoji}</span>
        {parts(8).map((i) => (
          <span
            key={i}
            className="crown-sparkle absolute text-[16px]"
            style={{ left: `${28 + seeded(i + 4) * 44}%`, top: `${30 + seeded(i + 9) * 24}%`, animationDelay: `${i * 110}ms` }}
          >
            ✨
          </span>
        ))}
        <div className="absolute bottom-[30%]"><GiftLabel g={g} /></div>
      </div>
    )
  }

  if (kind === 'car') {
    // drives across with speed lines
    return (
      <div className="absolute inset-0">
        <div className="car-drive absolute bottom-[26%] left-0">
          <span className={emojiSize}>{g.emoji}</span>
        </div>
        {parts(6).map((i) => (
          <span
            key={i}
            className="speed-line absolute h-[3px] rounded-full bg-white/60"
            style={{ top: `${30 + seeded(i + 5) * 14}%`, width: `${40 + seeded(i) * 60}px`, animationDelay: `${i * 90}ms` }}
          />
        ))}
        <div className="absolute bottom-[12%] left-1/2 -translate-x-1/2"><GiftLabel g={g} /></div>
      </div>
    )
  }

  if (kind === 'heart') {
    // pulsing heart + rising mini hearts
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`heart-pulse ${emojiSize}`}>{g.emoji}</span>
        {parts(9).map((i) => (
          <span
            key={i}
            className="heart-rise absolute text-[20px]"
            style={{ left: `${16 + seeded(i + 6) * 68}%`, animationDelay: `${200 + i * 170}ms` }}
          >
            {['❤️', '💖', '💕'][i % 3]}
          </span>
        ))}
        <div className="absolute bottom-[28%]"><GiftLabel g={g} /></div>
      </div>
    )
  }

  if (kind === 'rose' || kind === 'flower') {
    // bloom in the center + falling petals
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`bloom-in ${emojiSize}`}>{g.emoji}</span>
        {parts(10).map((i) => (
          <span
            key={i}
            className="petal-fall absolute text-[18px]"
            style={{
              left: `${12 + seeded(i + 1) * 76}%`,
              animationDelay: `${140 + i * 150}ms`,
              animationDuration: `${1500 + seeded(i) * 900}ms`,
            }}
          >
            {['🌸', '🌺', '🌷', '🌹'][i % 4]}
          </span>
        ))}
        <div className="absolute bottom-[26%]"><GiftLabel g={g} /></div>
      </div>
    )
  }

  if (kind === 'castle') {
    // epic entrance + sparkles
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`castle-in ${emojiSize}`}>{g.emoji}</span>
        {parts(12).map((i) => (
          <span
            key={i}
            className="castle-sparkle absolute text-[15px]"
            style={{ left: `${14 + seeded(i + 2) * 72}%`, top: `${20 + seeded(i + 8) * 45}%`, animationDelay: `${i * 90}ms` }}
          >
            ✨
          </span>
        ))}
        <div className="absolute bottom-[24%]"><GiftLabel g={g} /></div>
      </div>
    )
  }

  if (kind === 'superlion') {
    // cosmic version: starburst + colossal emoji
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        {parts(16).map((i) => (
          <span
            key={i}
            className="fw-burst absolute text-[20px]"
            style={{
              // @ts-expect-error css custom property
              '--a': `${(i / 16) * 360}deg`,
              '--d': `${100 + seeded(i + 3) * 120}px`,
              animationDelay: `${seeded(i) * 200}ms`,
            }}
          >
            ⭐
          </span>
        ))}
        <span className={`lion-roar ${emojiSize}`}>{g.emoji}</span>
        <div className="absolute bottom-[30%]"><GiftLabel g={g} /></div>
      </div>
    )
  }

  // generic fallback: elegant float-up
  return (
    <div className="absolute inset-0">
      <div className="gift-float absolute left-1/2 top-[38%] -translate-x-1/2">
        <GiftLabel g={g} />
      </div>
    </div>
  )
}

export function GiftAnimationLayer({ gifts }: { gifts: GiftAnim[] }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-40 overflow-hidden">
      {gifts.map((g) => (
        <div key={g.key} className="absolute inset-0" style={{ animationDuration: `${g.durationMs}ms` }}>
          <GiftScene g={g} />
        </div>
      ))}
    </div>
  )
}

/** Play a delivered gift event (payload from REST fulfillment → socket relay). */
export function animFromPayload(payload: {
  sendId?: string
  gift: { name: string; emoji: string; animKind: string; durationMs: number; priceUsd?: number }
  from: { name: string }
  to: { name: string }
}): GiftAnim {
  const price = payload.gift.priceUsd ?? 0
  return {
    // key by the verified transaction id → duplicate events never re-render
    key: payload.sendId || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
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

/* ---------------- gift panel ---------------- */

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


/* ---------------- ads (serving) ---------------- */

interface ServedAd {
  id: string
  title: string
  body: string
  imageUrl: string | null
  linkUrl: string | null
}
export type { ServedAd }

/** Fetch one rotated ad for a placement (excluding ads already on screen). */
async function fetchAd(placement: string, exclude: string[] = []): Promise<ServedAd | null> {
  try {
    const res = await api.ads(placement, exclude)
    return res.ads[0] ?? null
  } catch {
    return null
  }
}

/** Count a click-through and open the advertiser's website in a new tab. */
function openAdTarget(ad: ServedAd) {
  if (!ad.linkUrl) return
  void api.adEvent(ad.id, 'click', adViewerKey()).catch(() => {})
  window.open(ad.linkUrl, '_blank', 'noopener')
}

/**
 * Distinct ad icon — a gradient megaphone badge with a tiny "AD" tag.
 * Clearly different from profile avatars and from the old plain square,
 * so sponsored content is instantly recognisable everywhere.
 */
function AdGlyph({ size = 20, box = 'h-11 w-11' }: { size?: number; box?: string }) {
  return (
    <span className={`relative flex ${box} flex-none items-center justify-center rounded-xl bg-brand-grad text-white shadow-sm`}>
      <Megaphone size={size} strokeWidth={2.4} />
      <span className="absolute -right-1.5 -top-1.5 rounded-full bg-white px-1 text-[7.5px] font-black leading-[13px] tracking-wider text-cbrand ring-1 ring-cline">
        AD
      </span>
    </span>
  )
}

/**
 * Full-detail ad popup — artwork, name, complete description and a visit
 * button. Opens when an ad card is tapped; the small external-link icon on
 * the card bypasses this popup and goes straight to the target website.
 */
export function AdDetailModal({ ad, onClose }: { ad: ServedAd; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  let host = ''
  if (ad.linkUrl) {
    try {
      host = new URL(ad.linkUrl).hostname.replace(/^www\./, '')
    } catch {
      host = ''
    }
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/55 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Sponsored: ${ad.title}`}
    >
      <div
        className="w-full max-w-[400px] overflow-hidden rounded-[26px] bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* artwork — the ad image is shown large here */}
        <div className="relative">
          {ad.imageUrl ? (
            <img src={ad.imageUrl} alt={ad.title} className="h-48 w-full object-cover" />
          ) : (
            <div className="flex h-44 w-full items-center justify-center bg-brand-grad">
              <Megaphone size={52} className="text-white/90" strokeWidth={1.6} />
            </div>
          )}
          <button
            type="button"
            aria-label="Close"
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur transition hover:bg-black/55"
            onClick={onClose}
          >
            <X size={17} />
          </button>
          <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[9.5px] font-black uppercase tracking-widest text-cbrand shadow">
            <Megaphone size={10} /> Sponsored
          </span>
        </div>

        {/* info */}
        <div className="px-5 pb-5 pt-4">
          <h3 className="text-[17px] font-extrabold leading-snug text-cink">{ad.title}</h3>
          <p className="mt-0.5 text-[10.5px] font-bold uppercase tracking-wider text-[#9AA8C7]">Advertisement</p>
          {ad.body && <p className="mt-3 whitespace-pre-wrap text-[13.5px] leading-[20px] text-[#4A5568]">{ad.body}</p>}
          {ad.linkUrl && (
            <button
              type="button"
              className="btn-p mt-4 flex w-full items-center justify-center gap-2"
              onClick={() => openAdTarget(ad)}
            >
              <ExternalLink size={15} /> Visit {host || 'website'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Ad shown in list screens — auto-rotates every 45s so multiple advertisers
 * share the slot. Tapping the card opens the detail popup; the small
 * external-link icon at the end opens the target website directly.
 */
export function AdBanner({ placement }: { placement: 'chats' | 'rooms' | 'profile' }) {
  const [ad, setAd] = useState<ServedAd | null>(null)
  const [detail, setDetail] = useState(false)
  const [overflows, setOverflows] = useState(false)
  const titleRef = useRef<HTMLDivElement | null>(null)
  const bodyRef = useRef<HTMLDivElement | null>(null)
  const firedRef = useRef<string | null>(null)

  useEffect(() => {
    let alive = true
    const load = async (exclude: string[] = []) => {
      const next = await fetchAd(placement, exclude)
      if (!alive) return
      if (next) setAd(next)
    }
    void load()
    const t = window.setInterval(() => {
      setAd((cur) => {
        void load(cur ? [cur.id] : [])
        return cur
      })
    }, 45_000)
    return () => {
      alive = false
      window.clearInterval(t)
    }
  }, [placement])

  useEffect(() => {
    if (ad && firedRef.current !== ad.id) {
      firedRef.current = ad.id
      void api.adEvent(ad.id, 'impression', adViewerKey()).catch(() => {})
    }
  }, [ad])

  /* detect truncated text so a small "More" badge can hint at the full popup */
  useEffect(() => {
    if (!ad) return
    const check = () => {
      const t = titleRef.current
      const b = bodyRef.current
      const cut =
        !!(t && t.scrollWidth > t.clientWidth + 1) || !!(b && b.scrollWidth > b.clientWidth + 1)
      setOverflows(cut)
    }
    const raf = window.requestAnimationFrame(check)
    const t = window.setTimeout(check, 350)
    return () => {
      window.cancelAnimationFrame(raf)
      window.clearTimeout(t)
    }
  }, [ad])

  if (!ad) return null
  return (
    <>
      <div
        role="button"
        tabIndex={0}
        aria-label={`Sponsored: ${ad.title}. Tap for details.`}
        className="mx-2 mb-2 flex cursor-pointer items-center gap-3 overflow-hidden rounded-[18px] border border-cline bg-white px-3.5 py-2.5 text-left transition hover:bg-cbg"
        onClick={() => setDetail(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setDetail(true)
          }
        }}
      >
        {ad.imageUrl ? (
          <img src={ad.imageUrl} alt="" className="h-11 w-11 flex-none rounded-xl object-cover" />
        ) : (
          <AdGlyph />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="flex-none rounded bg-csoft px-1 py-0.5 text-[8.5px] font-extrabold uppercase tracking-wider text-cmut">
              Sponsored
            </span>
            <div ref={titleRef} className="min-w-0 truncate text-[13px] font-bold text-cink">
              {ad.title}
            </div>
          </div>
          {ad.body && (
            <div ref={bodyRef} className="mt-0.5 min-w-0 truncate text-[11.5px] text-cmut">
              {ad.body}
            </div>
          )}
          {overflows && (
            <span className="mt-1 inline-flex items-center rounded-full bg-[#E7EEFF] px-1.5 py-[1.5px] text-[8.5px] font-extrabold uppercase tracking-wide text-cbrand">
              More
            </span>
          )}
        </div>
        {ad.linkUrl && (
          <button
            type="button"
            aria-label="Open advertiser website"
            title="Open website"
            className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-csoft text-cmut transition hover:bg-[#E7EEFF] hover:text-cbrand"
            onClick={(e) => {
              e.stopPropagation()
              openAdTarget(ad)
            }}
          >
            <ExternalLink size={14} />
          </button>
        )}
      </div>
      {detail && <AdDetailModal ad={ad} onClose={() => setDetail(false)} />}
    </>
  )
}

/**
 * Sponsored card injected INSIDE chat conversations after an admin-configured
 * number of messages. Tapping opens the detail popup; the small icon in the
 * header opens the target website directly. Impressions/clicks are tracked
 * with the same deduped events as every other placement.
 */
export function SponsoredAdCard({ ad }: { ad: ServedAd }) {
  const firedRef = useRef(false)
  const [detail, setDetail] = useState(false)
  useEffect(() => {
    if (!firedRef.current && ad.id) {
      firedRef.current = true
      void api.adEvent(ad.id, 'impression', adViewerKey()).catch(() => {})
    }
  }, [ad.id])
  return (
    <>
      <div className="my-1.5 w-full max-w-[420px] overflow-hidden rounded-[18px] border border-cline bg-white shadow-sm">
        <div className="flex items-center justify-between bg-cbg px-3 py-1.5">
          <span className="text-[9.5px] font-extrabold uppercase tracking-widest text-cmut">Sponsored</span>
          {ad.linkUrl ? (
            <button
              type="button"
              aria-label="Open advertiser website"
              title="Open website"
              className="flex h-6 w-6 items-center justify-center rounded-full text-cmut transition hover:text-cbrand"
              onClick={() => openAdTarget(ad)}
            >
              <ExternalLink size={12} />
            </button>
          ) : (
            <Sparkles size={12} className="text-cmut" />
          )}
        </div>
        <div
          role="button"
          tabIndex={0}
          className="w-full cursor-pointer text-left"
          onClick={() => setDetail(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setDetail(true)
            }
          }}
          aria-label={`Sponsored: ${ad.title}`}
        >
          {ad.imageUrl && (
            <img src={ad.imageUrl} alt={ad.title} className="h-28 w-full object-cover" loading="lazy" />
          )}
          <div className="px-3.5 py-2.5">
            <div className="truncate text-[13.5px] font-extrabold text-cink">{ad.title}</div>
            {ad.body && <div className="mt-0.5 line-clamp-2 text-[12px] leading-[17px] text-cmut">{ad.body}</div>}
            {ad.linkUrl && (
              <span className="mt-2 inline-flex items-center rounded-full bg-csoft px-3 py-1 text-[11px] font-bold text-cbrand">
                Learn more →
              </span>
            )}
          </div>
        </div>
      </div>
      {detail && <AdDetailModal ad={ad} onClose={() => setDetail(false)} />}
    </>
  )
}
