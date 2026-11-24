import { initializeApp, cert, getApps, type App } from 'firebase-admin'
import { getMessaging, type MulticastMessage } from 'firebase-admin/messaging'
import { db } from '@/lib/db'
import { getSetting } from '@/lib/callapp/server'

/**
 * Firebase Admin SDK wrapper for sending push notifications via FCM.
 *
 * Uses the firebase-admin v14 flat module API:
 *   - `initializeApp` + `cert` from 'firebase-admin'
 *   - `getMessaging` + `MulticastMessage` from 'firebase-admin/messaging'
 *
 * Firebase credentials are stored in AdminSetting key 'firebase' (JSON blob
 * containing project_id, client_email, private_key — pasted by admin in the
 * admin panel). This avoids hardcoding credentials in env vars.
 *
 * The SDK is initialized lazily on first use. If no credentials are
 * configured, push notifications silently no-op (the app still works,
 * just without push).
 */

let firebaseApp: App | null = null
let initFailed = false

export interface FirebaseConfig {
  projectId: string
  clientEmail: string
  privateKey: string
  // Web app config (for the client SDK)
  apiKey: string
  authDomain: string
  messagingSenderId: string
  appId: string
}

export async function getFirebaseConfig(): Promise<FirebaseConfig | null> {
  const cfg = await getSetting<FirebaseConfig>('firebase', {} as FirebaseConfig)
  // getSetting falls back to the empty object when the key is missing — normalize
  // that to null so callers can treat "no config" uniformly.
  if (!cfg || (!cfg.projectId && !cfg.clientEmail && !cfg.privateKey && !cfg.apiKey)) {
    return null
  }
  return cfg
}

async function getFirebaseApp(): Promise<App | null> {
  if (firebaseApp) return firebaseApp
  if (initFailed) return null
  try {
    const cfg = await getFirebaseConfig()
    if (!cfg || !cfg.projectId || !cfg.clientEmail || !cfg.privateKey) return null
    // Format the private key (admin pastes it with literal \n)
    const privateKey = cfg.privateKey.replace(/\\n/g, '\n')
    // Reuse the default app if another module path already initialized it.
    const name = '[callapp]'
    const existing = getApps().find(a => a.name === name)
    if (existing) {
      firebaseApp = existing
    } else {
      firebaseApp = initializeApp(
        {
          credential: cert({
            projectId: cfg.projectId,
            clientEmail: cfg.clientEmail,
            privateKey,
          }),
        },
        name
      )
    }
    console.log('[firebase] initialized for project:', cfg.projectId)
    return firebaseApp
  } catch (e) {
    console.error('[firebase] init failed:', e)
    initFailed = true
    return null
  }
}

export interface PushPayload {
  title: string
  body: string
  data?: Record<string, string> // custom data (refType, refId, etc.)
  imageUrl?: string
}

/**
 * Send a push notification to ALL of a user's registered devices.
 * Silently no-ops if Firebase is not configured or the user has no tokens.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  try {
    const app = await getFirebaseApp()
    if (!app) return // Firebase not configured — silent no-op

    const tokens = await db.deviceToken.findMany({
      where: { userId },
      select: { token: true, id: true },
    })
    if (tokens.length === 0) return // No registered devices

    const message: MulticastMessage = {
      tokens: tokens.map(t => t.token),
      notification: {
        title: payload.title,
        body: payload.body,
        ...(payload.imageUrl ? { imageUrl: payload.imageUrl } : {}),
      },
      data: payload.data || {},
      android: { priority: 'high' },
      apns: { payload: { aps: { sound: 'default' } } },
    }

    const response = await getMessaging(app).sendEachForMulticast(message)

    // Clean up invalid tokens (FCM returns errors for expired/unregistered tokens)
    if (response.failureCount > 0) {
      const invalidTokens: string[] = []
      response.responses.forEach((resp, idx) => {
        if (!resp.success && tokens[idx]) {
          const err = resp.error
          // These error codes mean the token is permanently invalid
          if (err && (err.code === 'messaging/invalid-registration-token' ||
                      err.code === 'messaging/registration-token-not-registered')) {
            invalidTokens.push(tokens[idx].token)
          }
        }
      })
      if (invalidTokens.length > 0) {
        await db.deviceToken.deleteMany({ where: { token: { in: invalidTokens } } })
        console.log(`[firebase] cleaned up ${invalidTokens.length} invalid tokens`)
      }
    }

    // Update lastUsed on successful sends
    await db.deviceToken.updateMany({
      where: { token: { in: tokens.map(t => t.token) } },
      data: { lastUsed: new Date() },
    })
  } catch (e) {
    console.error('[firebase] sendPushToUser failed:', e)
    // Never throw — push is best-effort, should not break the app
  }
}

/**
 * Send a push notification to ALL users (admin broadcast).
 */
export async function sendPushToAll(payload: PushPayload): Promise<number> {
  try {
    const app = await getFirebaseApp()
    if (!app) return 0

    const tokens = await db.deviceToken.findMany({ select: { token: true } })
    if (tokens.length === 0) return 0

    const messaging = getMessaging(app)
    // FCM multicast limit is 500 tokens at a time
    const BATCH = 500
    let sent = 0
    for (let i = 0; i < tokens.length; i += BATCH) {
      const batch = tokens.slice(i, i + BATCH)
      const message: MulticastMessage = {
        tokens: batch.map(t => t.token),
        notification: {
          title: payload.title,
          body: payload.body,
          ...(payload.imageUrl ? { imageUrl: payload.imageUrl } : {}),
        },
        data: payload.data || {},
        android: { priority: 'high' },
        apns: { payload: { aps: { sound: 'default' } } },
      }
      const response = await messaging.sendEachForMulticast(message)
      sent += response.successCount
    }
    return sent
  } catch (e) {
    console.error('[firebase] sendPushToAll failed:', e)
    return 0
  }
}
