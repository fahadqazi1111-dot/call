'use client'

import { CallLogoMark } from './CallLogo'
import { Video, Mic, Lock, Users, Globe2, Zap, Phone, PhoneOff } from 'lucide-react'

/** Left branding pane of the desktop auth split (hidden on phones). */
export function AuthBranding() {
  return (
    <div className="bg-dark-grad relative hidden flex-col overflow-hidden text-white md:flex md:min-h-0 md:overflow-y-auto md:p-10 lg:p-14 no-scrollbar">
      {/* soft glow accents */}
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[#2F5BEA]/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-16 h-80 w-80 rounded-full bg-[#3EC0FF]/20 blur-3xl" />
      <div className="pointer-events-none absolute left-1/3 top-1/2 h-64 w-64 -translate-y-1/2 rounded-full bg-[#12B76A]/10 blur-3xl" />

      <div className="relative mx-auto flex h-full w-full max-w-[560px] flex-col justify-between py-2">

        <div className="relative flex items-center gap-3">
          <CallLogoMark size={44} />
          <span className="text-[26px] font-extrabold leading-none tracking-tight">CALL</span>
        </div>

        <div className="relative">
          <h2 className="text-[30px] font-extrabold leading-[1.15] tracking-tight md:text-[32px] lg:text-[40px]">
            Calls &amp; chats
            <br />
            without borders.
          </h2>
          <p className="mt-4 max-w-md text-[14px] leading-relaxed text-[#A9B6D3] lg:text-[15px]">
            Voice calls, video calls, messages and voice notes — free and unlimited, in one place.
          </p>

          {/* mock product cards */}
          <div className="mt-8 space-y-3 lg:mt-10">
            <div className="rounded-[22px] border border-white/10 bg-white/[0.07] p-4 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.65)] backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-gradient-to-br from-[#4a74ff] to-[#2f5bea] text-[14px] font-bold">
                  AS
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-bold">Ayesha Siddiqui</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-[#8CA0C9]">
                    <span className="h-1.5 w-1.5 flex-none rounded-full bg-[#12b76a]" />
                    Incoming video call…
                  </p>
                </div>
                <div className="flex flex-none gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f04438]/90 text-white">
                    <PhoneOff size={15} />
                  </span>
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#12b76a] text-white">
                    <Phone size={15} />
                  </span>
                </div>
              </div>
            </div>

            <div className="ml-6 flex items-center justify-between rounded-[18px] border border-white/10 bg-white/[0.05] px-4 py-3 backdrop-blur-sm lg:ml-10">
              <span className="flex items-center gap-2 text-[12px] text-[#A9B6D3]">
                <Mic size={13} className="text-[#3EC0FF]" />
                Voice note · 0:12
              </span>
              <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white">
                <Zap size={11} className="text-[#3EC0FF]" /> Sent
              </span>
            </div>
          </div>

          <ul className="mt-8 grid grid-cols-1 gap-x-8 gap-y-4 xl:grid-cols-2 xl:gap-y-5">
            <Feature Icon={Video} title="HD video calls" sub="Face to face, anywhere" />
            <Feature Icon={Mic} title="Voice messages" sub="Tap, talk, send" />
            <Feature Icon={Users} title="Your contacts" sub="Find friends in seconds" />
            <Feature Icon={Lock} title="Private by design" sub="Peer-to-peer calls" />
          </ul>
        </div>

        <div className="relative mt-10 flex items-center justify-between text-[12px] font-semibold text-[#8CA0C9]">
          <span className="flex items-center gap-1.5">
            <Globe2 size={13} /> One World. One Call.
          </span>
          <span className="flex items-center gap-1.5">
            <Zap size={13} className="text-[#3EC0FF]" /> Free forever
          </span>
        </div>
      </div>
    </div>
  )
}

function Feature({ Icon, title, sub }: { Icon: typeof Video; title: string; sub: string }) {
  return (
    <li className="flex items-center gap-3.5">
      <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[14px] bg-white/10 text-[#7FB4FF]">
        <Icon size={19} />
      </span>
      <span>
        <span className="block text-[14.5px] font-bold">{title}</span>
        <span className="block text-[12.5px] text-[#A9B6D3]">{sub}</span>
      </span>
    </li>
  )
}
