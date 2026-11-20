'use client'

import { useId } from 'react'

/** The CALL brand mark: blue chat-bubble "C" with a phone handset. */
export function CallLogoMark({ size = 48, className = '' }: { size?: number; className?: string }) {
  const uid = useId().replace(/:/g, '')
  const g1 = `callG-${uid}`
  const g2 = `callG2-${uid}`
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 256 256"
      className={className}
      role="img"
      aria-label="CALL logo"
    >
      <defs>
        <linearGradient id={g1} x1="60" y1="18" x2="176" y2="242" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#3EC0FF" />
          <stop offset="0.52" stopColor="#2273F2" />
          <stop offset="1" stopColor="#1443E4" />
        </linearGradient>
        <linearGradient id={g2} x1="88" y1="70" x2="170" y2="180" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#3AAEFF" />
          <stop offset="1" stopColor="#1B54EF" />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${g1})`}
        d="M 200.6 53.7 A 100 100 0 1 0 200.6 182.3 L 171.5 157.9 A 62 62 0 1 1 171.5 78.1 Z"
      />
      <path fill={`url(#${g1})`} d="M 122 214 L 34 252 L 36 152 Z" />
      <circle cx="124" cy="118" r="60" fill="#FFFFFF" />
      <path
        fill={`url(#${g2})`}
        transform="translate(88 84) scale(3.05)"
        d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"
      />
    </svg>
  )
}

/** Full wordmark: mark + "CALL" + tagline. */
export function CallWordmark({
  size = 64,
  dark = false,
  showTagline = true,
  className = '',
}: {
  size?: number
  dark?: boolean
  showTagline?: boolean
  className?: string
}) {
  return (
    <div className={`flex flex-col items-center ${className}`}>
      <div className="flex items-center gap-3">
        <CallLogoMark size={size} />
        <span
          className={`font-extrabold tracking-tight leading-none ${dark ? 'text-white' : 'text-cink'}`}
          style={{ fontSize: size * 0.92, letterSpacing: '-0.02em' }}
        >
          CALL
        </span>
      </div>
      {showTagline && (
        <p
          className={`mt-1 font-semibold ${dark ? 'text-[#A9B6D3]' : 'text-cmut'}`}
          style={{ fontSize: Math.max(12, size * 0.23) }}
        >
          One World. One Call.
        </p>
      )}
    </div>
  )
}
