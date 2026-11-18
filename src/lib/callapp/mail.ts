import nodemailer from 'nodemailer'
import { getSetting } from './server'

/**
 * SMTP mailer driven entirely by admin settings (AdminSetting key "smtp").
 * Gmail works out of the box: host smtp.gmail.com, port 465 (secure),
 * user = the Gmail address, pass = a 16-character App Password.
 * When settings are incomplete the app falls back to the sandbox
 * behaviour (codes surfaced in the UI) — no crash, no false success.
 */

export interface SmtpSettings {
  host: string
  port: number
  secure: boolean
  user: string
  pass: string
  from: string
}

export async function getSmtpSettings(): Promise<SmtpSettings | null> {
  const s = await getSetting<Partial<SmtpSettings>>('smtp', {})
  if (!s || !s.host || !s.user || !s.pass || !s.from) return null
  return {
    host: String(s.host),
    port: Number(s.port) || 587,
    secure: Boolean(s.secure ?? Number(s.port) === 465),
    user: String(s.user),
    pass: String(s.pass),
    from: String(s.from),
  }
}

export function isValidSmtp(s: Partial<SmtpSettings> | null | undefined): boolean {
  return !!(s && s.host && s.user && s.pass && s.from)
}

function makeTransport(cfg: SmtpSettings) {
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
  })
}

function brandedEmail(title: string, body: string, code: string) {
  return `<!doctype html><html><body style="margin:0;background:#eef1f8;padding:32px 16px;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 10px 40px rgba(14,23,38,.12)">
    <div style="background:linear-gradient(135deg,#4a74ff,#2f5bea);padding:28px 32px;color:#fff">
      <div style="font-size:24px;font-weight:800;letter-spacing:1px">CALL</div>
      <div style="font-size:13px;opacity:.85;margin-top:2px">One World. One Call.</div>
    </div>
    <div style="padding:32px">
      <h1 style="margin:0 0 10px;font-size:20px;color:#0e1726">${title}</h1>
      <p style="margin:0 0 22px;font-size:14px;line-height:22px;color:#5b6577">${body}</p>
      <div style="text-align:center;background:#f5f7fc;border:1.5px dashed #b9c6e8;border-radius:14px;padding:18px">
        <div style="font-size:34px;font-weight:800;letter-spacing:10px;color:#2f5bea">${code}</div>
        <div style="font-size:12px;color:#8a94a8;margin-top:8px">expires in 10 minutes</div>
      </div>
      <p style="margin:22px 0 0;font-size:12px;color:#9aa8c7">If you did not request this code, you can safely ignore this email.</p>
    </div>
  </div>
  </body></html>`
}

export async function sendCodeEmail(
  cfg: SmtpSettings,
  to: string,
  kind: 'verify' | 'reset',
  code: string
): Promise<void> {
  const transport = makeTransport(cfg)
  const subject =
    kind === 'verify' ? 'Your CALL verification code' : 'Reset your CALL password'
  const body =
    kind === 'verify'
      ? 'Welcome to CALL. Use this 6-digit code to verify your email address.'
      : 'Use this 6-digit code to reset your CALL account password. It was requested because someone (hopefully you) clicked "Forgot password".'
  await transport.sendMail({
    from: `"CALL" <${cfg.from}>`,
    to,
    subject,
    html: brandedEmail(subject, body, code),
  })
}

/** Quick connectivity check used by the admin "test connection" button. */
export async function verifySmtpConnection(cfg: SmtpSettings): Promise<void> {
  const transport = makeTransport(cfg)
  await transport.verify()
}
