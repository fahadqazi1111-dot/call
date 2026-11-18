'use client'

import { useEffect } from 'react'
import { useApp, bindGlobalSocketHandlers } from '@/lib/callapp/store'
import { socketClient } from '@/lib/callapp/socket'
import { callManager } from '@/lib/callapp/callManager'
import { Toaster, toast } from 'sonner'
import { SplashScreen } from './SplashScreen'
import { OnboardingScreen } from './OnboardingScreen'
import { AuthScreen } from './AuthScreen'
import { ChatsTab } from './ChatsTab'
import { ChatScreen } from './ChatScreen'
import { CallsTab } from './CallsTab'
import { ContactsTab } from './ContactsTab'
import { ProfileTab } from './ProfileTab'
import { TabBar } from './TabBar'
import { CallOverlay } from './CallOverlay'
import { DesktopShell } from './DesktopShell'
import { AuthBranding } from './AuthBranding'
import { useIsDesktop } from './useMediaQuery'

let handlersBound = false

export function AppRoot() {
  const phase = useApp((s) => s.phase)
  const tab = useApp((s) => s.tab)
  const openPeerId = useApp((s) => s.openPeerId)
  const call = useApp((s) => s.call)
  const me = useApp((s) => s.me)
  const isDesktop = useIsDesktop()

  useEffect(() => {
    if (!handlersBound) {
      handlersBound = true
      bindGlobalSocketHandlers()
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

  const inMain = phase === 'main' && !!me

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
      <div className="relative w-full">
        <DesktopShell />
        {call && <CallOverlay state={call} />}
        <Toaster position="bottom-right" richColors />
      </div>
    )
  }

  /* ---------- desktop / tablet: onboarding & login, full-viewport split ---------- */
  if (isDesktop) {
    return (
      <div className="relative h-[100dvh] w-full overflow-hidden">
        <div className="grid h-full w-full grid-rows-[1fr] grid-cols-1 bg-white md:grid-cols-[minmax(300px,44%)_1fr] lg:grid-cols-[minmax(0,1fr)_minmax(500px,640px)]">
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

      {call && <CallOverlay state={call} />}
      <Toaster position="top-center" richColors />
    </div>
  )
}
