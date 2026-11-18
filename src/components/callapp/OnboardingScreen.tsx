'use client'

import { useRef, useState } from 'react'
import { CallLogoMark, CallWordmark } from './CallLogo'
import { Avatar } from './Avatar'
import { Video, Mic, Lock, Users, PhoneMissed, ShieldCheck, Globe2, Zap } from 'lucide-react'
import { useApp } from '@/lib/callapp/store'

export function OnboardingScreen() {
  const scRef = useRef<HTMLDivElement>(null)
  const [slide, setSlide] = useState(0)
  const setPhase = useApp((s) => s.setPhase)
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
      <div className="absolute right-6 top-14 z-20">
        <button className="text-sm font-semibold text-cmut" onClick={() => goTo(3)}>
          Skip
        </button>
      </div>
      <div
        ref={scRef}
        onScroll={onScroll}
        className="no-scrollbar flex h-full w-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden"
      >
        <Slide1 />
        <Slide2 />
        <Slide3 />
        <Slide4 />
      </div>

      <div className="absolute bottom-10 left-6 right-6 z-20">
        <div className="mb-6 flex h-1.5 items-center justify-center gap-1.5">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${i === slide ? 'w-7 bg-cbrand' : 'w-1.5 bg-[#C5CFE6]'}`}
            />
          ))}
        </div>
        {last ? (
          <button
            className="btn-p w-full"
            onClick={() => setPhase('auth')}
          >
            Get started
          </button>
        ) : (
          <button className="btn-p w-full" onClick={() => goTo(slide + 1)}>
            Next
          </button>
        )}
        {last && (
          <p className="mt-4 text-center text-xs text-cmut">
            By continuing you agree to our Terms & Privacy Policy
          </p>
        )}
      </div>
    </div>
  )
}

function SlideFrame({ children }: { children: React.ReactNode }) {
  return <div className="relative flex h-full w-full flex-none snap-center flex-col items-center">{children}</div>
}

function Slide1() {
  return (
    <SlideFrame>
      <div className="relative mt-[110px] h-[330px] w-[300px] min-[768px]:mt-14">
        <div className="bg-dark-grad absolute inset-0 flex flex-col items-center rounded-[32px] shadow-[0_14px_34px_rgba(14,23,38,0.14)]">
          <div className="relative mt-[52px]">
            <div className="ring-anim absolute -inset-2 rounded-full border-2 border-[#3D6BFF]" />
            <Avatar name="Ayesha S" avatarKey={0} size={104} />
          </div>
          <div className="mt-5 text-center text-white">
            <div className="text-lg font-bold">Ayesha Siddiqui</div>
            <div className="mt-1 text-[13px] text-[#A9B6D3]">HD video call · 12:08</div>
          </div>
          <div className="mt-auto mb-7 flex items-center gap-4">
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
      <div className="mt-12 px-8 text-center">
        <h1 className="text-[31px] font-extrabold leading-tight tracking-tight text-cink">Crystal-clear HD calls</h1>
        <p className="mt-3 text-base leading-6 text-cmut">
          Video and voice calls with friends and family — free, unlimited and always smooth.
        </p>
      </div>
    </SlideFrame>
  )
}

function Slide2() {
  return (
    <SlideFrame>
      <div className="mt-[110px] flex w-[330px] flex-col gap-3 rounded-[32px] bg-white p-6 shadow-[0_14px_34px_rgba(14,23,38,0.14)] min-[768px]:mt-14">
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
      <div className="mt-12 px-8 text-center">
        <h1 className="text-[31px] font-extrabold leading-tight tracking-tight text-cink">
          Chats & voice notes that stay private
        </h1>
        <p className="mt-3 text-base leading-6 text-cmut">
          Messages and voice messages go straight between you two. Only you and they can open them.
        </p>
      </div>
    </SlideFrame>
  )
}

function Slide3() {
  const items = [
    ['AS', 0, 'left:148px;top:8px', 88],
    ['KI', 1, 'left:36px;top:96px', 74],
    ['PN', 2, 'left:238px;top:88px', 74],
    ['VS', 3, 'left:86px;top:196px', 68],
    ['AP', 4, 'left:200px;top:204px', 68],
  ] as const
  return (
    <SlideFrame>
      <div className="relative mt-[80px] h-[330px] w-[330px] min-[768px]:mt-12">
        <div className="absolute inset-[20px] rounded-full bg-[#E3EBFF]" />
        {items.map(([t, k, pos, s], i) => (
          <div
            key={i}
            className="bob-anim absolute rounded-full border-4 border-[#F4F7FE]"
            style={{ left: pos, animationDelay: `${i}s` }}
          >
            <Avatar name={t} avatarKey={k} size={s} />
          </div>
        ))}
        <div className="bob-anim absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-white px-4 py-2 text-xs font-bold text-cbrand shadow-[0_14px_34px_rgba(14,23,38,0.16)]" style={{ animationDelay: '1.2s' }}>
          Free · Unlimited · Always
        </div>
      </div>
      <div className="mt-10 px-8 text-center">
        <h1 className="text-[31px] font-extrabold leading-tight tracking-tight text-cink">Your contacts, one tap away</h1>
        <p className="mt-3 text-base leading-6 text-cmut">
          Import your phone contacts instantly and start talking to anyone, anywhere in the world.
        </p>
      </div>
    </SlideFrame>
  )
}

function Slide4() {
  const features = [
    [Video, 'Free HD calls', 'Video and voice, no limits'],
    [Mic, 'Voice messages', 'Record and send in one tap'],
    [ShieldCheck, 'Private by design', 'Peer-to-peer encrypted calls'],
    [Globe2, 'Works worldwide', 'One World. One Call.'],
  ] as const
  return (
    <SlideFrame>
      <div className="mt-[84px] px-8 min-[768px]:mt-8">
        <div className="flex h-[72px] w-[72px] items-center justify-center rounded-[20px] bg-white shadow-[0_12px_28px_rgba(47,91,234,0.2)]">
          <CallLogoMark size={46} />
        </div>
        <h1 className="mt-6 text-[34px] font-extrabold leading-tight tracking-tight text-cink">Welcome to CALL</h1>
        <p className="mt-2 text-base text-cmut">Free, private and beautifully simple.</p>
        <div className="mt-8 flex flex-col gap-3.5 min-[768px]:mt-6 min-[768px]:gap-3">
          {features.map(([Icon, a, b], i) => (
            <div
              key={i}
              className="flex items-center gap-3.5 rounded-[18px] bg-white p-3.5 shadow-[0_2px_10px_rgba(14,23,38,0.05)]"
            >
              <span className="flex h-[46px] w-[46px] flex-none items-center justify-center rounded-[14px] bg-csoft text-cbrand">
                <Icon size={21} />
              </span>
              <div>
                <div className="text-base font-bold text-cink">{a}</div>
                <div className="mt-0.5 text-sm text-cmut">{b}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 flex items-center justify-center gap-2 text-xs font-semibold text-[#7A8499]">
          <Zap size={14} className="text-cgreen" /> 100% free forever — zero budget, zero limits
        </div>
      </div>
    </SlideFrame>
  )
}
