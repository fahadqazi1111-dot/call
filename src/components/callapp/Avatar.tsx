'use client'

import { avatarGradient, initialsOf } from '@/lib/callapp/utils'

export function Avatar({
  name,
  avatarKey = 0,
  size = 52,
  online,
  className = '',
  ring = false,
}: {
  name: string
  avatarKey?: number
  size?: number
  online?: boolean
  className?: string
  ring?: boolean
}) {
  return (
    <div className={`relative flex-none ${className}`} style={{ width: size, height: size }}>
      <div
        className={`flex h-full w-full items-center justify-center rounded-full font-bold text-white select-none ${
          ring ? 'ring-2 ring-white' : ''
        }`}
        style={{ background: avatarGradient(avatarKey), fontSize: size * 0.36 }}
        aria-hidden="true"
      >
        {initialsOf(name)}
      </div>
      {online !== undefined && online && (
        <span
          className="absolute rounded-full bg-cgreen border-2 border-white"
          style={{ width: Math.max(11, size * 0.26), height: Math.max(11, size * 0.26), right: 0, bottom: 1 }}
          title="Online"
        />
      )}
      <span className="sr-only">{name}</span>
    </div>
  )
}
