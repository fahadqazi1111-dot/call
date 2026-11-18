'use client'

import { useRef, useState } from 'react'
import { CallLogoMark } from './CallLogo'
import { Avatar } from './Avatar'
import { Video, Mic, Lock, ShieldCheck, Globe2, Zap, PhoneMissed } from 'lucide-react'
import { useApp } from '@/lib/callapp/store'
import { useCompactHeight, useIsDesktop, useVeryShortHeight } from './useMediaQuery'

export function OnboardingScreen() {
  const scRef = useRef<HTMLDivElement>(null)
  const [slide, setSlide] = useState(0)
  const setPhase = useApp((s) => s.setPhase)
  const compact = useCompactHeight()
  const veryShort = useVeryShortHeight()
  const isDesktop = useIsDesktop()
  // Landscape phones: scale slides down so they fit without scrolling.
  const scale = veryShort ? (isDesktop ? 0.64 : 0.66) : 1
  const last = slide === 3

  const goTo = (n: number) => {
    scRef.current?.scrollTo({ left: n * (scRef.current?.clientWidth || 390), behavior: 'smooth' })
  }

  const onScroll = () => {
    const el = scRef.current
    if (!el) return
    setSlide(Math.round(el.scrollLeft / (el.clientWidth || 390)))
  }

  return (
    <div className="absolute inset-0 flex flex-col bg-[#F4F7FE]">
      <div className={`absolute right-6 z-20 ${compact ? 'top-10' : 'top-14'}`}>
        <button className="text-sm font-semibold text-cmut" onClick={() => goTo(3)}>
          Skip
        </button>
      </div>
      <div
        ref={scRef}
        onScroll={onScroll}
        className="no-scrollbar flex h-full w-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden"
      >
        <Slide1 compact={compact} scale={scale} />
        <Slide2 compact={compact} scale={scale} />
        <Slide3 compact={compact} scale={scale} />
        <Slide4 compact={compact} scale={scale} />
      </div>

      <div className={`absolute bottom-0 left-6 right-6 z-20 ${compact ? 'pb-5' : 'pb-10'}`}>
        <div className={`flex h-1.5 items-center justify-center gap-1.5 ${compact ? 'mb-3.5' : 'mb-6'}`}>
          {[0, 1, 2, 3].map((i) => (
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
              ? 'pb-[88px] min-[768px]:pb-[88px] min-[768px]:pt-0'
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

/** Heading + paragraph block shared by every slide. */
function SlideText({ compact, title, sub }: { compact: boolean; title: string; sub: string }) {
  return (
    <div
      className={`text-center ${
        compact ? 'mt-6 px-6' : 'mt-12 px-8'
      } min-[768px]:mt-10 min-[768px]:max-w-[520px]`}
    >
      <h1
        className={`font-extrabold leading-tight tracking-tight text-cink ${
          compact ? 'text-[26px]' : 'text-[31px]'
        }`}
      >
        {title}
      </h1>
      <p className={`text-base leading-6 text-cmut ${compact ? 'mt-2 text-[15px]' : 'mt-2.5'}`}>
        {sub}
      </p>
    </div>
  )
}

function Slide1({ compact, scale }: { compact: boolean; scale?: number }) {
  return (
    <SlideFrame compact={compact} scale={scale}>
      <div className={`relative h-[330px] w-[300px] max-[359px]:w-[290px] ${compact ? 'mt-16' : 'mt-[110px]'} min-[768px]:mt-0`}>
        <div className="bg-dark-grad absolute inset-0 flex flex-col items-center rounded-[32px] shadow-[0_14px_34px_rgba(14,23,38,0.14)]">
          <div className={`relative ${compact ? 'mt-9' : 'mt-[52px]'}`}>
            <div className="ring-anim absolute -inset-2 rounded-full border-2 border-[#3D6BFF]" />
            <Avatar name="Ayesha S" avatarKey={0} size={compact ? 92 : 104} />
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
        sub="Video and voice calls with friends and family — free, unlimited and always smooth."
      />
    </SlideFrame>
  )
}

function Slide2({ compact, scale }: { compact: boolean; scale?: number }) {
  return (
    <SlideFrame compact={compact} scale={scale}>
      <div
        className={`flex w-[330px] flex-col rounded-[32px] bg-white shadow-[0_14px_34px_rgba(14,23,38,0.14)] max-[359px]:w-[300px] ${
          compact ? 'mt-16 gap-2.5 p-4' : 'mt-[110px] gap-3 p-6'
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
            {[9, 18, 12, 24, 15, 8, 20, 11, 17, 7, 22, 13, 19, 10, 23, 14, 8, 18, 12, 21].map((h, i) => (
              <span key={i} className="w-[3px] rounded-sm bg-white" style={{ height: h, opacity: i < 9 ? 1 : 0.35 }} />
            ))}
          </div>
          <span className="text-xs font-semibold opacity-85">0:24</span>
        </div>
        <div className="rounded-[20px] rounded-bl-md bg-[#F1F4FA] px-4 py-2.5 text-[15px] text-cink">
          Send me the best one
        </div>
        <div className="flex items-center justify-end gap-1.5 text-xs font-semibold text-[#067647]">
          <Lock size={15} /> End-to-end encrypted
        </div>
      </div>
      <SlideText
        compact={compact}
        title="Chats & voice notes that stay private"
        sub="Messages and voice messages go straight between you two. Only you and they can open them."
      />
    </SlideFrame>
  )
}

function Slide3({ compact, scale }: { compact: boolean; scale?: number }) {
  // x, y, avatar size — valid numeric offsets inside the 330px cluster
  const items = [
    ['AS', 0, 148, 8, 88],
    ['KI', 1, 36, 96, 74],
    ['PN', 2, 238, 88, 74],
    ['VS', 3, 86, 196, 68],
    ['AP', 4, 200, 204, 68],
  ] as const
  return (
    <SlideFrame compact={compact}>
      <div
        className={`relative h-[330px] w-[330px] min-[768px]:mt-0 ${
          compact ? 'mt-8' : 'mt-[80px]'
        } max-[359px]:-my-5 max-[359px]:origin-center max-[359px]:scale-90`}
      >
        <div className="absolute inset-[20px] rounded-full bg-[#E3EBFF]" />
        {items.map(([t, k, x, y, s], i) => (
          <div
            key={i}
            className="bob-anim absolute rounded-full border-4 border-[#F4F7FE]"
            style={{ left: x, top: y, animationDelay: `${i}s` }}
          >
            <Avatar name={t} avatarKey={k} size={s} />
          </div>
        ))}
        <div className="bob-anim absolute bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-white px-4 py-2 text-xs font-bold text-cbrand shadow-[0_14px_34px_rgba(14,23,38,0.16)]" style={{ animationDelay: '1.2s' }}>
          Free · Unlimited · Always
        </div>
      </div>
      <SlideText
        compact={compact}
        title="Your contacts, one tap away"
        sub="Import your phone contacts instantly and start talking to anyone, anywhere in the world."
      />
    </SlideFrame>
  )
}

function Slide4({ compact, scale }: { compact: boolean; scale?: number }) {
  const features = [
    [Video, 'Free HD calls', 'Video and voice, no limits'],
    [Mic, 'Voice messages', 'Record and send in one tap'],
    [ShieldCheck, 'Private by design', 'Peer-to-peer encrypted calls'],
    [Globe2, 'Works worldwide', 'One World. One Call.'],
  ] as const
  return (
    <SlideFrame compact={compact} scale={scale}>
      <div className={`px-8 ${compact ? 'mt-16' : 'mt-[84px]'} min-[768px]:mt-0 min-[768px]:max-w-[560px]`}>
        <div
          className={`flex items-center justify-center rounded-[20px] bg-white shadow-[0_12px_28px_rgba(47,91,234,0.2)] ${
            compact ? 'h-[60px] w-[60px]' : 'h-[72px] w-[72px]'
          }`}
        >
          <CallLogoMark size={compact ? 40 : 46} />
        </div>
        <h1
          className={`font-extrabold leading-tight tracking-tight text-cink ${
            compact ? 'mt-4 text-[26px]' : 'mt-6 text-[34px]'
          }`}
        >
          Welcome to CALL
        </h1>
        <p className={`text-base text-cmut ${compact ? 'mt-1.5' : 'mt-2'}`}>
          Free, private and beautifully simple.
        </p>

        {/* Vertical tiles on tablet panes (no cramped wrapping),
            stacked rows on phones, tighter rows on short screens. */}
        <div
          className={`flex flex-col min-[768px]:grid min-[768px]:grid-cols-2 ${
            compact ? 'mt-3.5 gap-2.5' : 'mt-8 gap-3.5'
          } min-[768px]:mt-6 min-[768px]:gap-3`}
        >
          {features.map(([Icon, a, b], i) => (
            <div
              key={i}
              className={`flex items-center rounded-[18px] bg-white shadow-[0_2px_10px_rgba(14,23,38,0.05)] min-[768px]:flex-col min-[768px]:items-start ${
                compact ? 'gap-2.5 p-2' : 'gap-3.5 p-3.5'
              } min-[768px]:gap-2 min-[768px]:p-4`}
            >
              <span
                className={`flex flex-none items-center justify-center rounded-[14px] bg-csoft text-cbrand ${
                  compact ? 'h-10 w-10' : 'h-[46px] w-[46px]'
                } min-[768px]:h-11 min-[768px]:w-11`}
              >
                <Icon size={compact ? 20 : 21} />
              </span>
              <div className={compact ? 'min-w-0' : ''}>
                <div className={`font-bold text-cink ${compact ? 'text-[15px]' : 'text-base'}`}>{a}</div>
                <div className={`text-cmut ${compact ? 'text-[13px]' : 'mt-0.5 text-sm'}`}>{b}</div>
              </div>
            </div>
          ))}
        </div>

        <div className={`flex items-center justify-center gap-2 text-xs font-semibold text-[#7A8499] ${compact ? 'mt-3' : 'mt-6'}`}>
          <Zap size={14} className="text-cgreen" /> 100% free forever — zero budget, zero limits
        </div>
      </div>
    </SlideFrame>
  )
}
