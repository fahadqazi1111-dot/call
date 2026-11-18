'use client'

import { useRef, useState } from 'react'
import { CallLogoMark } from './CallLogo'
import { Avatar } from './Avatar'
import { Mic, Video, Lock, ShieldCheck, Radio, PhoneMissed, Heart } from 'lucide-react'
import { useApp } from '@/lib/callapp/store'
import { useCompactHeight, useIsDesktop, useVeryShortHeight } from './useMediaQuery'

const SLIDE_COUNT = 6

export function OnboardingScreen() {
  const scRef = useRef<HTMLDivElement>(null)
  const [slide, setSlide] = useState(0)
  const setPhase = useApp((s) => s.setPhase)
  const compact = useCompactHeight()
  const veryShort = useVeryShortHeight()
  const isDesktop = useIsDesktop()
  // Landscape phones: scale slides down so they fit without scrolling.
  const scale = veryShort ? (isDesktop ? 0.64 : 0.66) : 1
  const last = slide === SLIDE_COUNT - 1

  const goTo = (n: number) => {
    scRef.current?.scrollTo({ left: n * (scRef.current?.clientWidth || 390), behavior: 'smooth' })
  }

  const onScroll = () => {
    const el = scRef.current
    if (!el) return
    setSlide(Math.min(SLIDE_COUNT - 1, Math.round(el.scrollLeft / (el.clientWidth || 390))))
  }

  return (
    <div className="absolute inset-0 flex flex-col bg-[#F4F7FE]">
      <div className={`absolute right-6 z-20 ${compact ? 'top-10' : 'top-14'}`}>
        <button className="text-sm font-semibold text-cmut" onClick={() => goTo(SLIDE_COUNT - 1)}>
          Skip
        </button>
      </div>
      <div
        ref={scRef}
        onScroll={onScroll}
        className="no-scrollbar flex h-full w-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden"
      >
        <SlideWelcome compact={compact} scale={scale} />
        <SlideCalls compact={compact} scale={scale} />
        <SlideChats compact={compact} scale={scale} />
        <SlideContacts compact={compact} scale={scale} />
        <SlideLive compact={compact} scale={scale} />
        <SlideFinal compact={compact} scale={scale} />
      </div>

      <div className={`absolute bottom-0 left-6 right-6 z-20 ${compact ? 'pb-5' : 'pb-10'}`}>
        <div className={`flex h-1.5 items-center justify-center gap-1.5 ${compact ? 'mb-3.5' : 'mb-6'}`}>
          {Array.from({ length: SLIDE_COUNT }, (_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${i === slide ? 'w-7 bg-cbrand' : 'w-1.5 bg-[#C5CFE6]'}`}
            />
          ))}
        </div>
        {last ? (
          <button className="btn-p w-full" onClick={() => setPhase('auth')}>
            Get started
          </button>
        ) : (
          <button className="btn-p w-full" onClick={() => goTo(slide + 1)}>
            Next
          </button>
        )}
        {last && (
          <p className={`text-center text-xs text-cmut ${compact ? 'mt-2.5' : 'mt-4'}`}>
            By continuing you agree to our Terms &amp; Privacy Policy
          </p>
        )}
      </div>
    </div>
  )
}

/**
 * One full-size slide inside the horizontal pager.
 * - Mobile: content flows from the top with generous spacing.
 * - Tablet/desktop pane: content is vertically centered.
 * - The inner wrapper scrolls vertically as a safety net on very short
 *   screens, but slides are sized so everything normally fits with no
 *   scrolling at all.
 */
function SlideFrame({
  compact,
  scale,
  children,
}: {
  compact: boolean
  scale?: number
  children: React.ReactNode
}) {
  const zoomed = scale !== undefined && scale < 1
  return (
    <div className="relative h-full w-full flex-none snap-center">
      <div className="no-scrollbar h-full w-full overflow-x-hidden overflow-y-auto">
        <div
          className={`flex min-h-full w-full flex-col items-center justify-start ${
            zoomed
              ? 'pb-[124px] min-[768px]:pb-[124px]'
              : compact
                ? 'pb-[104px] min-[768px]:pb-16 min-[768px]:pt-8'
                : 'pb-[150px] min-[768px]:pb-16 min-[768px]:pt-8'
          }`}
        >
          {/* my-auto centers when content is shorter than the pane and
              degrades to top-aligned scrolling when it overflows, so the
              top of a slide can never become unreachable. On extremely
              short viewports (landscape phones) the whole slide scales
              down so it still fits on one screen. */}
          <div
            className="my-auto flex w-full flex-col items-center"
            style={zoomed ? { zoom: scale } : undefined}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

/** Heading + ONE short line — kept intentionally minimal on every slide. */
function SlideText({ compact, title, sub }: { compact: boolean; title: string; sub: string }) {
  return (
    <div
      className={`text-center ${
        compact ? 'mt-6 px-8' : 'mt-12 px-8'
      } min-[768px]:mt-10 min-[768px]:max-w-[480px]`}
    >
      <h1
        className={`font-extrabold leading-tight tracking-tight text-cink ${
          compact ? 'text-[26px]' : 'text-[30px]'
        }`}
      >
        {title}
      </h1>
      <p className={`leading-6 text-cmut ${compact ? 'mt-2 text-[14px]' : 'mt-2.5 text-[15px]'}`}>
        {sub}
      </p>
    </div>
  )
}

/* ============ Slide 1 — Welcome (logo only, nothing else) ============ */
function SlideWelcome({ compact, scale }: { compact: boolean; scale?: number }) {
  return (
    <SlideFrame compact={compact} scale={scale}>
      <div className={`flex flex-col items-center ${compact ? 'mt-24' : 'mt-[130px]'} min-[768px]:mt-0`}>
        <div className="bob-anim flex h-[124px] w-[124px] items-center justify-center rounded-[34px] bg-white shadow-[0_14px_34px_rgba(47,91,234,0.22)]">
          <CallLogoMark size={72} />
        </div>
      </div>
      <SlideText compact={compact} title="Welcome to CALL" sub="One World. One Call." />
    </SlideFrame>
  )
}

/* ============ Slide 2 — HD calls ============ */
function SlideCalls({ compact, scale }: { compact: boolean; scale?: number }) {
  return (
    <SlideFrame compact={compact} scale={scale}>
      <div className={`relative h-[300px] w-[290px] max-[359px]:w-[280px] ${compact ? 'mt-16' : 'mt-[104px]'} min-[768px]:mt-0`}>
        <div className="bg-dark-grad absolute inset-0 flex flex-col items-center rounded-[32px] shadow-[0_14px_34px_rgba(14,23,38,0.14)]">
          <div className={`relative ${compact ? 'mt-9' : 'mt-[48px]'}`}>
            <div className="ring-anim absolute -inset-2 rounded-full border-2 border-[#3D6BFF]" />
            <Avatar name="Ayesha S" avatarKey={0} size={compact ? 88 : 100} />
          </div>
          <div className="mt-5 text-center text-white">
            <div className="text-lg font-bold">Ayesha Siddiqui</div>
            <div className="mt-1 text-[13px] text-[#A9B6D3]">HD video call · 12:08</div>
          </div>
          <div className={`mt-auto flex items-center gap-4 ${compact ? 'mb-5' : 'mb-7'}`}>
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white">
              <Mic size={20} />
            </span>
            <span className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-cred text-white">
              <PhoneMissed size={24} className="rotate-[135deg]" />
            </span>
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white">
              <Video size={20} />
            </span>
          </div>
        </div>
        <div className="bob-anim absolute -right-3 top-3 rounded-2xl rounded-br-sm bg-white px-4 py-3 text-sm font-semibold shadow-[0_14px_34px_rgba(14,23,38,0.14)]">
          Hey! Free to talk?
        </div>
      </div>
      <SlideText
        compact={compact}
        title="Crystal-clear HD calls"
        sub="Free video and voice calls that just work."
      />
    </SlideFrame>
  )
}

/* ============ Slide 3 — Private chats ============ */
function SlideChats({ compact, scale }: { compact: boolean; scale?: number }) {
  return (
    <SlideFrame compact={compact} scale={scale}>
      <div
        className={`flex w-[310px] flex-col rounded-[32px] bg-white shadow-[0_14px_34px_rgba(14,23,38,0.14)] max-[359px]:w-[290px] ${
          compact ? 'mt-16 gap-2.5 p-4' : 'mt-[104px] gap-3 p-6'
        } min-[768px]:mt-0`}
      >
        <div className="rounded-[20px] rounded-bl-md bg-[#F1F4FA] px-4 py-2.5 text-[15px] text-cink">
          Did you see the photos?
        </div>
        <div className="flex items-center gap-3 self-end rounded-[20px] rounded-br-md bg-brand-grad px-3.5 py-2.5 text-white shadow-[0_10px_24px_rgba(47,91,234,0.32)]">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-cbrand">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M7 4.5v15l13-7.5z" />
            </svg>
          </span>
          <div className="flex h-8 items-end gap-[3px]">
            {[9, 18, 12, 24, 15, 8, 20, 11, 17, 7, 22, 13].map((h, i) => (
              <span key={i} className="w-[3px] rounded-sm bg-white" style={{ height: h, opacity: i < 7 ? 1 : 0.35 }} />
            ))}
          </div>
          <span className="text-xs font-semibold opacity-85">0:24</span>
        </div>
        <div className="flex items-center justify-end gap-1.5 pt-1 text-xs font-semibold text-[#067647]">
          <Lock size={15} /> End-to-end encrypted
        </div>
      </div>
      <SlideText
        compact={compact}
        title="Private chats & voice notes"
        sub="Only you and the person you message can read them."
      />
    </SlideFrame>
  )
}

/* ============ Slide 4 — Contacts ============ */
function SlideContacts({ compact, scale }: { compact: boolean; scale?: number }) {
  // x, y, avatar size — valid numeric offsets inside the 300px cluster
  const items = [
    ['AS', 0, 128, 132, 84],
    ['KI', 1, 24, 84, 70],
    ['PN', 2, 226, 80, 70],
    ['VS', 3, 70, 190, 62],
    ['AP', 4, 188, 196, 62],
  ] as const
  return (
    <SlideFrame compact={compact} scale={scale}>
      <div
        className={`relative h-[310px] w-[310px] min-[768px]:mt-0 ${
          compact ? 'mt-10' : 'mt-[84px]'
        } max-[359px]:-my-5 max-[359px]:origin-center max-[359px]:scale-90`}
      >
        <div className="absolute inset-[24px] rounded-full bg-[#E3EBFF]" />
        {items.map(([t, k, x, y, s], i) => (
          <div
            key={i}
            className="bob-anim absolute rounded-full border-4 border-[#F4F7FE]"
            style={{ left: x, top: y, animationDelay: `${i}s` }}
          >
            <Avatar name={t} avatarKey={k} size={s} />
          </div>
        ))}
        <div className="bob-anim absolute bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-white px-4 py-2 text-xs font-bold text-cbrand shadow-[0_14px_34px_rgba(14,23,38,0.16)]" style={{ animationDelay: '1.2s' }}>
          Free · Unlimited · Always
        </div>
      </div>
      <SlideText
        compact={compact}
        title="Your contacts, one tap away"
        sub="Find anyone, anywhere in the world, instantly."
      />
    </SlideFrame>
  )
}

/* ============ Slide 5 — Voice rooms & live ============ */
function SlideLive({ compact, scale }: { compact: boolean; scale?: number }) {
  const mics = [0, 1, 2, 3, 4]
  return (
    <SlideFrame compact={compact} scale={scale}>
      <div
        className={`flex w-[310px] flex-col rounded-[32px] bg-dark-grad p-5 shadow-[0_14px_34px_rgba(14,23,38,0.18)] max-[359px]:w-[290px] ${
          compact ? 'mt-16' : 'mt-[104px]'
        } min-[768px]:mt-0`}
      >
        <div className="flex items-center justify-between">
          <div className="text-[15px] font-bold text-white">Late Night Talks</div>
          <span className="flex items-center gap-1.5 rounded-full bg-cred px-2.5 py-1 text-[11px] font-bold text-white">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> LIVE
          </span>
        </div>
        <div className="mt-4 grid grid-cols-5 gap-2">
          {mics.map((k) => (
            <div key={k} className="flex flex-col items-center gap-1.5">
              <div className={k === 0 ? 'ring-anim rounded-full' : ''}>
                <Avatar name={['H', 'S', 'A', 'M', 'Z'][k]} avatarKey={k + 1} size={44} />
              </div>
              <Mic size={12} className={k === 0 ? 'text-white' : 'text-[#A9B6D3]'} />
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between rounded-2xl bg-white/10 px-3.5 py-2.5">
          <span className="text-[12px] font-semibold text-[#C7D2E8]">48 listening</span>
          <span className="flex items-center gap-1 text-[12px] font-bold text-[#FF9BB0]">
            <Heart size={13} className="fill-[#FF9BB0]" /> 1.2k
          </span>
        </div>
      </div>
      <SlideText
        compact={compact}
        title="Voice rooms & live streams"
        sub="Host rooms, go live, send gifts and battle 1v1."
      />
    </SlideFrame>
  )
}

/* ============ Slide 6 — Private & free ============ */
function SlideFinal({ compact, scale }: { compact: boolean; scale?: number }) {
  return (
    <SlideFrame compact={compact} scale={scale}>
      <div className={`flex flex-col items-center ${compact ? 'mt-24' : 'mt-[120px]'} min-[768px]:mt-0`}>
        <div className="bob-anim flex h-[110px] w-[110px] items-center justify-center rounded-[30px] bg-white shadow-[0_12px_28px_rgba(47,91,234,0.2)]">
          <ShieldCheck size={56} className="text-cbrand" strokeWidth={1.8} />
        </div>
      </div>
      <SlideText compact={compact} title="Private & free forever" sub="No fees, no limits — just CALL." />
    </SlideFrame>
  )
}
