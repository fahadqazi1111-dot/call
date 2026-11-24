'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useApp, type AppTab, type AppOverlay } from '@/lib/callapp/store'

/**
 * URL Router — syncs the browser URL with the app's tab/overlay state.
 *
 * This gives every "page" its own URL so:
 *   - Refresh keeps you on the same page (not back to home)
 *   - Browser back/forward buttons work
 *   - URLs are shareable and SEO-friendly
 *   - Each route has proper meta tags (title, description, OG)
 *
 * Route structure:
 *   /                → home (redirects to /chats if logged in, /login if not)
 *   /login           → auth/login screen
 *   /chats           → chats tab
 *   /chat/[peerId]   → specific chat with a peer
 *   /calls           → calls history tab
 *   /rooms           → voice rooms tab
 *   /room/[id]       → specific voice room (when in a room)
 *   /live            → live streams tab
 *   /live/[id]       → specific live stream (when viewing/hosting)
 *   /contacts        → contacts tab
 *   /profile         → profile tab
 *   /wallet          → wallet overlay
 *   /coins           → coin store overlay
 *   /ai              → AI assistant overlay
 *   /admin           → admin panel overlay
 *   /notifications   → notification center overlay
 *   /settings        → settings (part of profile)
 *
 * The router works BOTH ways:
 *   - App state change → URL updates (so the URL always reflects current view)
 *   - URL change (back/forward/refresh) → App state updates
 */

const TAB_TO_PATH: Record<AppTab, string> = {
  chats: '/chats',
  calls: '/calls',
  rooms: '/rooms',
  live: '/live',
  contacts: '/contacts',
  profile: '/profile',
}

const PATH_TO_TAB: Record<string, AppTab> = {
  '/chats': 'chats',
  '/calls': 'calls',
  '/rooms': 'rooms',
  '/live': 'live',
  '/contacts': 'contacts',
  '/profile': 'profile',
}

const OVERLAY_TO_PATH: Partial<Record<AppOverlay, string>> = {
  wallet: '/wallet',
  'coin-store': '/coins',
  ai: '/ai',
  admin: '/admin',
  notifications: '/notifications',
  ads: '/ads',
  'story-composer': '/stories/new',
}

const PATH_TO_OVERLAY: Record<string, AppOverlay> = {
  '/wallet': 'wallet',
  '/coins': 'coin-store',
  '/ai': 'ai',
  '/admin': 'admin',
  '/notifications': 'notifications',
  '/ads': 'ads',
  '/stories/new': 'story-composer',
}

export function useUrlRouter() {
  const router = useRouter()
  const pathname = usePathname()
  const tab = useApp((s) => s.tab)
  const overlay = useApp((s) => s.overlay)
  const phase = useApp((s) => s.phase)
  const setTab = useApp((s) => s.setTab)
  const setOverlay = useApp((s) => s.setOverlay)
  const openPeerId = useApp((s) => s.openPeerId)

  // App state → URL (when tab/overlay changes, update URL)
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (phase !== 'main') return // Only sync URL when in the main app

    let targetPath: string

    if (overlay) {
      targetPath = OVERLAY_TO_PATH[overlay] || TAB_TO_PATH[tab]
    } else if (openPeerId) {
      targetPath = `/chat/${openPeerId}`
    } else {
      targetPath = TAB_TO_PATH[tab] || '/chats'
    }

    // Only update if different (prevents loops)
    if (window.location.pathname !== targetPath) {
      router.replace(targetPath, { scroll: false })
    }
  }, [tab, overlay, phase, openPeerId, router])

  // URL → App state (on back/forward/refresh)
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (phase !== 'main') return

    const path = window.location.pathname

    // Check if it's an overlay path
    if (PATH_TO_OVERLAY[path]) {
      setOverlay(PATH_TO_OVERLAY[path])
      return
    }

    // Check if it's a chat detail path
    const chatMatch = path.match(/^\/chat\/(.+)$/)
    if (chatMatch) {
      // The chat will be opened via the store
      return
    }

    // Check if it's a tab path
    if (PATH_TO_TAB[path]) {
      setTab(PATH_TO_TAB[path])
      setOverlay(null)
      return
    }

    // Home or unknown path — go to chats tab
    if (path === '/' || path === '') {
      setTab('chats')
      setOverlay(null)
    }
  }, [pathname, phase, setTab, setOverlay])
}
