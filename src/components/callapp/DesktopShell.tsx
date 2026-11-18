'use client'

import { useState } from 'react'
import {
  MessageCircle, Phone, Users, User, Lock, Mic, Video, BadgeCheck, Search, LogOut,
  Radio, Clapperboard, Bot, Coins, Bell, Shield,
} from 'lucide-react'
import { useApp } from '@/lib/callapp/store'
import { CallLogoMark } from './CallLogo'
import { Avatar } from './Avatar'
import { ChatsTab } from './ChatsTab'
import { CallsTab } from './CallsTab'
import { RoomsTab } from './RoomsTab'
import { LiveTab } from './LiveTab'
import { ContactsTab } from './ContactsTab'
import { ProfileTab } from './ProfileTab'
import { ChatScreen } from './ChatScreen'

/**
 * WhatsApp-Web style shell for tablet / desktop (>= 768px):
 * [ icon rail ] [ list panel ] [ main panel ]
 */
export function DesktopShell() {
  const tab = useApp((s) => s.tab)
  const openPeerId = useApp((s) => s.openPeerId)
  const me = useApp((s) => s.me)
  const setTab = useApp((s) => s.setTab)
  const setOverlay = useApp((s) => s.setOverlay)
  const unreadTotal = useApp((s) => s.chats.reduce((n, c) => n + c.unread, 0))
  const unreadNotifs = useApp((s) => s.unreadNotifs)

  if (!me) return null

  return (
    <div className="relative flex h-[100dvh] w-full overflow-hidden bg-white">
      {/* ============ icon rail ============ */}
      <nav
        className="flex w-[72px] shrink-0 flex-col items-center border-r border-cline bg-white py-4"
        aria-label="Main navigation"
      >
        <div className="mb-5" title="CALL — One World. One Call.">
          <CallLogoMark size={36} />
        </div>

        <RailButton active={tab === 'chats'} label="Chats" onClick={() => setTab('chats')} badge={unreadTotal} Icon={MessageCircle} />
        <RailButton active={tab === 'calls'} label="Calls" Icon={Phone} onClick={() => setTab('calls')} />
        <RailButton active={tab === 'rooms'} label="Voice Rooms" Icon={Radio} onClick={() => setTab('rooms')} />
        <RailButton active={tab === 'live'} label="Video Live" Icon={Clapperboard} onClick={() => setTab('live')} />
        <RailButton active={tab === 'contacts'} label="Contacts" Icon={Users} onClick={() => setTab('contacts')} />
        <RailButton label="CALL AI" Icon={Bot} onClick={() => setOverlay('ai')} />
        <RailButton label="Wallet" Icon={Coins} onClick={() => setOverlay('wallet')} />
        <RailButton label="Notifications" Icon={Bell} onClick={() => setOverlay('notifications')} badge={unreadNotifs} />
        {me.role === 'admin' && <RailButton label="Admin" Icon={Shield} onClick={() => setOverlay('admin')} />}
        <RailButton active={tab === 'profile'} label="Profile" Icon={User} onClick={() => setTab('profile')} />

        <div className="mt-auto">
          <button
            className="group flex flex-col items-center gap-1.5"
            onClick={() => setTab('profile')}
            aria-label="Open my profile"
            title="My profile"
          >
            <Avatar name={me.name} avatarKey={me.avatarKey} size={42} src={me.avatarUrl} />
            <span className="max-w-[60px] truncate text-[10px] font-semibold text-cmut group-hover:text-cbrand">
              {me.name}
            </span>
          </button>
        </div>
      </nav>

      {/* ============ list panel ============ */}
      <aside
        className="w-[320px] shrink-0 border-r border-cline bg-white lg:w-[380px] xl:w-[420px]"
        aria-label="List panel"
      >
        {tab === 'chats' && <ChatsTab variant="desktop" />}
        {tab === 'calls' && <CallsTab variant="desktop" />}
        {tab === 'rooms' && <RoomsTab variant="desktop" />}
        {tab === 'live' && <LiveTab variant="desktop" />}
        {tab === 'contacts' && <ContactsTab variant="desktop" />}
        {tab === 'profile' && <ProfileListPanel />}
      </aside>

      {/* ============ main panel ============ */}
      <main className="flex min-w-0 flex-1 flex-col bg-white" aria-label="Main content">
        {tab === 'chats' &&
          (openPeerId ? (
            <ChatScreen key={openPeerId} peerId={openPeerId} variant="desktop" />
          ) : (
            <MainWelcome />
          ))}
        {tab === 'rooms' && (
          <RoomsMainPanel />
        )}
        {tab === 'live' && (
          <LiveMainPanel />
        )}
        {tab === 'calls' && (
          <MainPlaceholder
            Icon={Phone}
            title="Make your important calls"
            sub="Free, unlimited voice and video calls — straight from your browser."
            cta={{ label: 'Start a new call', action: () => setTab('contacts') }}
          />
        )}
        {tab === 'contacts' && (
          <MainPlaceholder
            Icon={Users}
            title="Your contacts, one tap away"
            sub="Sync device contacts or add numbers manually, then chat and call for free."
            cta={{ label: 'Add a contact', action: () => window.dispatchEvent(new CustomEvent('call:open-add-contact')) }}
          />
        )}
        {tab === 'profile' && <ProfileTab variant="desktop" />}
      </main>
    </div>
  )
}

/* ---------------- rooms welcome (desktop main panel) ---------------- */

function RoomsMainPanel() {
  const setTab = useApp((s) => s.setTab)
  return (
    <MainPlaceholder
      Icon={Radio}
      title="Voice Rooms"
      sub="Join live audio rooms — free hangouts or paid rooms that earn diamonds for the host. Pick a room on the left."
      cta={{ label: 'Create a room', action: () => setTab('rooms') }}
    />
  )
}

function LiveMainPanel() {
  const setTab = useApp((s) => s.setTab)
  return (
    <MainPlaceholder
      Icon={Clapperboard}
      title="Video Live & Battles"
      sub="TikTok-style live broadcasts with 1v1 and 2v2 battles, gift scoring and winner announcements. Pick a stream on the left."
      cta={{ label: 'Go live', action: () => setTab('live') }}
    />
  )
}

/* ---------------- rail button ---------------- */

function RailButton({
  active,
  label,
  Icon,
  onClick,
  badge = 0,
}: {
  active: boolean
  label: string
  Icon: typeof MessageCircle
  onClick: () => void
  badge?: number
}) {
  return (
    <button
      onClick={onClick}
      className={`group relative mb-2 flex h-11 w-11 items-center justify-center rounded-full transition-colors ${
        active ? 'bg-cbrand text-white shadow-[0_6px_14px_rgba(47,91,234,0.35)]' : 'text-[#7A8499] hover:bg-cbg hover:text-cbrand'
      }`}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      title={label}
    >
      <Icon size={22} strokeWidth={active ? 2.2 : 1.9} />
      {badge > 0 && (
        <span className="absolute -right-1 -top-1 flex h-[19px] min-w-[19px] items-center justify-center rounded-full bg-cbrand px-1 text-[10px] font-bold text-white ring-2 ring-white">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
      <span className="pointer-events-none absolute left-[52px] z-20 hidden whitespace-nowrap rounded-lg bg-cink px-2.5 py-1.5 text-xs font-semibold text-white shadow-lg group-hover:block">
        {label}
      </span>
    </button>
  )
}

/* ---------------- chats welcome (WhatsApp-Web style) ---------------- */

function MainWelcome() {
  const setTab = useApp((s) => s.setTab)
  const chats = useApp((s) => s.chats)

  return (
    <div className="relative flex h-full flex-col">
      <div className="flex flex-1 flex-col items-center justify-center px-8 pb-6 text-center">
        <div className="bob-anim">
          <CallLogoMark size={104} />
        </div>
        <h2 className="mt-7 text-[34px] font-extrabold tracking-tight text-cink">CALL Web</h2>
        <p className="mt-3 max-w-md text-[15px] leading-relaxed text-cmut">
          Messages and calls are peer-to-peer and always free. Pick a conversation on the left to
          start chatting.
        </p>

        <div className="mt-8 flex items-center gap-2.5 text-[13px] font-semibold text-cmut">
          <Lock size={14} className="text-cgreen" />
          Your personal messages and calls are end-to-end encrypted
        </div>

        <div className="mt-10 grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3">
          <FeatureCard Icon={Video} title="Video calls" sub="Face to face, free forever" />
          <FeatureCard Icon={Mic} title="Voice messages" sub="Tap, talk, send instantly" />
          <FeatureCard Icon={Phone} title="Voice calls" sub="Crystal clear, unlimited" />
        </div>

        {chats.length === 0 && (
          <button className="btn-p mt-10 px-8" onClick={() => setTab('contacts')}>
            <Users size={18} /> Find people to chat with
          </button>
        )}
      </div>

      <div className="flex items-center justify-center gap-1.5 pb-5 text-[12px] font-medium text-cmut">
        <BadgeCheck size={13} className="text-cgreen" />
        One World. One Call. — free &amp; unlimited
      </div>
    </div>
  )
}

function FeatureCard({ Icon, title, sub }: { Icon: typeof Video; title: string; sub: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-[20px] border border-cline bg-white px-4 py-5 shadow-sm">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-csoft text-cbrand">
        <Icon size={20} />
      </span>
      <span className="text-sm font-bold text-cink">{title}</span>
      <span className="text-xs text-cmut">{sub}</span>
    </div>
  )
}

/* ---------------- generic placeholder for calls / contacts ---------------- */

function MainPlaceholder({
  Icon,
  title,
  sub,
  cta,
}: {
  Icon: typeof Phone
  title: string
  sub: string
  cta?: { label: string; action: () => void }
}) {
  return (
    <div className="relative flex h-full flex-col">
      <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
        <div className="bob-anim flex h-28 w-28 items-center justify-center rounded-full bg-csoft text-cbrand">
          <Icon size={52} strokeWidth={1.6} />
        </div>
        <h2 className="mt-7 text-[30px] font-extrabold tracking-tight text-cink">{title}</h2>
        <p className="mt-3 max-w-md text-[15px] leading-relaxed text-cmut">{sub}</p>
        {cta && (
          <button className="btn-p mt-8 px-8" onClick={cta.action}>
            {cta.label}
          </button>
        )}
      </div>
      <div className="flex items-center justify-center gap-1.5 pb-5 text-[12px] font-medium text-cmut">
        <Lock size={13} className="text-cgreen" />
        Peer-to-peer encrypted · One World. One Call.
      </div>
    </div>
  )
}

/* ---------------- profile list panel (left side when profile tab) ---------------- */

function ProfileListPanel() {
  const me = useApp((s) => s.me)
  const setTab = useApp((s) => s.setTab)
  const logout = useApp((s) => s.logout)
  const openChat = useApp((s) => s.openChat)
  const chats = useApp((s) => s.chats)
  const [query, setQuery] = useState('')

  if (!me) return null

  const q = query.trim().toLowerCase()
  const recents = chats
    .filter((c) => !q || c.peer.name.toLowerCase().includes(q))
    .slice(0, 8)

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-cline px-5 pb-3 pt-5">
        <h1 className="text-[26px] font-extrabold tracking-tight text-cink">Profile</h1>
      </header>

      <div className="desk-scroll flex flex-1 flex-col overflow-y-auto px-5 pb-4 pt-6">
        <div className="flex flex-col items-center text-center">
          <Avatar name={me.name} avatarKey={me.avatarKey} size={88} src={me.avatarUrl} />
          <div className="mt-3.5 text-lg font-extrabold text-cink">{me.name}</div>
          <div className="mt-0.5 text-sm text-cmut">+{me.phone}</div>
          <span className="mt-2.5 inline-block rounded-[20px] bg-[#E3EBFF] px-3.5 py-1.5 text-[12px] font-semibold text-cbrand-deep">
            {me.about}
          </span>
          <button className="btn-p mt-4 w-full" onClick={() => setTab('profile')}>
            <User size={18} /> Manage profile
          </button>
          <button
            className="mt-2 flex h-[48px] w-full items-center justify-center gap-2 rounded-[16px] text-[15px] font-semibold text-cred transition hover:bg-[#FEF0EF]"
            onClick={() => {
              if (confirm('Log out of CALL?')) logout()
            }}
          >
            <LogOut size={17} /> Log out
          </button>
        </div>

        <div className="mt-6 border-t border-cline pt-4">
          <div className="flex h-[42px] items-center gap-2.5 rounded-[12px] bg-[#F0F3FA] px-3 text-[#7A8499]">
            <Search size={17} />
            <input
              className="w-full bg-transparent text-[14px] text-cink outline-none placeholder:text-[#7A8499]"
              placeholder="Jump to a chat"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {recents.length > 0 && (
            <div className="pb-1 pt-3">
              <div className="pb-1 text-xs font-bold uppercase tracking-wide text-[#9AA8C7]">Recent chats</div>
              {recents.map((c) => (
                <button
                  key={c.conversationId}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-cbg"
                  onClick={() => {
                    openChat(c.peer.id)
                    setTab('chats')
                  }}
                >
                  <Avatar name={c.peer.name} avatarKey={c.peer.avatarKey} size={36} />
                  <span className="truncate text-[14px] font-semibold text-cink">{c.peer.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
