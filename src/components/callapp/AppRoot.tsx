'use client'

import { useEffect } from 'react'
import { useApp, bindGlobalSocketHandlers } from '@/lib/callapp/store'
import { socketClient } from '@/lib/callapp/socket'
import { callManager } from '@/lib/callapp/callManager'
import { soundKit } from '@/lib/callapp/sound'
import { Toaster, toast } from 'sonner'
import { SplashScreen } from './SplashScreen'
import { OnboardingScreen } from './OnboardingScreen'
import { AuthScreen } from './AuthScreen'
import { ChatsTab } from './ChatsTab'
import { ChatScreen } from './ChatScreen'
import { CallsTab } from './CallsTab'
import { RoomsTab } from './RoomsTab'
import { LiveTab } from './LiveTab'
import { ContactsTab } from './ContactsTab'
import { ProfileTab } from './ProfileTab'
import { TabBar } from './TabBar'
import { CallOverlay } from './CallOverlay'
import { DesktopShell } from './DesktopShell'
import { AuthBranding } from './AuthBranding'
import { StoryComposer } from './StoryComposer'
import { AiScreen } from './AiScreen'
import { WalletScreen } from './WalletScreen'
import { AdsScreen } from './AdsScreen'
import { NotificationCenter } from './NotificationCenter'
import { AdminPanel } from './AdminPanel'
import { BattleInviteBridge } from './BattleInviteUI'
import { ConferenceInviteUI, ConferenceComposerSheet } from './ConferenceUI'
import { useIsDesktop } from './useMediaQuery'

let handlersBound = false

/** Global overlay host: renders store-driven overlays above any layout. */
function OverlayHost() {
  const overlay = useApp((s) => s.overlay)
  const setOverlay = useApp((s) => s.setOverlay)
  if (!overlay) return null
  return (
    <>
      {overlay === 'ai' && <AiScreen onClose={() => setOverlay(null)} />}
      {overlay === 'wallet' && <WalletScreen onClose={() => setOverlay(null)} />}
      {overlay === 'ads' && <AdsScreen onClose={() => setOverlay(null)} />}
      {overlay === 'notifications' && <NotificationCenter onClose={() => setOverlay(null)} />}
      {overlay === 'admin' && <AdminPanel onClose={() => setOverlay(null)} />}
      {overlay === 'story-composer' && <StoryComposer onClose={() => setOverlay(null)} />}
    </>
  )
}

/** Notification deep-links: open a room / live from the notification center. */
function DeepLinkHandler() {
  useEffect(() => {
    const openRoom = () => useApp.getState().setTab('rooms')
    const openLive = () => useApp.getState().setTab('live')
    window.addEventListener('call:open-room', openRoom)
    window.addEventListener('call:open-live', openLive)
    return () => {
      window.removeEventListener('call:open-room', openRoom)
      window.removeEventListener('call:open-live', openLive)
    }
  }, [])
  return null
}

export function AppRoot() {
  const phase = useApp((s) => s.phase)
  const tab = useApp((s) => s.tab)
  const openPeerId = useApp((s) => s.openPeerId)
  const call = useApp((s) => s.call)
  const me = useApp((s) => s.me)
  const staffView = useApp((s) => s.staffView)
  const isDesktop = useIsDesktop()

  useEffect(() => {
    if (!handlersBound) {
      handlersBound = true
      bindGlobalSocketHandlers()
      // browsers suspend WebAudio until the first user gesture — without
      // this, gift animations would be silent for passive viewers
      soundKit.installUnlock()
      callManager.setToast((msg) => toast.info(msg))
      callManager.setRefresh(() => {
        void useApp.getState().loadCalls()
        void useApp.getState().loadChats()
      })
      socketClient.on('disconnect', () => {
        if (useApp.getState().me) toast.warning('Connection lost — reconnecting…')
      })
    }
  }, [])

  // keep chats list fresh periodically
  useEffect(() => {
    if (!me) return
    const t = window.setInterval(() => {
      void useApp.getState().loadChats()
    }, 20000)
    return () => window.clearInterval(t)
  }, [me])

  const isStaff = !!me && (me.role === 'admin' || me.role === 'team')
  const inMain = phase === 'main' && !!me
  const inConsole = inMain && isStaff && staffView === 'console'

  /* ---------- staff console: admin/team land here straight after login ---------- */
  if (inConsole) {
    return (
      <div className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-white">
        <AdminPanel mode="console" />
        {call && <CallOverlay state={call} />}
        <Toaster position="top-center" richColors />
      </div>
    )
  }

  /* ---------- splash: always full-bleed, every device ---------- */
  if (phase === 'splash') {
    return (
      <div className="bg-dark-grad relative h-[100dvh] w-full overflow-hidden">
        <SplashScreen />
        {call && <CallOverlay state={call} />}
        <Toaster position="top-center" richColors />
      </div>
    )
  }

  /* ---------- desktop / tablet: WhatsApp-Web style shell ---------- */
  if (isDesktop && inMain) {
    return (
      <div className="relative h-[100dvh] w-full overflow-hidden">
        <DesktopShell />
        <OverlayHost />
        <BattleInviteBridge />
        <ConferenceInviteUI />
        <ConferenceComposerSheet />
        {call && <CallOverlay state={call} />}
        <Toaster position="bottom-right" richColors />
      </div>
    )
  }

  /* ---------- desktop / tablet: onboarding & login, full-viewport split ---------- */
  if (isDesktop) {
    return (
      <div className="relative h-[100dvh] w-full overflow-hidden">
        <div className="grid h-full w-full grid-rows-[minmax(0,1fr)] grid-cols-1 bg-white md:grid-cols-[minmax(300px,44%)_1fr] lg:grid-cols-[minmax(0,1fr)_minmax(500px,640px)]">
          <AuthBranding />
          <div className="relative h-full min-h-0">
            {phase === 'auth' ? <AuthScreen /> : <OnboardingScreen />}
            {call && <CallOverlay state={call} />}
          </div>
        </div>
        <Toaster position="top-center" richColors />
      </div>
    )
  }

  /* ---------- mobile: original phone layout ---------- */
  return (
    <div className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-white">
      {inMain ? (
        <>
          <div className="flex-1 overflow-hidden">
            {tab === 'chats' && <ChatsTab />}
            {tab === 'calls' && <CallsTab />}
            {tab === 'rooms' && <RoomsTab />}
            {tab === 'live' && <LiveTab />}
            {tab === 'contacts' && <ContactsTab />}
            {tab === 'profile' && <ProfileTab />}
          </div>
          {openPeerId && <ChatScreen peerId={openPeerId} />}
          <TabBar />
        </>
      ) : phase === 'auth' ? (
        <AuthScreen />
      ) : (
        <OnboardingScreen />
      )}

      <OverlayHost />
      <BattleInviteBridge />
      <ConferenceInviteUI />
      <ConferenceComposerSheet />
      <DeepLinkHandler />
      {call && <CallOverlay state={call} />}
      <Toaster position="top-center" richColors />
    </div>
  )
}
