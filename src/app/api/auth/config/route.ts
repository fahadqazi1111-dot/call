import { NextResponse } from 'next/server'
import { getSetting } from '@/lib/callapp/server'
import { getOtpConfig, maskOtpConfig } from '@/lib/callapp/otpDelivery'
import type { AuthPolicy } from '@/lib/callapp/authPolicy'
import { DEFAULT_AUTH_POLICY } from '@/lib/callapp/authPolicy'
import type { FirebaseConfig } from '@/lib/callapp/firebase'

/**
 * GET /api/auth/config — public auth configuration for the sign-in screen.
 *
 * Only exposes non-secret values:
 *   - The Google OAuth *client ID* (public by design in Google Identity
 *     Services) so the client can render the GSI button.
 *   - The auth policy flags (require phone / email verification, allow
 *     phone-only or email-only registration) so the AuthScreen can adapt
 *     its UI to admin settings.
 *   - Whether an SMS provider / SMTP is configured (boolean only, never the
 *     credentials themselves) so the UI can decide whether to show the
 *     "sandbox mode" banner up front.
 *   - The Firebase *web* config (apiKey, authDomain, projectId,
 *     messagingSenderId, appId) so the client can initialize FCM and
 *     register a device token. The private_key + client_email stay
 *     server-side only.
 *
 * Nothing about credentials is ever exposed here.
 */
export async function GET() {
  try {
    const authCfg = await getSetting<Partial<AuthPolicy>>('auth', {})
    const policy: AuthPolicy = {
      requirePhoneVerification: authCfg.requirePhoneVerification ?? DEFAULT_AUTH_POLICY.requirePhoneVerification,
      requireEmailVerification: authCfg.requireEmailVerification ?? DEFAULT_AUTH_POLICY.requireEmailVerification,
      allowEmailOnlyRegistration: authCfg.allowEmailOnlyRegistration ?? DEFAULT_AUTH_POLICY.allowEmailOnlyRegistration,
      allowPhoneOnlyRegistration: authCfg.allowPhoneOnlyRegistration ?? DEFAULT_AUTH_POLICY.allowPhoneOnlyRegistration,
      googleClientId: authCfg.googleClientId,
    }
    // Surface which delivery channels are actually configured (no secrets).
    const otp = maskOtpConfig(await getOtpConfig())
    const smsConfigured =
      (otp.smsProvider === 'twilio' &&
        !!(otp.twilioAccountSid && otp.twilioAuthToken && otp.twilioFromNumber)) ||
      (otp.smsProvider === 'vonage' &&
        !!(otp.vonageApiKey && otp.vonageApiSecret && otp.vonageFromNumber))
    const whatsappConfigured = !!(otp.whatsappApiKey && otp.whatsappPhoneNumberId)

    // Firebase web config (public values only — private_key / client_email
    // are NEVER sent to the browser).
    const fb = await getSetting<Partial<FirebaseConfig>>('firebase', {} as Partial<FirebaseConfig>)
    const firebaseEnabled = !!(
      fb.apiKey &&
      fb.projectId &&
      fb.messagingSenderId &&
      fb.appId
    )
    const firebase = firebaseEnabled
      ? {
          apiKey: fb.apiKey as string,
          authDomain: fb.authDomain || `${fb.projectId}.firebaseapp.com`,
          projectId: fb.projectId as string,
          messagingSenderId: fb.messagingSenderId as string,
          appId: fb.appId as string,
        }
      : null

    return NextResponse.json({
      googleClientId: authCfg.googleClientId || null,
      googleEnabled: Boolean(authCfg.googleClientId),
      policy,
      delivery: {
        sms: smsConfigured,
        whatsapp: whatsappConfigured,
        // SMTP presence is checked by the /api/auth/email/* routes; the client
        // just reads `delivered` / `sandbox` from each request-code response.
        email: false,
      },
      firebaseEnabled,
      firebase,
    })
  } catch {
    return NextResponse.json({
      googleClientId: null,
      googleEnabled: false,
      policy: DEFAULT_AUTH_POLICY,
      delivery: { sms: false, whatsapp: false, email: false },
      firebaseEnabled: false,
      firebase: null,
    })
  }
}
