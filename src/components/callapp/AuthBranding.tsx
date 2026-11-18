'use client'

import { CallLogoMark } from './CallLogo'
import { Video, Mic, Lock, Users, Globe2, Zap } from 'lucide-react'

/** Left branding pane of the desktop auth card (hidden on smaller screens). */
export function AuthBranding() {
  return (
    <div className="bg-dark-grad relative hidden flex-col justify-between overflow-hidden p-10 text-white lg:flex">
      {/* soft glow accents */}
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[#2F5BEA]/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-16 h-80 w-80 rounded-full bg-[#3EC0FF]/20 blur-3xl" />

      <div className="relative flex items-center gap-3">
        <CallLogoMark size={44} />
        <span className="text-[26px] font-extrabold tracking-tight leading-none">CALL</span>
      </div>

      <div className="relative">
        <h2 className="text-[34px] font-extrabold leading-[1.15] tracking-tight">
          Calls &amp; chats
          <br />
          without borders.
        </h2>
        <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-[#A9B6D3]">
          Voice calls, video calls, messages and voice notes — free and unlimited, in one place.
        </p>

        <ul className="mt-9 space-y-4">
          <Feature Icon={Video} title="HD video calls" sub="Face to face with anyone, anywhere" />
          <Feature Icon={Mic} title="Voice messages" sub="Tap, talk, send — instantly" />
          <Feature Icon={Users} title="Your contacts" sub="Sync and invite friends in seconds" />
          <Feature Icon={Lock} title="Private by design" sub="Peer-to-peer encrypted calls" />
        </ul>
      </div>

      <div className="relative flex items-center justify-between text-[12px] font-semibold text-[#8CA0C9]">
        <span className="flex items-center gap-1.5">
          <Globe2 size={13} /> One World. One Call.
        </span>
        <span className="flex items-center gap-1.5">
          <Zap size={13} className="text-[#3EC0FF]" /> Free forever
        </span>
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
        <span className="block text-[15px] font-bold">{title}</span>
        <span className="block text-[13px] text-[#A9B6D3]">{sub}</span>
      </span>
    </li>
  )
}
