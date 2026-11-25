'use client'

import { useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useApp, type AppTab, type AppOverlay } from '@/lib/callapp/store'

/**
 * URL Router — syncs the browser URL with the app's tab/overlay state.
 *
 * CRITICAL FIX for the "refresh goes back to admin" bug:
 *
 * The bug: when an admin user navigates to /wallet and refreshes, the app
 * re-loads, loginSuccess sets staffView='console' (because the user is staff),
 * and the admin console renders — IGNORING the /wallet URL. The user sees
 * the admin panel flash, then maybe the URL router fights it.
 *
 * The fix: the URL router runs FIRST (before loginSuccess) and reads the URL.
 * If the URL is /wallet, /coins, /ai, /notifications, or a tab path, it forces:
 *   - staffView = 'app' (so admin console does NOT render)
 *   - overlay = the matching overlay (wallet, coins, etc.)
 *   - tab = the matching tab
 *
 * This happens on INITIAL LOAD only. After that, user navigation drives the URL.
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

/** Force-apply the URL to state on initial load. Called once. */
function applyUrlToState(
  path: string,
  setTab: (t: AppTab) => void,
  setOverlay: (o: AppOverlay) => void,
  setStaffView: (v: 'console' | 'app') => void
) {
  // Overlay path? (wallet, coins, ai, admin, notifications, etc.)
  if (PATH_TO_OVERLAY[path]) {
    // CRITICAL: if the URL is /wallet, /coins, etc., we must force staffView='app'
    // so the admin console does NOT render on top. Only /admin keeps staffView='console'.
    if (path !== '/admin') {
      setStaffView('app')
    }
    setOverlay(PATH_TO_OVERLAY[path])
    return
  }
  // Chat detail path?
  const chatMatch = path.match(/^\/chat\/(.+)$/)
  if (chatMatch) {
    setStaffView('app')
    return
  }
  // Tab path? (chats, calls, rooms, live, contacts, profile)
  if (PATH_TO_TAB[path]) {
    setStaffView('app')
    setTab(PATH_TO_TAB[path])
    setOverlay(null)
    return
  }
  // Home or /login — default state (let loginSuccess decide staffView)
  if (path === '/' || path === '/login') {
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
  const setStaffView = useApp((s) => s.setStaffView)
  const openPeerId = useApp((s) => s.openPeerId)

  const initializedRef = useRef(false)
  const lastPushedPathRef = useRef<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (phase !== 'main') return

    const currentPath = window.location.pathname

    // PHASE 1: INITIAL LOAD — URL → State
    if (!initializedRef.current) {
      initializedRef.current = true
      if (currentPath !== '/' && currentPath !== '/login') {
        applyUrlToState(currentPath, setTab, setOverlay, setStaffView)
      }
      const statePath = overlay ? (OVERLAY_TO_PATH[overlay] || TAB_TO_PATH[tab]) : openPeerId ? `/chat/${openPeerId}` : (TAB_TO_PATH[tab] || '/chats')
      lastPushedPathRef.current = statePath
      return
    }

    // PHASE 2: SUBSEQUENT — State → URL
    let statePath: string
    if (overlay) {
      statePath = OVERLAY_TO_PATH[overlay] || TAB_TO_PATH[tab]
    } else if (openPeerId) {
      statePath = `/chat/${openPeerId}`
    } else {
      statePath = TAB_TO_PATH[tab] || '/chats'
    }

    if (statePath !== currentPath && statePath !== lastPushedPathRef.current) {
      lastPushedPathRef.current = statePath
      router.replace(statePath, { scroll: false })
    }
  }, [tab, overlay, phase, openPeerId, router, setTab, setOverlay, setStaffView])

  // Back/forward button: URL → State
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (phase !== 'main') return
    if (!initializedRef.current) return

    const currentPath = window.location.pathname
    if (currentPath === lastPushedPathRef.current) return

    applyUrlToState(currentPath, setTab, setOverlay, setStaffView)
    lastPushedPathRef.current = currentPath
  }, [pathname, phase, setTab, setOverlay, setStaffView])
}
