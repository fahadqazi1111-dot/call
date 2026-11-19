'use client'

import { useEffect, useState } from 'react'
import { CallWordmark } from './CallLogo'
import { useApp } from '@/lib/callapp/store'
import { api } from '@/lib/callapp/api'

export function SplashScreen() {
  const bootstrap = useApp((s) => s.bootstrap)
  const booted = useApp((s) => s.booted)
  const phase = useApp((s) => s.phase)
  /** admin can disable the splash entirely — fetch once, skip immediately */
  const [skip, setSkip] = useState<boolean | null>(null)

  useEffect(() => {
    void bootstrap()
    void api
      .appConfig()
      .then((c) => setSkip(!c.splashEnabled))
      .catch(() => setSkip(false))
  }, [bootstrap])

  useEffect(() => {
    if (skip) {
      useApp.setState({ phase: phase === 'main' ? 'main' : 'onboarding' })
      return
    }
    if (skip === false && booted) {
      const t = window.setTimeout(() => {
        useApp.setState({ phase: phase === 'main' ? 'main' : 'onboarding' })
      }, 900)
      return () => window.clearTimeout(t)
    }
  }, [booted, phase, skip])

  // admin disabled the splash → render nothing (instant jump to auth/app)
  if (skip) return null

  return (
    <div className="bg-dark-grad absolute inset-0 z-50 flex flex-col items-center justify-center text-white">
      <div className="relative flex h-64 w-full items-center justify-center">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="ring-anim absolute h-[110px] w-[110px] rounded-full border-2 border-[#3D6BFF]"
            style={{ animationDelay: `${i}s` }}
          />
        ))}
        <div className="flex h-[104px] w-[104px] items-center justify-center rounded-[28px] bg-white shadow-[0_20px_50px_rgba(20,67,228,0.45)]">
          <CallWordmarkFallback />
        </div>
      </div>
      <div className="mt-6 text-center">
        <h1 className="text-[38px] font-extrabold tracking-tight">CALL</h1>
        <p className="mt-2 text-[15px] text-[#A9B6D3]">One World. One Call.</p>
      </div>
      <div className="absolute bottom-24 left-1/2 h-1 w-32 -translate-x-1/2 overflow-hidden rounded-full bg-[#1B2B52]">
        <div className="loadbar-anim h-full rounded-full bg-[#3D6BFF]" />
      </div>
      <p className="absolute bottom-12 w-full text-center text-xs text-[#6F7FA6]">Peer-to-peer encrypted calls</p>
    </div>
  )
}

function CallWordmarkFallback() {
  return (
    <svg width="64" height="64" viewBox="0 0 256 256" aria-hidden="true">
      <path
        fill="url(#splashG)"
        d="M 200.6 53.7 A 100 100 0 1 0 200.6 182.3 L 171.5 157.9 A 62 62 0 1 1 171.5 78.1 Z"
      />
      <path fill="url(#splashG)" d="M 122 214 L 34 252 L 36 152 Z" />
      <circle cx="124" cy="118" r="60" fill="#FFFFFF" />
      <path
        fill="url(#splashG2)"
        transform="translate(88 84) scale(3.05)"
        d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"
      />
      <defs>
        <linearGradient id="splashG" x1="60" y1="18" x2="176" y2="242" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#3EC0FF" />
          <stop offset="0.52" stopColor="#2273F2" />
          <stop offset="1" stopColor="#1443E4" />
        </linearGradient>
        <linearGradient id="splashG2" x1="88" y1="70" x2="170" y2="180" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#3AAEFF" />
          <stop offset="1" stopColor="#1B54EF" />
        </linearGradient>
      </defs>
    </svg>
  )
}
