import type { CallRecord } from './types'

export const AVATAR_GRADIENTS = [
  ['#4A74FF', '#2F5BEA'],
  ['#9F67FF', '#7C3AED'],
  ['#1FB5A8', '#0F766E'],
  ['#F0508F', '#BE185D'],
  ['#F5A524', '#B45309'],
  ['#64748B', '#334155'],
  ['#34D399', '#059669'],
  ['#F97362', '#DC2626'],
]

export function avatarGradient(key: number | undefined | null) {
  const idx = ((key ?? 0) % AVATAR_GRADIENTS.length + AVATAR_GRADIENTS.length) % AVATAR_GRADIENTS.length
  return `linear-gradient(135deg, ${AVATAR_GRADIENTS[idx][0]}, ${AVATAR_GRADIENTS[idx][1]})`
}

export function initialsOf(name: string): string {
  const parts = (name || '?').trim().split(/\s+/)
  if (parts.length === 1) return (parts[0]?.[0] ?? '?').toUpperCase()
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase()
}

export function fmtTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function fmtChatListTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const yest = new Date(now)
  yest.setDate(now.getDate() - 1)
  if (d.toDateString() === yest.toDateString()) return 'Yesterday'
  if (now.getTime() - d.getTime() < 7 * 86400_000) return d.toLocaleDateString([], { weekday: 'short' })
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' })
}

export function fmtDuration(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  const m = Math.floor(s / 60)
  const r = s % 60
  if (m >= 60) {
    const h = Math.floor(m / 60)
    return `${h}:${String(m % 60).padStart(2, '0')}:${String(r).padStart(2, '0')}`
  }
  return `${m}:${String(r).padStart(2, '0')}`
}

export function lastSeenLabel(lastSeenIso?: string, online?: boolean): string {
  if (online) return 'Online'
  if (!lastSeenIso) return 'Last seen recently'
  const d = new Date(lastSeenIso)
  const mins = Math.floor((Date.now() - d.getTime()) / 60000)
  if (mins < 2) return 'Last seen just now'
  if (mins < 60) return `Last seen ${mins}m ago`
  const sameDay = d.toDateString() === new Date().toDateString()
  if (sameDay) return `Last seen at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
  return 'Last seen recently'
}

/** Deterministic pseudo waveform bars from a seed string. */
export function barsFromSeed(seed: string, n = 28): number[] {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0
  const bars: number[] = []
  for (let i = 0; i < n; i++) {
    h = (h * 1103515245 + 12345) | 0
    const v = Math.abs((h >> 8) % 100)
    bars.push(6 + Math.round((v / 100) * 20))
  }
  return bars
}

export function callStatusText(c: Pick<CallRecord, 'status' | 'outgoing' | 'durationSec'>): string {
  if (c.status === 'answered') return c.durationSec > 0 ? fmtDuration(c.durationSec) : '0:00'
  if (c.status === 'declined') return c.outgoing ? 'Declined' : 'You declined'
  if (c.status === 'no-answer') return 'No answer'
  return 'Missed'
}

export const EMOJI_PATTERN = /^$/

export function formatPhone(digits: string): string {
  const d = (digits || '').replace(/\D/g, '')
  if (d.length <= 4) return d
  if (d.length <= 7) return `${d.slice(0, 4)} ${d.slice(4)}`
  return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7, 10)}`
}
