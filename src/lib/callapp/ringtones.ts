'use client'

/**
 * Call ringtones — real, non-copyright audio downloaded from mixkit.co
 * (free license) by scripts/download-sounds.mjs. The first entry is the
 * original synthesized CALL ring so the app always has a fallback.
 * Selection is per-device (localStorage) — the same audio unlock rules apply.
 */

export interface RingtoneOption {
  id: string
  name: string
  /** null → classic synthesized CALL ring (no asset) */
  file: string | null
}

export const RINGTONE_KEY = 'call.ringtone'

export const RINGTONE_OPTIONS: RingtoneOption[] = [
  { id: 'classic', name: 'CALL Classic', file: null },
  { id: 'marimba', name: 'Marimba', file: '/sounds/ringtones/marimba-ringtone.mp3' },
  { id: 'retro', name: 'Retro Phone', file: '/sounds/ringtones/vintage-telephone-ringtone.mp3' },
  { id: 'office', name: 'Office Bell', file: '/sounds/ringtones/office-telephone-ring.mp3' },
  { id: 'marimba-wait', name: 'Marimba Waiting', file: '/sounds/ringtones/marimba-waiting-ringtone.mp3' },
  { id: 'waiting', name: 'Waiting Tone', file: '/sounds/ringtones/waiting-ringtone.mp3' },
  { id: 'onhold', name: 'On Hold', file: '/sounds/ringtones/on-hold-ringtone.mp3' },
]

export function getRingtoneOption(id: string | null | undefined): RingtoneOption {
  return RINGTONE_OPTIONS.find((r) => r.id === id) ?? RINGTONE_OPTIONS[0]
}

export function getSelectedRingtone(): RingtoneOption {
  if (typeof window === 'undefined') return RINGTONE_OPTIONS[0]
  try {
    return getRingtoneOption(window.localStorage.getItem(RINGTONE_KEY))
  } catch {
    return RINGTONE_OPTIONS[0]
  }
}

export function setRingtone(id: string) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(RINGTONE_KEY, id)
  } catch {}
}
