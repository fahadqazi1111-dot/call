import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, getSetting, setSetting } from '@/lib/callapp/server'
import { maskAiConfig, mergeAiConfig } from '@/lib/callapp/aiProviders'
import { maskOtpConfig, mergeOtpConfig } from '@/lib/callapp/otpDelivery'
import type { OtpDeliveryConfig } from '@/lib/callapp/otpDelivery'
import type { FirebaseConfig } from '@/lib/callapp/firebase'

const OTP_DEFAULT: OtpDeliveryConfig = { smsProvider: 'none' }
const FIREBASE_DEFAULT: FirebaseConfig = {
  projectId: '',
  clientEmail: '',
  privateKey: '',
  apiKey: '',
  authDomain: '',
  messagingSenderId: '',
  appId: '',
}

/** Mask the FCM service-account private key so the admin GET endpoint never leaks it. */
function maskFirebaseConfig(cfg: FirebaseConfig): FirebaseConfig {
  return {
    ...cfg,
    privateKey: cfg.privateKey ? '••••••••' : '',
  }
}

/**
 * Merge incoming PUT body into the existing Firebase config — but never overwrite
 * the stored private_key with a masked placeholder (same pattern as AI/OTP keys:
 * the admin panel resubmits the masked value on save, which we discard).
 */
function mergeFirebaseConfig(
  incoming: Partial<FirebaseConfig>,
  existing: FirebaseConfig
): FirebaseConfig {
  const merged: FirebaseConfig = {
    projectId: String(incoming.projectId ?? existing.projectId ?? ''),
    clientEmail: String(incoming.clientEmail ?? existing.clientEmail ?? ''),
    apiKey: String(incoming.apiKey ?? existing.apiKey ?? ''),
    authDomain: String(incoming.authDomain ?? existing.authDomain ?? ''),
    messagingSenderId: String(incoming.messagingSenderId ?? existing.messagingSenderId ?? ''),
    appId: String(incoming.appId ?? existing.appId ?? ''),
    privateKey: existing.privateKey,
  }
  // Only overwrite the private key when the admin actually pasted a fresh one.
  // A pasted private key always contains the PEM marker 'PRIVATE KEY' (or at
  // least a long base64 body) — never the masked placeholder.
  const submitted = typeof incoming.privateKey === 'string' ? incoming.privateKey.trim() : ''
  if (submitted && !submitted.includes('••••') && submitted.length > 40) {
    merged.privateKey = submitted
  }
  return merged
}

/** GET: all admin settings. */
export async function GET(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const rows = await db.adminSetting.findMany()
  const settings: Record<string, unknown> = {}
  for (const r of rows) {
    try {
      settings[r.key] = JSON.parse(r.value)
    } catch {
      settings[r.key] = r.value
    }
  }
  // never expose the setup code itself
  if (settings.adminSetupCode) settings.adminSetupCode = true
  // provider API keys never leave the backend unmasked
  if (settings.ai && typeof settings.ai === 'object') {
    settings.ai = maskAiConfig(settings.ai as Record<string, unknown>)
  }
  // OTP delivery secrets (Twilio auth token, Vonage secret, WhatsApp token)
  // are masked the same way — the admin panel keeps the stored value when
  // the form is re-submitted with the masked placeholder.
  if (settings.otp && typeof settings.otp === 'object') {
    settings.otp = maskOtpConfig(settings.otp as OtpDeliveryConfig)
  }
  // Firebase service-account private key is masked the same way.
  if (settings.firebase && typeof settings.firebase === 'object') {
    settings.firebase = maskFirebaseConfig(settings.firebase as FirebaseConfig)
  }
  return NextResponse.json({ settings })
}

/** PUT { key, value } — update a settings block. */
export async function PUT(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  try {
    const body = await req.json()
    const key = String(body.key || '')
    const allowed = [
      'finance', 'rooms', 'live', 'calls', 'ai', 'ads', 'auth', 'smtp',
      'messaging', 'app', 'otp', 'coins', 'firebase',
    ]
    if (!allowed.includes(key)) return NextResponse.json({ error: 'Unknown settings key' }, { status: 400 })
    const existing = await getSetting<Record<string, unknown>>(key, {})
    let merged: Record<string, unknown>
    let responseValue: Record<string, unknown> = {}
    if (key === 'ai') {
      merged = mergeAiConfig(body.value || {}, existing) as Record<string, unknown>
      responseValue = maskAiConfig(merged) as Record<string, unknown>
    } else if (key === 'otp') {
      merged = mergeOtpConfig(
        (body.value || {}) as Partial<OtpDeliveryConfig>,
        (existing as Partial<OtpDeliveryConfig>) as OtpDeliveryConfig || OTP_DEFAULT
      ) as Record<string, unknown>
      responseValue = maskOtpConfig(merged as OtpDeliveryConfig) as Record<string, unknown>
    } else if (key === 'firebase') {
      merged = mergeFirebaseConfig(
        (body.value || {}) as Partial<FirebaseConfig>,
        ((existing as Partial<FirebaseConfig>) as FirebaseConfig) || FIREBASE_DEFAULT
      ) as unknown as Record<string, unknown>
      responseValue = maskFirebaseConfig(merged as unknown as FirebaseConfig) as unknown as Record<string, unknown>
    } else {
      merged = { ...existing, ...body.value }
      responseValue = merged
    }
    await setSetting(key, merged)
    return NextResponse.json({ ok: true, settings: responseValue })
  } catch {
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
}
