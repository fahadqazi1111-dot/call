'use client'

import { useEffect } from 'react'
import {
  X, Bell, MessageCircle, Phone, Heart, Radio, Clapperboard, Gift,
  Swords, Wallet, Landmark, Bot, ShieldAlert, Trophy, Loader2, Megaphone, BadgeCheck,
} from 'lucide-react'
import { useApp } from '@/lib/callapp/store'

const KIND_META: Record<string, { Icon: typeof Bell; color: string }> = {
  message: { Icon: MessageCircle, color: 'bg-csoft text-cbrand' },
  missed_call: { Icon: Phone, color: 'bg-red-50 text-cred' },
  story_reaction: { Icon: Heart, color: 'bg-pink-50 text-pink-600' },
  story_reply: { Icon: MessageCircle, color: 'bg-csoft text-cbrand' },
  room_invite: { Icon: Radio, color: 'bg-csoft text-cbrand' },
  live_started: { Icon: Clapperboard, color: 'bg-pink-50 text-[#E1306C]' },
  gift: { Icon: Gift, color: 'bg-amber-50 text-[#B7791F]' },
  gift_payment: { Icon: BadgeCheck, color: 'bg-green-50 text-green-600' },
  battle_invite: { Icon: Swords, color: 'bg-violet-50 text-violet-600' },
  battle_result: { Icon: Trophy, color: 'bg-amber-50 text-[#B7791F]' },
  wallet: { Icon: Wallet, color: 'bg-green-50 text-green-600' },
  withdrawal: { Icon: Landmark, color: 'bg-amber-50 text-[#B7791F]' },
  ad: { Icon: Megaphone, color: 'bg-pink-50 text-[#D6336C]' },
  broadcast: { Icon: Megaphone, color: 'bg-csoft text-cbrand' },
  ai: { Icon: Bot, color: 'bg-csoft text-cbrand' },
  security: { Icon: ShieldAlert, color: 'bg-slate-100 text-slate-600' },
}

/** Notification center: read/unread, real-time push arrives via socket. */
export function NotificationCenter({ onClose }: { onClose: () => void }) {
  const notifications = useApp((s) => s.notifications)
  const unread = useApp((s) => s.unreadNotifs)
  const loadNotifications = useApp((s) => s.loadNotifications)
  const markNotifs = useApp((s) => s.markNotifs)

  useEffect(() => {
    void loadNotifications()
  }, [loadNotifications])

  const open = (n: { refType?: string | null; refId?: string | null }) => {
    if (n.refType === 'room') {
      window.dispatchEvent(new CustomEvent('call:open-room', { detail: n.refId }))
    } else if (n.refType === 'live') {
      window.dispatchEvent(new CustomEvent('call:open-live', { detail: n.refId }))
    }
  }

  return (
    <div className="fixed inset-0 z-[85] flex flex-col bg-white">
      <header className="flex items-center gap-3 border-b border-cline px-4 py-3.5">
        <button className="rounded-full bg-cbg p-2 text-cmut hover:text-cbrand" onClick={onClose} aria-label="Close notifications">
          <X size={20} />
        </button>
        <h2 className="flex-1 text-[16px] font-extrabold text-cink">
          Notifications {unread > 0 && <span className="ml-1 rounded-full bg-cbrand px-2 py-0.5 text-[11px] text-white">{unread} new</span>}
        </h2>
        {unread > 0 && (
          <button className="text-[12px] font-bold text-cbrand" onClick={() => void markNotifs({ all: true })}>
            Mark all read
          </button>
        )}
      </header>

      <div className="app-scroll flex-1 overflow-y-auto pb-10">
        {notifications.length === 0 && (
          <div className="flex flex-col items-center pt-20 text-center">
            <Bell size={36} className="text-[#B8C2DB]" />
            <p className="pt-3 text-[15px] font-bold text-cink">No notifications</p>
            <p className="pt-1 text-[13px] text-cmut">Messages, calls, gifts and battle invites will show up here.</p>
          </div>
        )}
        {notifications.map((n) => {
          const meta = KIND_META[n.kind] ?? KIND_META.security
          const Icon = meta.Icon
          return (
            <button
              key={n.id}
              className={`flex w-full items-start gap-3 px-5 py-3.5 text-left transition hover:bg-cbg ${!n.read ? 'bg-csoft/40' : ''}`}
              onClick={() => {
                void markNotifs({ ids: [n.id] })
                open(n)
              }}
            >
              <span className={`mt-0.5 flex h-10 w-10 flex-none items-center justify-center rounded-full ${meta.color}`}>
                <Icon size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-[14px] ${n.read ? 'font-semibold text-cink' : 'font-extrabold text-cink'}`}>{n.title}</span>
                {n.body && <span className="block truncate text-[12px] text-cmut">{n.body}</span>}
                <span className="block pt-0.5 text-[10px] text-[#9AA8C7]">{new Date(n.createdAt).toLocaleString()}</span>
              </span>
              {!n.read && <span className="mt-2 h-2.5 w-2.5 flex-none rounded-full bg-cbrand" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Small bell button with unread badge (used in headers/rails). */
export function NotificationBellButton({ onClick, dark = false }: { onClick: () => void; dark?: boolean }) {
  const unread = useApp((s) => s.unreadNotifs)
  return (
    <button
      className={`relative rounded-full p-2 ${dark ? 'text-white/85 hover:bg-white/15' : 'text-cmut hover:bg-cbg hover:text-cbrand'}`}
      onClick={onClick}
      aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`}
    >
      <Bell size={20} />
      {unread > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-cbrand px-1 text-[9px] font-bold text-white">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </button>
  )
}

/** Skeleton loader used while notifications fetch. */
export function NotifSkeleton() {
  return (
    <div className="flex justify-center pt-10">
      <Loader2 className="animate-spin text-cbrand" size={24} />
    </div>
  )
}
