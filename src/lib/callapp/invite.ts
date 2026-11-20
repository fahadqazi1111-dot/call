'use client'

import { toast } from 'sonner'

/**
 * WhatsApp-style friend invites — 100% free, no backend needed.
 * 1. Native share sheet (Android / iOS / Windows) when available
 * 2. SMS app with a prefilled message when we know the friend's number
 * 3. Clipboard copy as the universal fallback
 */

export type InviteChannel = 'shared' | 'cancelled' | 'sms' | 'copied' | 'failed'

function appOrigin(): string {
  return typeof window !== 'undefined' ? window.location.origin : ''
}

export function inviteMessage(name?: string): string {
  const link = appOrigin()
  const who = name ? `Hey ${name}! ` : ''
  return `${who}Join me on CALL — free voice & video calls, chat and voice notes. Unlimited, worldwide, zero cost. ${link}`
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/** Open the SMS app with the invite prefilled for this number. */
function openSms(phone: string, text: string): void {
  const num = phone.replace(/[^\d+]/g, '')
  const body = encodeURIComponent(text)
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  const isIOS = /iPad|iPhone|iPod/.test(ua)
  // Android: sms:+92300...?body=...   iOS: sms:+92300...&body=...
  window.location.href = isIOS ? `sms:${num}&body=${body}` : `sms:${num}?body=${body}`
}

/** Touch-capable device (phones / tablets) — safe to deep-link into the SMS app. */
function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || (navigator.maxTouchPoints ?? 0) > 1
}

/**
 * Share an invite for a contact (or a generic invite when no name/phone).
 * Cancels silently if the user closes the share sheet.
 */
export async function shareInvite(
  opts: { name?: string; phone?: string } = {}
): Promise<InviteChannel> {
  const text = inviteMessage(opts.name)
  const link = appOrigin()

  // 1. Native share sheet — the WhatsApp-like path on real phones
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: 'Invite to CALL', text, url: link })
      return 'shared'
    } catch (err) {
      const e = err as Error
      if (e?.name === 'AbortError') return 'cancelled'
      // fall through to the other channels on real failures
    }
  }

  // 2. SMS with prefilled body — only on actual mobile devices
  if (opts.phone && isMobileDevice()) {
    openSms(opts.phone, text)
    return 'sms'
  }

  // 3. Universal fallback: copy
  const ok = await copyText(text)
  if (ok) {
    toast.success('Invite copied — paste it in any chat or SMS')
    return 'copied'
  }
  toast.error('Could not copy the invite — please try again')
  return 'failed'
}
