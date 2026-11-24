'use client'

import { useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useApp, type AppTab, type AppOverlay } from '@/lib/callapp/store'

/**
 * URL Router — syncs the browser URL with the app's tab/overlay state.
 *
 * Route structure:
 *   /                → home (redirects to /chats if logged in, /login if not)
 *   /login           → auth/login screen
 *   /chats           → chats tab
 *   /chat/[peerId]   → specific chat with a peer
 *   /calls           → calls history tab
 *   /rooms           → voice rooms tab
 *   /live            → live streams tab
 *   /contacts        → contacts tab
 *   /profile         → profile tab
 *   /wallet          → wallet overlay
 *   /coins           → coin store overlay
 *   /ai              → AI assistant overlay
 *   /admin           → admin panel overlay (staff only)
 *   /notifications   → notification center overlay
 *
 * CRITICAL: single source of truth to prevent the "refresh glitch" where
 * the app flips between admin and wallet. The router has TWO phases:
 *
 *   1. INITIAL LOAD (first render after phase becomes 'main'):
 *      URL → State ONLY. We read the URL and set the tab/overlay to match.
 *      We do NOT push the state back to the URL (that would cause a loop).
 *
 *   2. SUBSEQUENT NAVIGATION (user clicks a tab/overlay):
 *      State → URL. We update the URL to match the new state.
 *      We do NOT re-read the URL (the state is already correct).
 *
 * The `initializedRef` flag distinguishes the two phases. Once the initial
 * sync is done, the router only pushes state→URL on subsequent changes.
 * Back/forward button (which changes the URL without changing state) is
 * handled by the `pathname` dependency.
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

/** Compute the URL path that matches the current app state. */
function stateToPath(tab: AppTab, overlay: AppOverlay, openPeerId: string | null): string {
  if (overlay) {
    return OVERLAY_TO_PATH[overlay] || TAB_TO_PATH[tab]
  }
  if (openPeerId) {
    return `/chat/${openPeerId}`
  }
  return TAB_TO_PATH[tab] || '/chats'
}

/** Apply the current URL path to the app state (URL → State). */
function applyUrlToState(
  path: string,
  setTab: (t: AppTab) => void,
  setOverlay: (o: AppOverlay) => void
) {
  // Overlay path?
  if (PATH_TO_OVERLAY[path]) {
    setOverlay(PATH_TO_OVERLAY[path])
    return
  }
  // Chat detail path?
  const chatMatch = path.match(/^\/chat\/(.+)$/)
  if (chatMatch) {
    // The chat store will open the chat based on openPeerId
    return
  }
  // Tab path?
  if (PATH_TO_TAB[path]) {
    setTab(PATH_TO_TAB[path])
    setOverlay(null)
    return
  }
  // Home or unknown — go to chats
  if (path === '/' || path === '' || path === '/login') {
    setTab('chats')
    setOverlay(null)
  }
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

  // Track whether we've done the initial URL→State sync.
  // Before this is true, we only do URL→State (on first load).
  // After it's true, we only do State→URL (on user navigation).
  const initializedRef = useRef(false)
  // Track the last path we pushed, so we don't re-apply our own push.
  const lastPushedPathRef = useRef<string | null>(null)

  // === MAIN EFFECT: runs on every relevant state/URL change ===
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (phase !== 'main') return

    const currentPath = window.location.pathname
    const statePath = stateToPath(tab, overlay, openPeerId)

    // PHASE 1: INITIAL LOAD — URL → State only
    if (!initializedRef.current) {
      initializedRef.current = true
      // Only apply URL→State if the URL is a known route (not '/')
      // If URL is '/' or '/login', keep the default state (chats tab)
      if (currentPath !== '/' && currentPath !== '/login') {
        applyUrlToState(currentPath, setTab, setOverlay)
      }
      // Record the state path so we don't immediately push it
      lastPushedPathRef.current = statePath
      return
    }

    // PHASE 2: SUBSEQUENT — State → URL
    // Only push if the state-derived path differs from the current URL
    // AND we didn't just push this path ourselves (prevents loops)
    if (statePath !== currentPath && statePath !== lastPushedPathRef.current) {
      lastPushedPathRef.current = statePath
      router.replace(statePath, { scroll: false })
    }
  }, [tab, overlay, phase, openPeerId, router, setTab, setOverlay])

  // === BACK/FORWARD BUTTON: URL → State ===
  // This fires when the user clicks browser back/forward (pathname changes
  // without a state change). We apply the URL to state.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (phase !== 'main') return
    if (!initializedRef.current) return // skip on initial load (handled above)

    const currentPath = window.location.pathname

    // If this pathname change was caused by our own push, skip
    if (currentPath === lastPushedPathRef.current) return

    // It's a back/forward navigation — apply URL to state
    applyUrlToState(currentPath, setTab, setOverlay)
    lastPushedPathRef.current = currentPath
  }, [pathname, phase, setTab, setOverlay])
}
