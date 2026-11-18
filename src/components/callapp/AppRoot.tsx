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

  /* ---------- desktop / tablet: auth & onboarding stage card ---------- */
  if (isDesktop) {
    // splash: full-window brand moment
    if (phase === 'splash') {
      return (
        <div className="relative h-[100dvh] w-full">
          <SplashScreen />
          {call && <CallOverlay state={call} />}
          <Toaster position="top-center" richColors />
        </div>
      )
    }

    // onboarding / login: split card — branding left, form right
    return (
      <div className="bg-page-grad flex min-h-[100dvh] w-full items-center justify-center p-6">
        <div className="relative grid h-[min(720px,100dvh-48px)] w-full max-w-[520px] grid-rows-[minmax(0,1fr)] overflow-hidden rounded-[32px] bg-white shadow-[0_40px_100px_rgba(14,23,38,0.4)] lg:h-[min(760px,100dvh-48px)] lg:max-w-[1060px] lg:grid-cols-[1fr_520px]">
          <AuthBranding />
          <div className="relative h-full">
            {phase === 'auth' ? <AuthScreen /> : <OnboardingScreen />}
            {call && <CallOverlay state={call} />}
          </div>
          <Toaster position="top-center" richColors />
        </div>
      </div>
    )
  }

  /* ---------- mobile: original phone layout ---------- */
  return (
    <div className="bg-page-grad flex min-h-[100dvh] w-full justify-center">
      <div className="relative flex h-[100dvh] w-full max-w-[430px] flex-col overflow-hidden bg-white sm:my-4 sm:h-[calc(100dvh-32px)] sm:rounded-[36px] sm:shadow-[0_30px_80px_rgba(14,23,38,0.35)]">
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
        ) : phase === 'onboarding' ? (
          <OnboardingScreen />
        ) : (
          <SplashScreen />
        )}

        {call && <CallOverlay state={call} />}
        <Toaster position="top-center" richColors />
      </div>
    </div>
  )
}
