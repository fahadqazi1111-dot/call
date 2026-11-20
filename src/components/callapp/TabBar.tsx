'use client'

import { MessageCircle, Phone, Users, User, Radio, Clapperboard } from 'lucide-react'
import { useApp, type AppTab } from '@/lib/callapp/store'

const TABS: { key: AppTab; label: string; Icon: typeof MessageCircle }[] = [
  { key: 'chats', label: 'Chats', Icon: MessageCircle },
  { key: 'calls', label: 'Calls', Icon: Phone },
  { key: 'rooms', label: 'Rooms', Icon: Radio },
  { key: 'live', label: 'Live', Icon: Clapperboard },
  { key: 'contacts', label: 'Contacts', Icon: Users },
  { key: 'profile', label: 'Me', Icon: User },
]

export function TabBar() {
  const tab = useApp((s) => s.tab)
  const setTab = useApp((s) => s.setTab)
  const unreadTotal = useApp((s) => s.chats.reduce((n, c) => n + c.unread, 0))

  return (
    <nav
      className="relative z-30 flex w-full flex-none items-start justify-around border-t border-cline bg-white/95 pb-[max(env(safe-area-inset-bottom),12px)] backdrop-blur-md"
      aria-label="Main navigation"
    >
      {TABS.map(({ key, label, Icon }) => {
        const active = tab === key
        return (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`relative flex w-1/6 flex-col items-center gap-1 pt-2.5 pb-1 text-[10px] font-semibold transition-colors ${
              active ? 'text-cbrand' : 'text-[#7A8499]'
            }`}
            aria-current={active ? 'page' : undefined}
          >
            <span className={`relative ${active ? 'text-cbrand' : ''}`}>
              <Icon size={22} strokeWidth={active ? 2.2 : 1.8} />
              {key === 'chats' && unreadTotal > 0 && (
                <span className="absolute -right-2.5 -top-2 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-cbrand px-1 text-[10px] font-bold text-white">
                  {unreadTotal > 99 ? '99+' : unreadTotal}
                </span>
              )}
            </span>
            {label}
            {active && <span className="absolute -top-[1px] h-[3px] w-6 rounded-full bg-cbrand" />}
          </button>
        )
      })}
    </nav>
  )
}
