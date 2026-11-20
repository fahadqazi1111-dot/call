import { getSetting } from '@/lib/callapp/server'

/**
 * Admin-tunable auth policy. Stored under the `auth` AdminSetting key (which
 * also holds the optional Google Client ID for OAuth). All values have safe
 * defaults that mirror the original behaviour — phone is always required,
 * both phone + email verification default to on.
 */
export interface AuthPolicy {
  /** Require an OTP-verified phone before any registration. Default: on. */
  requirePhoneVerification: boolean
  /** Require an OTP-verified email before email registration. Default: on. */
  requireEmailVerification: boolean
  /** Allow signup with email only (no phone). Default: off — phone always required. */
  allowEmailOnlyRegistration: boolean
  /** Allow signup with phone only (no email). Default: on. */
  allowPhoneOnlyRegistration: boolean
  /** Optional Google OAuth Client ID for "Continue with Google". */
  googleClientId?: string
}

export const DEFAULT_AUTH_POLICY: AuthPolicy = {
  requirePhoneVerification: true,
  requireEmailVerification: true,
  allowEmailOnlyRegistration: false,
  allowPhoneOnlyRegistration: true,
}

export async function getAuthPolicy(): Promise<AuthPolicy> {
  return getSetting<AuthPolicy>('auth', DEFAULT_AUTH_POLICY)
}
