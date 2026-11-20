import { getSetting } from '@/lib/callapp/server'
import { getSmtpSettings, sendCodeEmail } from '@/lib/callapp/mail'

/**
 * OTP delivery abstraction.
 *
 * Honest design: a free, production-grade SMS OTP service does NOT exist.
 *   - Twilio, Vonage, MessageBird are all paid.
 *   - Carrier email-to-SMS gateways are unreliable and blocked by most carriers.
 *
 * So we never fake an SMS. The chain is:
 *   1. If a real SMS provider is configured in admin → send real SMS.
 *      Twilio and Vonage are supported. Both have free trial credits but
 *      eventually cost money; the admin must enter their own credentials.
 *   2. Else, if WhatsApp Business Cloud API credentials are configured,
 *      send the code as a WhatsApp text message (free for first 1,000
 *      conversations/month; requires Meta Business verification).
 *   3. Else, fall back to SANDBOX mode: the code is returned to the caller
 *      so the UI can display it in a clearly marked yellow banner.
 *      This is honest — we surface the code on screen with a banner that
 *      says "configure an SMS provider for production".
 *
 * Email OTP reuses the existing SMTP abstraction in mail.ts (admin → SMTP).
 * When SMTP is not configured, email codes fall back to the same sandbox
 * behaviour.
 */

export type OtpChannel = 'sms' | 'whatsapp' | 'email' | 'sandbox'

export interface OtpDeliveryConfig {
  /** which SMS gateway to use, if any */
  smsProvider: 'none' | 'twilio' | 'vonage'
  /** Twilio credentials */
  twilioAccountSid?: string
  twilioAuthToken?: string
  twilioFromNumber?: string
  /** Vonage / Nexmo credentials */
  vonageApiKey?: string
  vonageApiSecret?: string
  vonageFromNumber?: string
  /** WhatsApp Cloud API (Meta) — access token + phone number ID */
  whatsappApiKey?: string
  whatsappPhoneNumberId?: string
  whatsappFromNumber?: string
}

export interface OtpSendResult {
  /** how the code was actually delivered */
  channel: OtpChannel
  /** true when we could not deliver through a real channel — code shown in UI */
  sandbox: boolean
  /** the code itself; only present when sandbox=true */
  code?: string
  /** provider error surfaced to admin logs (never to the user) */
  error?: string
}

const DEFAULT_CONFIG: OtpDeliveryConfig = { smsProvider: 'none' }

export async function getOtpConfig(): Promise<OtpDeliveryConfig> {
  return getSetting<OtpDeliveryConfig>('otp', DEFAULT_CONFIG)
}

/** Mask sensitive parts of the config so the admin GET endpoint never leaks them. */
export function maskOtpConfig(cfg: OtpDeliveryConfig): OtpDeliveryConfig {
  const mask = (v?: string) => (v ? (v.length > 6 ? `${v.slice(0, 3)}••••${v.slice(-2)}` : '••••') : '')
  return {
    ...cfg,
    twilioAuthToken: cfg.twilioAuthToken ? mask(cfg.twilioAuthToken) : undefined,
    vonageApiSecret: cfg.vonageApiSecret ? mask(cfg.vonageApiSecret) : undefined,
    whatsappApiKey: cfg.whatsappApiKey ? mask(cfg.whatsappApiKey) : undefined,
  }
}

/**
 * Merge incoming PUT body into existing config — but never overwrite a secret
 * with a masked placeholder. (Same pattern as mergeAiConfig for AI keys.)
 */
export function mergeOtpConfig(
  incoming: Partial<OtpDeliveryConfig>,
  existing: OtpDeliveryConfig
): OtpDeliveryConfig {
  const out: OtpDeliveryConfig = { ...existing }
  for (const k of Object.keys(incoming) as (keyof OtpDeliveryConfig)[]) {
    const v = incoming[k]
    if (v === undefined) continue
    if (typeof v === 'string' && v.includes('••')) continue // masked placeholder
    ;(out as Record<keyof OtpDeliveryConfig, unknown>)[k] = v
  }
  return out
}

const OTP_BODY = (code: string) =>
  `Your CALL verification code is ${code}. It expires in 5 minutes. Do not share this code with anyone.`

/** Normalize a phone number for the provider APIs (E.164 with leading +). */
function e164(phone: string): string {
  const d = phone.replace(/\D/g, '')
  return d.startsWith('00') ? `+${d.slice(2)}` : d.startsWith('+') ? phone : `+${d}`
}

/**
 * Send a phone OTP via the best available channel.
 * Never throws — falls back to sandbox on any error so the auth flow never dead-ends.
 */
export async function sendOtp(phone: string, code: string): Promise<OtpSendResult> {
  const cfg = await getOtpConfig()
  const to = e164(phone)

  // 1. Twilio
  if (cfg.smsProvider === 'twilio' && cfg.twilioAccountSid && cfg.twilioAuthToken && cfg.twilioFromNumber) {
    try {
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${cfg.twilioAccountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            Authorization:
              'Basic ' +
              Buffer.from(`${cfg.twilioAccountSid}:${cfg.twilioAuthToken}`).toString('base64'),
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            From: cfg.twilioFromNumber,
            To: to,
            Body: OTP_BODY(code),
          }),
        }
      )
      if (!res.ok) {
        const txt = await res.text().catch(() => '')
        throw new Error(`Twilio ${res.status}: ${txt.slice(0, 200)}`)
      }
      return { channel: 'sms', sandbox: false }
    } catch (e) {
      console.error('[otp] Twilio send failed, falling back:', (e as Error).message)
    }
  }

  // 2. Vonage / Nexmo
  if (
    cfg.smsProvider === 'vonage' &&
    cfg.vonageApiKey &&
    cfg.vonageApiSecret &&
    cfg.vonageFromNumber
  ) {
    try {
      const res = await fetch('https://rest.nexmo.com/sms/json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: cfg.vonageApiKey,
          api_secret: cfg.vonageApiSecret,
          from: cfg.vonageFromNumber,
          to: to.replace('+', ''),
          text: OTP_BODY(code),
        }),
      })
      if (!res.ok) throw new Error(`Vonage HTTP ${res.status}`)
      const json = (await res.json().catch(() => ({}))) as {
        messages?: Array<{ status?: string; 'error-text'?: string }>
      }
      const status = json.messages?.[0]?.status
      if (status !== '0') {
        throw new Error(`Vonage: ${json.messages?.[0]?.['error-text'] || 'unknown error'}`)
      }
      return { channel: 'sms', sandbox: false }
    } catch (e) {
      console.error('[otp] Vonage send failed, falling back:', (e as Error).message)
    }
  }

  // 3. WhatsApp Cloud API (Meta)
  if (cfg.whatsappApiKey && cfg.whatsappPhoneNumberId) {
    try {
      const res = await fetch(
        `https://graph.facebook.com/v20.0/${cfg.whatsappPhoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${cfg.whatsappApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: to.replace('+', ''),
            type: 'text',
            text: { body: OTP_BODY(code) },
          }),
        }
      )
      if (!res.ok) {
        const txt = await res.text().catch(() => '')
        throw new Error(`WhatsApp ${res.status}: ${txt.slice(0, 200)}`)
      }
      return { channel: 'whatsapp', sandbox: false }
    } catch (e) {
      console.error('[otp] WhatsApp send failed, falling back:', (e as Error).message)
    }
  }

  // 4. Sandbox — code shown in UI with a clear banner
  return { channel: 'sandbox', sandbox: true, code }
}

/**
 * Send an email OTP. Reuses the existing SMTP settings (admin → SMTP).
 * Falls back to sandbox when SMTP is not configured or sending fails.
 */
export async function sendEmailOtp(
  email: string,
  code: string,
  purpose: 'verify' | 'reset'
): Promise<OtpSendResult> {
  const smtp = await getSmtpSettings()
  if (smtp) {
    try {
      await sendCodeEmail(smtp, email, purpose, code)
      return { channel: 'email', sandbox: false }
    } catch (e) {
      console.error('[otp] Email send failed, falling back:', (e as Error).message)
    }
  }
  return { channel: 'sandbox', sandbox: true, code }
}
