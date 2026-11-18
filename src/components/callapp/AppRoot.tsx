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

let handlersBound = false

export function AppRoot() {
  const phase = useApp((s) => s.phase)
  const tab = useApp((s) => s.tab)
  const openPeerId = useApp((s) => s.openPeerId)
  const call = useApp((s) => s.call)
  const me = useApp((s) => s.me)

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

  return (
    <div className="bg-page-grad flex min-h-[100dvh] w-full justify-center">
      <div className="relative flex h-[100dvh] w-full max-w-[430px] flex-col overflow-hidden bg-white sm:my-4 sm:h-[calc(100dvh-32px)] sm:rounded-[36px] sm:shadow-[0_30px_80px_rgba(14,23,38,0.35)]">
        {phase === 'main' && me ? (
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
