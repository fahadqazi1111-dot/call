'use client'

/**
 * Firebase Messaging client — LAZY loaded to prevent client-side crashes.
 *
 * The firebase/app and firebase/messaging packages are loaded dynamically
 * ONLY when:
 *   1. The admin has configured Firebase (checked via authConfig)
 *   2. The user is logged in
 *
 * If Firebase is not configured, these modules are NEVER imported, so they
 * can never crash the app. This prevents "Application error: a client-side
 * exception" on production builds where Firebase config might be missing.
 */

let firebaseApp: unknown = null
let messaging: unknown = null
let initFailed = false

export interface FirebaseWebConfig {
  apiKey: string
  authDomain: string
  projectId: string
  messagingSenderId: string
  appId: string
}

export async function initFirebaseMessaging(webConfig: FirebaseWebConfig): Promise<void> {
  if (firebaseApp || initFailed) return
  try {
    // Dynamic import — only loads firebase SDK if actually needed
    const { initializeApp } = await import('firebase/app')
    const { getMessaging, onMessage } = await import('firebase/messaging')

    firebaseApp = initializeApp(webConfig)
    messaging = getMessaging(firebaseApp as never)

    onMessage(messaging as never, (payload: unknown) => {
      console.log('[FCM] foreground message:', payload)
    })
  } catch (e) {
    console.error('[FCM] init failed:', e)
    initFailed = true
  }
}

export async function requestNotificationPermission(vapidKey?: string): Promise<string | null> {
  if (!messaging) return null
  try {
    const { getToken } = await import('firebase/messaging')
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return null
    const token = await getToken(messaging as never, { vapidKey: vapidKey || '' })
    return token
  } catch (e) {
    console.error('[FCM] getToken failed:', e)
    return null
  }
}

export async function registerServiceWorker(): Promise<void> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
  try {
    await navigator.serviceWorker.register('/firebase-messaging-sw.js')
  } catch (e) {
    console.error('[FCM] SW registration failed:', e)
  }
}
