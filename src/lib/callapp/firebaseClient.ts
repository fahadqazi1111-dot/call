'use client'
import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getMessaging, getToken, onMessage, type Messaging } from 'firebase/messaging'

let firebaseApp: FirebaseApp | null = null
let messaging: Messaging | null = null
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
    firebaseApp = initializeApp(webConfig)
    messaging = getMessaging(firebaseApp)
    onMessage(messaging, (payload) => {
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
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return null
    const token = await getToken(messaging, { vapidKey: vapidKey || '' })
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
