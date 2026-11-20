'use client'

import { avatarGradient, initialsOf } from '@/lib/callapp/utils'
import { CallLogoMark } from './CallLogo'

/**
 * Display picture for the CALL Official account — the brand logo inside a
 * soft gradient circle. Used everywhere the official account appears
 * (chat list, chat header, contacts) so it never looks like a plain letter.
 */
export function OfficialAvatar({
  size = 48,
  online,
  className = '',
}: {
  size?: number
  online?: boolean
  className?: string
}) {
  return (
    <div className={`relative flex-none ${className}`} style={{ width: size, height: size }}>
      <div
        className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-white shadow-[inset_0_0_0_1.5px_rgba(47,91,234,0.14)]"
        aria-hidden="true"
      >
        <span
          className="flex h-full w-full items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #EAF2FF 0%, #F5F9FF 60%, #EAF2FF 100%)' }}
        >
          <CallLogoMark size={Math.round(size * 0.62)} className="drop-shadow-[0_2px_6px_rgba(47,91,234,0.25)]" />
        </span>
      </div>
      {online !== undefined && online && (
        <span
          className="absolute rounded-full bg-cgreen border-2 border-white"
          style={{ width: Math.max(11, size * 0.26), height: Math.max(11, size * 0.26), right: 0, bottom: 1 }}
          title="Online"
        />
      )}
      <span className="sr-only">CALL official account</span>
    </div>
  )
}

export function Avatar({
  name,
  avatarKey = 0,
  size = 52,
  online,
  className = '',
  ring = false,
  src,
}: {
  name: string
  avatarKey?: number
  size?: number
  online?: boolean
  className?: string
  ring?: boolean
  src?: string | null
}) {
  return (
    <div className={`relative flex-none ${className}`} style={{ width: size, height: size }}>
      <div
        className={`flex h-full w-full items-center justify-center overflow-hidden rounded-full font-bold text-white select-none ${
          ring ? 'ring-2 ring-white' : ''
        }`}
        style={{ background: avatarGradient(avatarKey), fontSize: size * 0.36 }}
        aria-hidden="true"
      >
        {src ? (
          <img
            src={src}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
            draggable={false}
          />
        ) : (
          initialsOf(name)
        )}
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
