'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { AtSign, Ban, BellOff, Flag, Info, MessageSquare, Phone, ShieldBan, Video, X } from 'lucide-react'
import { Avatar, OfficialAvatar } from './Avatar'
import { StaffTick } from './StaffTick'
import { useApp } from '@/lib/callapp/store'
import { lastSeenLabel } from '@/lib/callapp/utils'
import {
  ChatActionDialogs,
  blockUserAction,
  setChatMuted,
  unblockUserAction,
  unrestrictUserAction,
  type PendingAction,
} from './ChatActions'
import { Switch } from '@/components/ui/switch'
import type { Me } from '@/lib/callapp/types'

/**
 * Peer profile: bottom sheet on mobile, centered modal on desktop.
 * Uses only fields present on the `Me` / public user type — never invents data.
 * Phone is shown masked (last 4 digits) for privacy.
 */
export function PeerProfileSheet({
  peer,
  onClose,
  desk = false,
  embeddedActions = true,
}: {
  peer: Me
  onClose: () => void
  /** matches the `desk` computed by the caller (ChatScreen / ChatsTab variant) */
  desk?: boolean
  /** show quick actions + safety controls (default true) */
  embeddedActions?: boolean
}) {
  const online = useApp((s) => s.online[peer.id])
  const chatRow = useApp((s) => s.chats.find((c) => c.peer.id === peer.id))
  const blockedMap = useApp((s) => s.blockedIds)
  const openChat = useApp((s) => s.openChat)
  const startCall = useApp((s) => s.startCall)

  const [pending, setPending] = useState<PendingAction>(null)

  const muted = !!chatRow?.muted
  const restricted = !!chatRow?.restricted
  const blocked = !!chatRow?.blocked || !!blockedMap[peer.id]
  const official = !!peer.isOfficial

  // Escape closes the sheet — unless a safety dialog is stacked on top of it
  // (the dialog handles its own Escape via Radix).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && pending === null) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pending, onClose])

  // privacy: only the last 4 digits of the phone are ever displayed
  const phoneSuffix = (peer.phone || '').replace(/\D/g, '').slice(-4)

  return (
    <div className="fixed inset-0 z-[80] bg-black/45 animate-in fade-in duration-200" onClick={(e) => { e.stopPropagation(); onClose() }} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${peer.name} profile`}
        onClick={(e) => e.stopPropagation()}
        className={
          desk
            ? 'app-scroll desk-scroll absolute left-1/2 top-1/2 max-h-[85dvh] w-[400px] max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[24px] bg-white pb-5 shadow-[0_30px_80px_rgba(10,20,50,0.35)] animate-in fade-in zoom-in-95 duration-200'
            : 'app-scroll absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-[24px] bg-white pb-[max(env(safe-area-inset-bottom),18px)] shadow-[0_-12px_40px_rgba(10,20,50,0.25)] animate-in slide-in-from-bottom fade-in duration-300'
        }
      >
        {/* grabber + close */}
        <div className="relative">
          {!desk && <div className="mx-auto mt-3 h-1.5 w-10 rounded-full bg-cline" aria-hidden="true" />}
          <button
            type="button"
            autoFocus
            className={`absolute right-4 flex h-9 w-9 items-center justify-center rounded-full bg-csoft text-cmut transition hover:bg-cbg ${
              desk ? 'top-3.5' : 'top-2.5'
            }`}
            onClick={onClose}
            aria-label="Close profile"
          >
            <X size={18} />
          </button>
        </div>

        {/* identity */}
        <div className="flex flex-col items-center px-6 pb-1 pt-4">
          {peer.isOfficial ? (
            <OfficialAvatar size={96} online={online} />
          ) : (
            <Avatar name={peer.name} avatarKey={peer.avatarKey} size={96} online={online} src={peer.avatarUrl} />
          )}
          <div className="mt-3 flex items-center gap-1.5">
            <span className="text-[19px] font-extrabold tracking-tight text-cink">{peer.name}</span>
            <StaffTick role={peer.role} isOfficial={peer.isOfficial} size={18} />
          </div>
          {peer.username ? <p className="mt-0.5 text-[13px] font-medium text-cmut">@{peer.username}</p> : null}
          {official ? (
            <p className="mt-1 text-[12px] font-semibold text-cbrand">Official account</p>
          ) : (
            <p className="mt-1.5 text-[12px] font-medium text-cmut">{lastSeenLabel(peer.lastSeen, online)}</p>
          )}
        </div>

        {embeddedActions && (
          <>
            {/* quick actions */}
            <div className="flex gap-2 px-5 pt-4">
              <button
                type="button"
                className="flex flex-1 flex-col items-center gap-1.5 rounded-2xl bg-cbg py-3 transition hover:bg-csoft"
                onClick={() => {
                  openChat(peer.id)
                  onClose()
                }}
              >
                <MessageSquare size={20} className="text-cbrand" />
                <span className="text-[11.5px] font-bold text-cink">Message</span>
              </button>
              {!official && (
                <button
                  type="button"
                  className="flex flex-1 flex-col items-center gap-1.5 rounded-2xl bg-cbg py-3 transition hover:bg-csoft"
                  onClick={() => {
                    startCall(peer, 'voice')
                    onClose()
                  }}
                >
                  <Phone size={20} className="text-cbrand" />
                  <span className="text-[11.5px] font-bold text-cink">Voice</span>
                </button>
              )}
              {!official && (
                <button
                  type="button"
                  className="flex flex-1 flex-col items-center gap-1.5 rounded-2xl bg-cbg py-3 transition hover:bg-csoft"
                  onClick={() => {
                    startCall(peer, 'video')
                    onClose()
                  }}
                >
                  <Video size={20} className="text-cbrand" />
                  <span className="text-[11.5px] font-bold text-cink">Video</span>
                </button>
              )}
            </div>

            {/* info rows */}
            <div className="mt-3 border-t border-cline pt-1.5">
              <InfoRow icon={<Info size={16} />} label="About" value={peer.about} />
              <InfoRow icon={<Phone size={16} />} label="Phone" value={phoneSuffix ? `•••• ${phoneSuffix}` : null} />
              <InfoRow icon={<AtSign size={16} />} label="Username" value={peer.username ? `@${peer.username}` : null} />
            </div>

            {/* safety & controls */}
            <div className="mt-2 border-t border-cline px-5 pb-1 pt-2">
              <p className="py-1.5 text-[11px] font-bold uppercase tracking-wider text-cmut">Safety &amp; controls</p>

              <div className="flex items-center gap-3.5 py-2.5">
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-csoft text-cmut">
                  <BellOff size={17} />
                </span>
                <span className="min-w-0 flex-1 text-[14.5px] font-semibold text-cink">Mute notifications</span>
                <Switch
                  checked={muted}
                  onCheckedChange={(v) => void setChatMuted(peer.id, v)}
                  aria-label="Mute notifications"
                />
              </div>

              <button
                type="button"
                className="flex w-full items-center gap-3.5 rounded-lg py-2.5 text-left transition hover:bg-cbg"
                onClick={() => (restricted ? void unrestrictUserAction(peer.id, peer.name) : setPending('restrict'))}
              >
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-csoft text-cmut">
                  <ShieldBan size={17} />
                </span>
                <span className="min-w-0 flex-1 text-[14.5px] font-semibold text-cink">
                  {restricted ? `Unrestrict ${peer.name}` : `Restrict ${peer.name}`}
                </span>
              </button>

              <button
                type="button"
                className="flex w-full items-center gap-3.5 rounded-lg py-2.5 text-left transition hover:bg-[#FEF5F4]"
                onClick={() => (blocked ? void unblockUserAction(peer.id, peer.name) : setPending('block'))}
              >
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[#FEF0EF] text-cred">
                  <Ban size={17} />
                </span>
                <span className="min-w-0 flex-1 text-[14.5px] font-semibold text-cred">
                  {blocked ? `Unblock ${peer.name}` : `Block ${peer.name}`}
                </span>
              </button>

              <button
                type="button"
                className="flex w-full items-center gap-3.5 rounded-lg py-2.5 text-left transition hover:bg-[#FEF5F4]"
                onClick={() => setPending('report')}
              >
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[#FEF0EF] text-cred">
                  <Flag size={17} />
                </span>
                <span className="min-w-0 flex-1 text-[14.5px] font-semibold text-cred">Report {peer.name}</span>
              </button>
            </div>
          </>
        )}
      </div>

      {/* stacked dialogs ride above the sheet overlay */}
      <ChatActionDialogs peer={peer} pending={pending} onClose={() => setPending(null)} zClass="z-[90]" />
    </div>
  )
}

function InfoRow({ icon, label, value }: { icon: ReactNode; label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="flex items-center gap-3.5 px-5 py-2.5">
      <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-csoft text-cmut" aria-hidden="true">
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-[11px] font-bold uppercase tracking-wide text-cmut">{label}</div>
        <div className="truncate text-[14.5px] font-medium text-cink">{value}</div>
      </div>
    </div>
  )
}
