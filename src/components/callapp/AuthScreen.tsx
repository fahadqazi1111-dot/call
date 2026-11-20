'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { CallWordmark } from './CallLogo'
import { CountryPicker } from './CountryPicker'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  Eye,
  EyeOff,
  Info,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  Smartphone,
  User,
  XCircle,
} from 'lucide-react'
import { api, setToken } from '@/lib/callapp/api'
import { useApp } from '@/lib/callapp/store'

type Step = 'start' | 'otp' | 'forgot' | 'reset' | 'google' | 'google_phone' | 'google_otp'
type Mode = 'login' | 'signup'

interface GoogleInfo {
  name: string
  email: string
  avatarUrl?: string | null
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Turn "Ayesha Siddiqui" into "ayeshasiddiqui" — a username suggestion. */
function suggestUsername(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 16)
}

function GoogleG({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  )
}

interface GsiWindow {
  google?: {
    accounts: {
      id: {
        initialize: (cfg: { client_id: string; callback: (r: { credential: string }) => void }) => void
        renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void
      }
    }
  }
}

/* ================= shared bits ================= */

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="mb-2 block text-[13px] font-semibold text-[#4A5568]">{children}</label>
}

/**
 * Honest sandbox banner — shown only when the backend returned `sandbox: true`
 * (no SMS/SMTP provider configured). It clearly states that the code is being
 * surfaced in-app for development/preview and that production requires an
 * SMS/SMTP provider to be configured in the admin panel.
 */
function SandboxBanner({
  code,
  onFill,
  channel,
}: {
  code: string
  onFill: () => void
  channel?: 'phone' | 'email'
}) {
  return (
    <div className="mb-3 flex items-start gap-3 rounded-2xl border border-[#F5A52433] bg-[#FFF8EB] p-3.5">
      <KeyRound size={18} className="mt-0.5 flex-none text-[#B45309]" />
      <div className="text-[12.5px] leading-5 text-[#7A5B16]">
        <b>Sandbox mode.</b>{' '}
        {channel === 'email'
          ? 'No SMTP server is configured — your email code is shown here so you can complete the flow.'
          : 'No SMS provider is configured — your code is shown here so you can complete the flow.'}{' '}
        <button
          className="font-bold tracking-widest text-[#B45309] underline decoration-dotted"
          onClick={onFill}
        >
          {code}
        </button>
        <div className="mt-1 text-[11px] text-[#9A7716]">
          Configure an {channel === 'email' ? 'SMTP server' : 'SMS provider'} in Admin →
          Authentication to send real {channel === 'email' ? 'emails' : 'messages'}.
        </div>
      </div>
    </div>
  )
}

function OtpSlots({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex justify-center">
      <InputOTP maxLength={6} value={value} onChange={onChange}>
        <InputOTPGroup className="gap-2">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <InputOTPSlot
              key={i}
              index={i}
              className="h-12 w-11 rounded-2xl border-[1.5px] border-[#DDE3EE] text-base font-bold shadow-none md:h-[48px] md:w-10"
            />
          ))}
        </InputOTPGroup>
      </InputOTP>
    </div>
  )
}

function VerifiedPill({ label }: { label: string }) {
  return (
    <span className="flex items-center gap-1 rounded-full bg-[#EDFAF3] px-2 py-0.5 text-[11px] font-bold text-[#067647]">
      <CheckCircle2 size={12} /> {label}
    </span>
  )
}

/* ================= username field with live availability ================= */

function UsernameField({
  value,
  onChange,
  autoFocus,
}: {
  value: string
  onChange: (v: string) => void
  autoFocus?: boolean
}) {
  const [status, setStatus] = useState<'idle' | 'checking' | 'ok' | 'bad'>('idle')
  const [msg, setMsg] = useState('')

  useEffect(() => {
    const v = value.trim().toLowerCase()
    const t = window.setTimeout(async () => {
      if (!v) {
        setStatus('idle')
        setMsg('')
        return
      }
      if (v.length < 3) {
        setStatus('bad')
        setMsg('At least 3 characters')
        return
      }
      setStatus('checking')
      try {
        const res = await api.usernameCheck(v)
        if (res.available) {
          setStatus('ok')
          setMsg(`@${v} is available`)
        } else {
          setStatus('bad')
          setMsg(res.reason || `@${v} is taken`)
        }
      } catch {
        setStatus('idle')
        setMsg('')
      }
    }, 400)
    return () => window.clearTimeout(t)
  }, [value])

  return (
    <div>
      <FieldLabel>
        Username <span className="font-normal text-cmut">(unique handle — optional)</span>
      </FieldLabel>
      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[15px] font-bold text-cmut">@</span>
        <input
          className="app-input w-full has-icon has-trailing"
          placeholder="yourname"
          value={value}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={20}
          onChange={(e) => onChange(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
          onKeyDown={(e) => {
            if (e.key === ' ') e.preventDefault()
          }}
          autoFocus={autoFocus}
        />
        <span className="absolute right-4 top-1/2 -translate-y-1/2">
          {status === 'checking' && <Loader2 size={17} className="animate-spin text-cmut" />}
          {status === 'ok' && <CheckCircle2 size={17} className="text-[#067647]" />}
          {status === 'bad' && <XCircle size={17} className="text-cred" />}
        </span>
      </div>
      {msg && (
        <p className={`mt-1.5 text-xs ${status === 'bad' ? 'text-cred' : status === 'ok' ? 'text-[#067647]' : 'text-cmut'}`}>
          {msg}
        </p>
      )}
      <p className="mt-1 text-[11px] leading-4 text-[#9AA8C7]">
        3–20 characters · lowercase letters, numbers, underscore · leave empty and we&apos;ll generate one
      </p>
    </div>
  )
}

/* ================= main auth screen ================= */

export function AuthScreen() {
  const loginSuccess = useApp((s) => s.loginSuccess)

  const [mode, setMode] = useState<Mode>('login')
  const [step, setStep] = useState<Step>('start')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // shared
  const [country, setCountry] = useState('+92')
  const [otp, setOtp] = useState('')
  const [devCode, setDevCode] = useState('')
  const [resendIn, setResendIn] = useState(0)
  const [showPw, setShowPw] = useState(false)
  const [showPw2, setShowPw2] = useState(false)
  const resendTimer = useRef<number | null>(null)

  // login: one smart identifier — email or phone
  const [identifier, setIdentifier] = useState('')
  const idIsEmail = identifier.includes('@')
  const idDigits = identifier.replace(/\D/g, '')
  const [password, setPassword] = useState('')

  // signup (unified — phone always required, email optional)
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [usernameTouched, setUsernameTouched] = useState(false)
  const [signupEmail, setSignupEmail] = useState('')
  const [signupPassword, setSignupPassword] = useState('')

  // signup: phone OTP inline verification
  const [phoneCode, setPhoneCode] = useState('')
  const [phoneDevCode, setPhoneDevCode] = useState('')
  const [phoneSandbox, setPhoneSandbox] = useState(false)
  const [phoneSent, setPhoneSent] = useState(false)
  const [phoneVerified, setPhoneVerified] = useState(false)
  const [phoneResendIn, setPhoneResendIn] = useState(0)

  // signup: email OTP inline verification (only when email provided)
  const [emailCode, setEmailCode] = useState('')
  const [emailDevCode, setEmailDevCode] = useState('')
  const [emailSandbox, setEmailSandbox] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [emailVerified, setEmailVerified] = useState(false)
  const [emailResendIn, setEmailResendIn] = useState(0)

  // signup: terms
  const [termsAgreed, setTermsAgreed] = useState(false)

  // forgot / reset password
  const [resetEmail, setResetEmail] = useState('')
  const [resetCode, setResetCode] = useState('')
  const [resetDevCode, setResetDevCode] = useState('')
  const [resetPw, setResetPw] = useState('')
  const [resetDelivered, setResetDelivered] = useState(false)
  const [resetResendIn, setResetResendIn] = useState(0)

  // google signup (deferred): Google identity is verified, but a real phone
  // number + OTP must still be collected BEFORE the account is created.
  const [googlePendingToken, setGooglePendingToken] = useState('')
  const [googleInfo, setGoogleInfo] = useState<GoogleInfo | undefined>(undefined)
  const [googlePhone, setGooglePhone] = useState('')
  const [googleCode, setGoogleCode] = useState('')
  const [googleDevCode, setGoogleDevCode] = useState('')
  const [googleSandbox, setGoogleSandbox] = useState(false)
  const [googleSent, setGoogleSent] = useState(false)
  const [googleResendIn, setGoogleResendIn] = useState(0)

  const googleHostRef = useRef<HTMLDivElement>(null)

  // shared countdown timer for login OTP
  useEffect(() => {
    if (resendIn <= 0) return
    resendTimer.current = window.setTimeout(() => setResendIn((s) => s - 1), 1000)
    return () => {
      if (resendTimer.current) window.clearTimeout(resendTimer.current)
    }
  }, [resendIn])

  // countdown for signup phone resend
  useEffect(() => {
    if (phoneResendIn <= 0) return
    const t = window.setTimeout(() => setPhoneResendIn((s) => s - 1), 1000)
    return () => window.clearTimeout(t)
  }, [phoneResendIn])

  // countdown for signup email resend
  useEffect(() => {
    if (emailResendIn <= 0) return
    const t = window.setTimeout(() => setEmailResendIn((s) => s - 1), 1000)
    return () => window.clearTimeout(t)
  }, [emailResendIn])

  // reset password resend countdown
  useEffect(() => {
    if (resetResendIn <= 0) return
    const t = window.setTimeout(() => setResetResendIn((s) => s - 1), 1000)
    return () => window.clearTimeout(t)
  }, [resetResendIn])

  // countdown for google signup phone resend
  useEffect(() => {
    if (googleResendIn <= 0) return
    const t = window.setTimeout(() => setGoogleResendIn((s) => s - 1), 1000)
    return () => window.clearTimeout(t)
  }, [googleResendIn])

  const signupPhone = () => `${country}${phone.replace(/\D/g, '')}`
  const loginPhone = () => `${country}${idDigits}`
  const activePhone = mode === 'signup' ? signupPhone() : loginPhone()
  const googleFullPhone = () => `${country}${googlePhone.replace(/\D/g, '')}`

  const goStart = () => {
    setError('')
    setStep('start')
  }

  /* ---------- phone OTP (LOGIN only) ---------- */
  /* Login phone OTP uses /api/auth/verify which auto-creates a new account
     when the phone is unknown — preserved as a fast signup shortcut. */

  const requestOtp = async (fullPhone: string, resend = false) => {
    setBusy(true)
    setError('')
    try {
      const res = await api.requestOtp(fullPhone)
      setDevCode(res.devCode || '')
      setResendIn(30)
      if (!resend) setStep('otp')
      if (res.sandbox && res.code) {
        toast.info('Sandbox mode — code shown in the panel below.')
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const verifyOtp = async () => {
    setBusy(true)
    setError('')
    try {
      const res = await api.verifyOtp(activePhone, otp)
      if (res.needName) {
        setStep('otp')
        setError('No account exists with this number. Use the Sign up tab to create one.')
        return
      }
      if (res.token && res.user) loginSuccess(res.token, res.user)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  /* ---------- login submit (email or phone) ---------- */

  const submitLogin = () => {
    if (idIsEmail) {
      if (!EMAIL_RE.test(identifier.trim()) || !password) return
      setBusy(true)
      setError('')
      api
        .passwordLogin(identifier.trim().toLowerCase(), password)
        .then((res) => loginSuccess(res.token, res.user))
        .catch((e) => setError((e as Error).message))
        .finally(() => setBusy(false))
    } else {
      if (idDigits.length < 7) return
      void requestOtp(loginPhone())
    }
  }

  /* ---------- signup: phone OTP inline verification ---------- */

  const sendPhoneCode = async (resend = false) => {
    const p = signupPhone()
    if (p.replace(/\D/g, '').length < 7) {
      toast.error('Enter a valid phone number first')
      return
    }
    setBusy(true)
    setError('')
    try {
      const res = await api.requestOtp(p)
      setPhoneDevCode(res.devCode || '')
      setPhoneSandbox(Boolean(res.sandbox))
      setPhoneSent(true)
      setPhoneVerified(false)
      setPhoneCode('')
      setPhoneResendIn(60)
      if (res.sandbox) {
        toast.info('Sandbox mode — phone code is shown below.')
      } else {
        toast.success(`Code sent to ${p}`)
      }
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const verifyPhoneCode = async () => {
    if (phoneCode.length !== 6) {
      toast.error('Enter the 6-digit code')
      return
    }
    setBusy(true)
    setError('')
    try {
      await api.verifyPhoneOtp(signupPhone(), phoneCode)
      setPhoneVerified(true)
      setPhoneDevCode('')
      toast.success('Phone number verified')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  /* ---------- signup: email OTP inline verification ---------- */

  const sendEmailCode = async (resend = false) => {
    const e = signupEmail.trim().toLowerCase()
    if (!EMAIL_RE.test(e)) {
      toast.error('Enter a valid email first')
      return
    }
    setBusy(true)
    setError('')
    try {
      const res = await api.emailRequestCode(e, 'verify')
      setEmailDevCode(res.devCode || '')
      setEmailSandbox(Boolean(res.sandbox))
      setEmailSent(true)
      setEmailVerified(false)
      setEmailCode('')
      setEmailResendIn(60)
      if (res.sandbox) {
        toast.info('Sandbox mode — email code is shown below.')
      } else {
        toast.success(`Code emailed to ${e}`)
      }
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const verifyEmailCode = async () => {
    if (emailCode.length !== 6) {
      toast.error('Enter the 6-digit code')
      return
    }
    setBusy(true)
    setError('')
    try {
      await api.emailVerify(signupEmail.trim().toLowerCase(), emailCode)
      setEmailVerified(true)
      setEmailDevCode('')
      toast.success('Email verified')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  /* ---------- signup: create account ---------- */

  const emailProvided = EMAIL_RE.test(signupEmail.trim())
  const phoneInputReady = name.trim().length >= 2 && phone.replace(/\D/g, '').length >= 7 && signupPassword.length >= 8
  const needEmailVerify = emailProvided
  const canCreateAccount =
    phoneInputReady &&
    phoneVerified &&
    (!needEmailVerify || emailVerified) &&
    termsAgreed &&
    !busy

  const submitSignup = async () => {
    if (!canCreateAccount) {
      if (!termsAgreed) toast.error('Please accept the Terms and Privacy Policy first')
      else if (!phoneVerified) toast.error('Verify your phone number first')
      else if (needEmailVerify && !emailVerified) toast.error('Verify your email first')
      return
    }
    setBusy(true)
    setError('')
    try {
      const res = await api.passwordRegister({
        name: name.trim(),
        phone: signupPhone(),
        email: emailProvided ? signupEmail.trim().toLowerCase() : undefined,
        password: signupPassword,
        username: username.trim().toLowerCase() || undefined,
        phoneVerified: true,
        emailVerified: emailProvided ? true : undefined,
      })
      if (res.token) {
        if (res.user) {
          loginSuccess(res.token, res.user)
        } else {
          setToken(res.token)
          const me = await api.me()
          loginSuccess(res.token, me.user)
        }
      }
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  /* ---------- forgot / reset password ---------- */

  const submitForgot = async (resend = false) => {
    setBusy(true)
    setError('')
    try {
      const res = await api.passwordForgot(resetEmail.trim().toLowerCase())
      setResetDevCode(res.devCode ?? '')
      setResetDelivered(res.delivered)
      setResetResendIn(45)
      if (!resend) setStep('reset')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const submitReset = async () => {
    setBusy(true)
    setError('')
    try {
      const res = await api.passwordReset(resetEmail.trim().toLowerCase(), resetCode, resetPw)
      if (res.token && res.user) loginSuccess(res.token, res.user)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  /* ---------- google ---------- */

  const onGoogleCredential = useCallback(
    async (credential: string) => {
      setBusy(true)
      setError('')
      try {
        const res = await api.googleSignIn(credential)
        if (res.googlePending) {
          // New Google user — needs phone OTP before account creation.
          // Stash the signed pending token + Google profile, route to phone step.
          setGooglePendingToken(res.googlePendingToken || '')
          setGoogleInfo(res.googleInfo)
          setGooglePhone('')
          setGoogleCode('')
          setGoogleDevCode('')
          setGoogleSandbox(false)
          setGoogleSent(false)
          setGoogleResendIn(0)
          setStep('google_phone')
        } else if (res.token && res.user) {
          // Returning user — already has an account, log in immediately.
          loginSuccess(res.token, res.user)
        } else {
          setError('Google sign-in could not be completed. Please try again.')
          setStep('start')
        }
      } catch (e) {
        setError((e as Error).message)
        setStep('start')
      } finally {
        setBusy(false)
      }
    },
    [loginSuccess]
  )

  /* ---------- google signup: phone OTP ---------- */
  // The Google identity is verified, but the account is NOT created until
  // the user proves control of a real phone number. The signed
  // `googlePendingToken` is sent alongside the OTP code to
  // /api/auth/otp/verify, which creates the User row server-side.

  const sendGooglePhoneCode = async () => {
    const p = googleFullPhone()
    if (p.replace(/\D/g, '').length < 7) {
      toast.error('Enter a valid phone number first')
      return
    }
    setBusy(true)
    setError('')
    try {
      const res = await api.requestOtp(p)
      setGoogleDevCode(res.devCode || '')
      setGoogleSandbox(Boolean(res.sandbox))
      setGoogleSent(true)
      setGoogleCode('')
      setGoogleResendIn(60)
      setStep('google_otp')
      if (res.sandbox) {
        toast.info('Sandbox mode — phone code is shown below.')
      } else {
        toast.success(`Code sent to ${p}`)
      }
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const verifyGooglePhoneCode = async () => {
    if (googleCode.length !== 6) {
      toast.error('Enter the 6-digit code')
      return
    }
    if (!googlePendingToken) {
      toast.error('Your Google session expired. Please sign in with Google again.')
      setStep('google')
      return
    }
    setBusy(true)
    setError('')
    try {
      const res = await api.verifyPhoneOtp(googleFullPhone(), googleCode, googlePendingToken)
      if (res.created && res.token && res.user) {
        loginSuccess(res.token, res.user)
      } else if (res.verified) {
        // Verified but no account created — shouldn't happen here, but guard.
        toast.success('Phone verified')
      } else {
        setError('Could not complete signup. Please try again.')
      }
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const cancelGoogleSignup = () => {
    setGooglePendingToken('')
    setGoogleInfo(undefined)
    setGooglePhone('')
    setGoogleCode('')
    setGoogleDevCode('')
    setGoogleSandbox(false)
    setGoogleSent(false)
    setGoogleResendIn(0)
    setError('')
    setStep('start')
  }

  useEffect(() => {
    if (step !== 'google') return
    let cancelled = false
    ;(async () => {
      try {
        const cfg = await api.authConfig()
        if (!cfg.googleEnabled) {
          if (!cancelled) {
            setError('Google sign-in is not configured yet. An admin can enable it in the Admin panel (auth.googleClientId).')
          }
          return
        }
        await new Promise<void>((resolve, reject) => {
          if ((window as GsiWindow).google?.accounts?.id) return resolve()
          const s = document.createElement('script')
          s.src = 'https://accounts.google.com/gsi/client'
          s.async = true
          s.defer = true
          s.onload = () => resolve()
          s.onerror = () => reject(new Error('Could not load Google sign-in'))
          document.head.appendChild(s)
        })
        if (cancelled || !googleHostRef.current) return
        const g = (window as GsiWindow).google
        g?.accounts.id.initialize({
          client_id: cfg.googleClientId as string,
          callback: (r: { credential: string }) => void onGoogleCredential(r.credential),
        })
        if (googleHostRef.current) {
          googleHostRef.current.innerHTML = ''
          g?.accounts.id.renderButton(googleHostRef.current, {
            theme: 'outline',
            size: 'large',
            width: 320,
            text: 'continue_with',
            shape: 'pill',
          })
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [step, onGoogleCredential])

  /* ---------- derived form state ---------- */

  const loginEmailReady = EMAIL_RE.test(identifier.trim()) && password.length > 0
  const loginPhoneReady = idDigits.length >= 7
  const loginReady = idIsEmail ? loginEmailReady : loginPhoneReady

  const resetReady = EMAIL_RE.test(resetEmail.trim())
  const submitResetReady = resetCode.length === 6 && resetPw.length >= 8

  /* ---------- header copy ---------- */

  const header = (() => {
    if (step === 'otp')
      return { t: 'Verify your number', s: `We sent a 6-digit code to ${country} ${activePhone.replace(country, '')}` }
    if (step === 'forgot')
      return { t: 'Reset your password', s: 'Enter your account email — we will send you a 6-digit code.' }
    if (step === 'reset')
      return {
        t: 'Check your email',
        s: `Enter the 6-digit code we sent to ${resetEmail} and pick a new password.`,
      }
    if (step === 'google')
      return { t: 'Continue with Google', s: 'A unique username is created from your Google name automatically.' }
    if (step === 'google_phone')
      return {
        t: 'Verify your phone',
        s: 'Finishing your Google sign-up — enter your phone to receive a code.',
      }
    if (step === 'google_otp')
      return {
        t: 'Enter the code',
        s: `We sent a code to ${country} ${googleFullPhone().replace(country, '')}.`,
      }
    return mode === 'login'
      ? { t: 'Welcome back', s: 'Log in with your email or phone number.' }
      : { t: 'Create your account', s: 'Verify your phone (and email) with one-time codes, then pick a password.' }
  })()

  const switchMode = (m: Mode) => {
    setError('')
    setMode(m)
    setStep('start')
  }

  const openForgot = () => {
    setError('')
    setResetEmail(idIsEmail ? identifier.trim().toLowerCase() : '')
    setResetCode('')
    setResetDevCode('')
    setResetPw('')
    setStep('forgot')
  }

  const back = () => {
    setError('')
    if (step === 'reset') setStep('forgot')
    else if (step === 'google_otp') setStep('google_phone')
    else if (step === 'google_phone' || step === 'google') cancelGoogleSignup()
    else goStart()
  }

  const showBack = step !== 'start'
  const showTabs = step === 'start'

  return (
    <div className="app-scroll absolute inset-0 overflow-y-auto bg-white md:bg-page-grad">
      <div className="mx-auto flex min-h-full w-full max-w-[480px] flex-col px-5 pb-8 pt-14 sm:px-6 md:pb-9 md:pt-10">
        <div className="md:my-auto">
          <div className="md:rounded-[30px] md:border md:border-white md:bg-white/95 md:p-8 md:shadow-[0_36px_90px_-45px_rgba(14,23,38,0.45)] lg:p-9">
            {/* ---------- header ---------- */}
            <div>
              {showBack && (
                <button
                  className="mb-4 flex h-9 w-9 items-center justify-center rounded-full bg-csoft text-cbrand transition hover:bg-[#e2e9fb]"
                  onClick={back}
                  aria-label="Back"
                >
                  <ChevronLeft size={20} />
                </button>
              )}
              <div className="flex items-center gap-3">
                <CallWordmark size={38} showTagline={false} />
              </div>
              <h1 className="mt-5 text-[28px] font-extrabold leading-tight tracking-tight text-cink md:text-[30px]">
                {header.t}
              </h1>
              <p className="mt-1.5 text-[14.5px] leading-6 text-cmut">{header.s}</p>
            </div>

            {/* ---------- mode tabs ---------- */}
            {showTabs && (
              <div className="mt-6 grid grid-cols-2 gap-1.5 rounded-[18px] bg-cbg p-1.5">
                {(['login', 'signup'] as const).map((m) => (
                  <button
                    key={m}
                    className={`h-11 rounded-[14px] text-[14px] font-bold transition-all ${
                      mode === m
                        ? 'bg-white text-cink shadow-[0_2px_8px_rgba(14,23,38,0.1)]'
                        : 'text-cmut hover:text-cink'
                    }`}
                    onClick={() => switchMode(m)}
                  >
                    {m === 'login' ? 'Log in' : 'Sign up'}
                  </button>
                ))}
              </div>
            )}

            {/* ================= LOGIN ================= */}
            {step === 'start' && mode === 'login' && (
              <div className="mt-6">
                <FieldLabel>Email or phone</FieldLabel>
                <div className="flex gap-2.5">
                  {!idIsEmail && <CountryPicker value={country} onChange={setCountry} />}
                  <div className="relative min-w-0 flex-1">
                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-cmut">
                      {idIsEmail ? <Mail size={18} /> : <Smartphone size={18} />}
                    </span>
                    <input
                      className="app-input w-full has-icon"
                      inputMode={idIsEmail ? 'email' : 'tel'}
                      autoCapitalize="none"
                      autoComplete="email"
                      placeholder={idIsEmail ? 'you@example.com' : '3XX 1234567'}
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && loginReady && !busy && submitLogin()}
                    />
                  </div>
                </div>
                <p className="mt-1.5 text-[11.5px] leading-4 text-[#9AA8C7]">
                  Type an email to log in with your password, or a number to get a one-time code.
                </p>

                {idIsEmail && (
                  <div className="mt-4">
                    <FieldLabel>Password</FieldLabel>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-cmut">
                        <Lock size={18} />
                      </span>
                      <input
                        className="app-input w-full has-icon has-trailing"
                        type={showPw ? 'text' : 'password'}
                        autoComplete="current-password"
                        placeholder="Your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && loginReady && !busy && submitLogin()}
                      />
                      <button
                        type="button"
                        className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-cmut transition hover:bg-cbg hover:text-cink"
                        onClick={() => setShowPw((v) => !v)}
                        aria-label={showPw ? 'Hide password' : 'Show password'}
                      >
                        {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
                      </button>
                    </div>
                    <div className="mt-2 text-right">
                      <button
                        type="button"
                        className="text-[13px] font-semibold text-cbrand hover:underline"
                        onClick={openForgot}
                      >
                        Forgot password?
                      </button>
                    </div>
                  </div>
                )}

                <button
                  className="btn-p mt-4 w-full disabled:opacity-50"
                  disabled={busy || !loginReady}
                  onClick={submitLogin}
                >
                  {busy ? (
                    <>
                      <Loader2 size={18} className="animate-spin" /> Please wait…
                    </>
                  ) : idIsEmail ? (
                    'Log in'
                  ) : (
                    <>
                      <Phone size={18} /> Send code
                    </>
                  )}
                </button>

                <div className="my-5 flex items-center gap-3 text-[12.5px] text-cmut">
                  <div className="h-px flex-1 bg-cline" /> or <div className="h-px flex-1 bg-cline" />
                </div>

                <button
                  className="btn-p flex w-full items-center justify-center gap-2.5 border border-cline bg-white text-cink shadow-[0_1px_2px_rgba(14,23,38,0.08)]"
                  onClick={() => {
                    setError('')
                    setStep('google')
                  }}
                >
                  <GoogleG /> Continue with Google
                </button>

                <p className="mt-5 text-center text-[11.5px] leading-4 text-[#9AA8C7]">
                  By continuing you agree to CALL&apos;s{' '}
                  <Link
                    href="/legal/terms"
                    className="underline-offset-2 hover:text-cbrand hover:underline"
                  >
                    Terms
                  </Link>{' '}
                  and{' '}
                  <Link
                    href="/legal/privacy"
                    className="underline-offset-2 hover:text-cbrand hover:underline"
                  >
                    Privacy Policy
                  </Link>
                  .
                </p>
              </div>
            )}

            {/* ================= SIGNUP (unified — phone always, email optional) ================= */}
            {step === 'start' && mode === 'signup' && (
              <div className="mt-6">
                {/* Full name */}
                <FieldLabel>Full name</FieldLabel>
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-cmut">
                    <User size={18} />
                  </span>
                  <input
                    className="app-input w-full has-icon"
                    placeholder="Your name"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value)
                      if (!usernameTouched) setUsername(suggestUsername(e.target.value))
                    }}
                  />
                </div>

                <div className="mt-4">
                  <UsernameField
                    value={username}
                    onChange={(v) => {
                      setUsernameTouched(true)
                      setUsername(v)
                    }}
                  />
                </div>

                {/* Phone (always required) */}
                <div className="mt-4">
                  <FieldLabel>
                    Phone number <span className="font-normal text-cmut">(required — we verify it)</span>
                  </FieldLabel>
                  <div className="flex gap-2.5">
                    <CountryPicker value={country} onChange={setCountry} />
                    <div className="relative min-w-0 flex-1">
                      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-cmut">
                        <Smartphone size={18} />
                      </span>
                      <input
                        className="app-input w-full has-icon"
                        inputMode="tel"
                        placeholder="3XX 1234567"
                        value={phone}
                        onChange={(e) => {
                          setPhone(e.target.value)
                          setPhoneVerified(false)
                          setPhoneSent(false)
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Email (optional, but if entered, must be verified) */}
                <div className="mt-3">
                  <FieldLabel>
                    Email <span className="font-normal text-cmut">(optional — recommended for recovery)</span>
                  </FieldLabel>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-cmut">
                      <Mail size={18} />
                    </span>
                    <input
                      className="app-input w-full has-icon"
                      type="email"
                      inputMode="email"
                      autoCapitalize="none"
                      autoComplete="email"
                      placeholder="you@example.com"
                      value={signupEmail}
                      onChange={(e) => {
                        setSignupEmail(e.target.value)
                        setEmailVerified(false)
                        setEmailSent(false)
                      }}
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="mt-3">
                  <FieldLabel>Password</FieldLabel>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-cmut">
                      <Lock size={18} />
                    </span>
                    <input
                      className="app-input w-full has-icon has-trailing"
                      type={showPw ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="At least 8 characters"
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-cmut transition hover:bg-cbg hover:text-cink"
                      onClick={() => setShowPw((v) => !v)}
                      aria-label={showPw ? 'Hide password' : 'Show password'}
                    >
                      {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </div>

                {/* ============ Phone OTP verification (inline) ============ */}
                <div className="mt-5 rounded-2xl border border-cline bg-[#FBFCFE] p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="flex items-center gap-1.5 text-[13px] font-bold text-cink">
                      <Smartphone size={15} className="text-cbrand" /> Phone verification
                      {phoneVerified && <VerifiedPill label="Verified" />}
                    </p>
                    {!phoneVerified && (
                      <button
                        className="rounded-full bg-csoft px-3 py-1.5 text-[11.5px] font-bold text-cbrand transition hover:bg-[#e2e9fb] disabled:opacity-50"
                        disabled={busy || phone.replace(/\D/g, '').length < 7 || phoneResendIn > 0}
                        onClick={() => void sendPhoneCode()}
                      >
                        {phoneResendIn > 0
                          ? `Resend in ${phoneResendIn}s`
                          : phoneSent
                            ? 'Resend code'
                            : 'Send code'}
                      </button>
                    )}
                  </div>

                  {!phoneVerified && phoneSent && (
                    <div className="mt-3">
                      {phoneSandbox && phoneDevCode && (
                        <SandboxBanner
                          code={phoneDevCode}
                          channel="phone"
                          onFill={() => setPhoneCode(phoneDevCode)}
                        />
                      )}
                      <OtpSlots value={phoneCode} onChange={setPhoneCode} />
                      <button
                        className="btn-p mt-3 w-full disabled:opacity-50"
                        disabled={busy || phoneCode.length < 6}
                        onClick={() => void verifyPhoneCode()}
                      >
                        <ShieldCheck size={16} /> {busy ? 'Verifying…' : 'Verify phone'}
                      </button>
                    </div>
                  )}

                  {!phoneSent && !phoneVerified && (
                    <p className="mt-1 text-[11.5px] leading-4 text-cmut">
                      Tap <b>Send code</b> to receive a 6-digit verification code by SMS (or shown here in sandbox mode when no SMS provider is configured).
                    </p>
                  )}
                </div>

                {/* ============ Email OTP verification (inline, only if email provided) ============ */}
                {emailProvided && (
                  <div className="mt-3 rounded-2xl border border-cline bg-[#FBFCFE] p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="flex items-center gap-1.5 text-[13px] font-bold text-cink">
                        <Mail size={15} className="text-cbrand" /> Email verification
                        {emailVerified && <VerifiedPill label="Verified" />}
                      </p>
                      {!emailVerified && (
                        <button
                          className="rounded-full bg-csoft px-3 py-1.5 text-[11.5px] font-bold text-cbrand transition hover:bg-[#e2e9fb] disabled:opacity-50"
                          disabled={busy || emailResendIn > 0}
                          onClick={() => void sendEmailCode()}
                        >
                          {emailResendIn > 0
                            ? `Resend in ${emailResendIn}s`
                            : emailSent
                              ? 'Resend code'
                              : 'Send code'}
                        </button>
                      )}
                    </div>

                    {!emailVerified && emailSent && (
                      <div className="mt-3">
                        {emailSandbox && emailDevCode && (
                          <SandboxBanner
                            code={emailDevCode}
                            channel="email"
                            onFill={() => setEmailCode(emailDevCode)}
                          />
                        )}
                        <OtpSlots value={emailCode} onChange={setEmailCode} />
                        <button
                          className="btn-p mt-3 w-full disabled:opacity-50"
                          disabled={busy || emailCode.length < 6}
                          onClick={() => void verifyEmailCode()}
                        >
                          <ShieldCheck size={16} /> {busy ? 'Verifying…' : 'Verify email'}
                        </button>
                      </div>
                    )}

                    {!emailSent && !emailVerified && (
                      <p className="mt-1 text-[11.5px] leading-4 text-cmut">
                        Tap <b>Send code</b> to receive a 6-digit code by email (or shown here in sandbox mode when SMTP is not configured).
                      </p>
                    )}
                  </div>
                )}

                {/* Terms agreement */}
                <label className="mt-5 flex items-start gap-2.5 rounded-2xl bg-cbg p-3.5 text-[12.5px] leading-5 text-cmut">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 flex-none accent-[#2f5bea]"
                    checked={termsAgreed}
                    onChange={(e) => setTermsAgreed(e.target.checked)}
                  />
                  <span>
                    I agree to CALL&apos;s{' '}
                    <Link href="/legal/terms" className="text-cbrand underline-offset-2 hover:underline">
                      Terms of Service
                    </Link>{' '}
                    and{' '}
                    <Link href="/legal/privacy" className="text-cbrand underline-offset-2 hover:underline">
                      Privacy Policy
                    </Link>
                    .
                  </span>
                </label>

                <button
                  className="btn-p mt-5 w-full disabled:opacity-50"
                  disabled={!canCreateAccount}
                  onClick={() => void submitSignup()}
                >
                  {busy ? (
                    <>
                      <Loader2 size={18} className="animate-spin" /> Creating account…
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={18} /> Create my account
                    </>
                  )}
                </button>

                <div className="my-5 flex items-center gap-3 text-[12.5px] text-cmut">
                  <div className="h-px flex-1 bg-cline" /> or <div className="h-px flex-1 bg-cline" />
                </div>

                <button
                  className="btn-p flex w-full items-center justify-center gap-2.5 border border-cline bg-white text-cink shadow-[0_1px_2px_rgba(14,23,38,0.08)]"
                  onClick={() => {
                    setError('')
                    setStep('google')
                  }}
                >
                  <GoogleG /> Continue with Google
                </button>

                {/* Honest sandbox notice */}
                <div className="mt-5 flex items-start gap-2 rounded-2xl bg-cbg p-3.5 text-[11.5px] leading-5 text-cmut">
                  <Info size={15} className="mt-0.5 flex-none text-cbrand" />
                  <span>
                    CALL never fakes SMS — when no SMS provider is configured, codes are shown in a
                    yellow <b>Sandbox mode</b> banner above. For production, an admin adds Twilio /
                    Vonage / WhatsApp credentials under Admin → Authentication.
                  </span>
                </div>
              </div>
            )}

            {/* ================= phone OTP (LOGIN) ================= */}
            {step === 'otp' && (
              <div className="mt-6">
                {devCode && <SandboxBanner code={devCode} channel="phone" onFill={() => setOtp(devCode)} />}
                <OtpSlots value={otp} onChange={setOtp} />
                <button
                  className="btn-p mt-6 w-full disabled:opacity-50"
                  disabled={busy || otp.length < 6}
                  onClick={() => void verifyOtp()}
                >
                  <ShieldCheck size={18} /> {busy ? 'Verifying…' : 'Verify & continue'}
                </button>
                <div className="mt-4 text-center text-sm text-cmut">
                  {resendIn > 0 ? (
                    <span>
                      Resend code in <b className="text-cbrand">{resendIn}s</b>
                    </span>
                  ) : (
                    <button
                      className="font-semibold text-cbrand"
                      onClick={() => void requestOtp(activePhone, true)}
                    >
                      Resend code
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ================= forgot password ================= */}
            {step === 'forgot' && (
              <div className="mt-6">
                <FieldLabel>Account email</FieldLabel>
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-cmut">
                    <Mail size={18} />
                  </span>
                  <input
                    className="app-input w-full has-icon"
                    type="email"
                    inputMode="email"
                    autoCapitalize="none"
                    placeholder="you@example.com"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && resetReady && !busy) void submitForgot()
                    }}
                    autoFocus
                  />
                </div>
                <p className="mt-2 text-[12px] leading-5 text-cmut">
                  We email a 6-digit code to this address. Set a new password with it — takes less than a minute.
                </p>
                <button
                  className="btn-p mt-5 w-full disabled:opacity-50"
                  disabled={busy || !resetReady}
                  onClick={() => void submitForgot()}
                >
                  <Mail size={18} /> {busy ? 'Sending…' : 'Email me a code'}
                </button>
              </div>
            )}

            {/* ================= reset password ================= */}
            {step === 'reset' && (
              <div className="mt-6">
                {resetDevCode ? (
                  <SandboxBanner code={resetDevCode} channel="email" onFill={() => setResetCode(resetDevCode)} />
                ) : (
                  resetDelivered && (
                    <div className="mb-5 flex items-center gap-3 rounded-2xl border border-[#12B76A33] bg-[#EDFAF3] p-4">
                      <CheckCircle2 size={20} className="flex-none text-[#067647]" />
                      <div className="text-[13px] leading-5 text-[#0B5B38]">
                        Code emailed to <b>{resetEmail}</b>. Check your inbox (and spam folder).
                      </div>
                    </div>
                  )
                )}
                <OtpSlots value={resetCode} onChange={setResetCode} />
                <div className="mt-5">
                  <FieldLabel>New password</FieldLabel>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-cmut">
                      <Lock size={18} />
                    </span>
                    <input
                      className="app-input w-full has-icon has-trailing"
                      type={showPw2 ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="At least 8 characters"
                      value={resetPw}
                      onChange={(e) => setResetPw(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && submitResetReady && !busy) void submitReset()
                      }}
                    />
                    <button
                      type="button"
                      className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-cmut transition hover:bg-cbg hover:text-cink"
                      onClick={() => setShowPw2((v) => !v)}
                      aria-label={showPw2 ? 'Hide password' : 'Show password'}
                    >
                      {showPw2 ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </div>
                <button
                  className="btn-p mt-5 w-full disabled:opacity-50"
                  disabled={busy || !submitResetReady}
                  onClick={() => void submitReset()}
                >
                  <ShieldCheck size={18} /> {busy ? 'Saving…' : 'Set new password'}
                </button>
                <div className="mt-4 text-center text-sm text-cmut">
                  {resetResendIn > 0 ? (
                    <span>
                      Resend email in <b className="text-cbrand">{resetResendIn}s</b>
                    </span>
                  ) : (
                    <button className="font-semibold text-cbrand" onClick={() => void submitForgot(true)}>
                      Resend email
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ================= google ================= */}
            {step === 'google' && (
              <div className="mt-7">
                <div className="flex min-h-[130px] flex-col items-center justify-center gap-4 rounded-3xl border border-cline bg-cbg p-6">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm">
                    <GoogleG size={24} />
                  </span>
                  <p className="max-w-[300px] text-center text-[13px] leading-5 text-cmut">
                    A unique username is generated from your Google name automatically. You can change it later
                    from your profile.
                  </p>
                  <div ref={googleHostRef} className="flex min-h-[44px] items-center justify-center" />
                  {busy && (
                    <div className="flex items-center gap-2 text-sm text-cmut">
                      <Loader2 size={16} className="animate-spin" /> Signing you in…
                    </div>
                  )}
                </div>
                <div className="mt-4 flex items-start gap-2 rounded-2xl bg-cbg p-4 text-[12px] leading-5 text-cmut">
                  <Info size={15} className="mt-0.5 flex-none text-cbrand" />
                  <span>
                    Google sign-in needs a Google Client ID configured by the admin (Admin panel → Settings →
                    Auth). Until then, use phone or email.
                  </span>
                </div>
              </div>
            )}

            {/* ================= google_phone (deferred signup) ================= */}
            {step === 'google_phone' && (
              <div className="mt-6">
                {/* Google identity summary */}
                {googleInfo && (
                  <div className="mb-4 flex items-center gap-3 rounded-2xl border border-cline bg-[#FBFCFE] p-3.5">
                    {googleInfo.avatarUrl ? (
                      <img
                        src={googleInfo.avatarUrl}
                        alt=""
                        className="h-10 w-10 flex-none rounded-full object-cover"
                      />
                    ) : (
                      <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-white shadow-sm">
                        <GoogleG size={20} />
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-[13.5px] font-bold text-cink">{googleInfo.name}</p>
                      <p className="truncate text-[12px] text-cmut">{googleInfo.email}</p>
                    </div>
                    <span className="ml-auto flex-none">
                      <VerifiedPill label="Google verified" />
                    </span>
                  </div>
                )}

                <FieldLabel>
                  Phone number <span className="font-normal text-cmut">(required to finish sign-up)</span>
                </FieldLabel>
                <div className="flex gap-2.5">
                  <CountryPicker value={country} onChange={setCountry} />
                  <div className="relative min-w-0 flex-1">
                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-cmut">
                      <Smartphone size={18} />
                    </span>
                    <input
                      className="app-input w-full has-icon"
                      inputMode="tel"
                      placeholder="3XX 1234567"
                      value={googlePhone}
                      autoFocus
                      onChange={(e) => setGooglePhone(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !busy && googlePhone.replace(/\D/g, '').length >= 7) {
                          void sendGooglePhoneCode()
                        }
                      }}
                    />
                  </div>
                </div>
                <p className="mt-1.5 text-[11.5px] leading-4 text-[#9AA8C7]">
                  We never create an account from Google alone — your phone proves you&apos;re real and lets
                  contacts find you.
                </p>

                <button
                  className="btn-p mt-4 w-full disabled:opacity-50"
                  disabled={busy || googlePhone.replace(/\D/g, '').length < 7}
                  onClick={() => void sendGooglePhoneCode()}
                >
                  {busy ? (
                    <>
                      <Loader2 size={18} className="animate-spin" /> Sending…
                    </>
                  ) : (
                    <>
                      <Phone size={18} /> Send code
                    </>
                  )}
                </button>

                <button
                  type="button"
                  className="mt-3 w-full text-center text-[12.5px] font-semibold text-cmut transition hover:text-cink"
                  onClick={cancelGoogleSignup}
                >
                  Use a different account
                </button>
              </div>
            )}

            {/* ================= google_otp (deferred signup) ================= */}
            {step === 'google_otp' && (
              <div className="mt-6">
                {googleSandbox && googleDevCode && (
                  <SandboxBanner
                    code={googleDevCode}
                    channel="phone"
                    onFill={() => setGoogleCode(googleDevCode)}
                  />
                )}
                <OtpSlots value={googleCode} onChange={setGoogleCode} />
                <button
                  className="btn-p mt-6 w-full disabled:opacity-50"
                  disabled={busy || googleCode.length < 6}
                  onClick={() => void verifyGooglePhoneCode()}
                >
                  <ShieldCheck size={18} /> {busy ? 'Creating account…' : 'Verify & create account'}
                </button>
                <div className="mt-4 text-center text-sm text-cmut">
                  {googleResendIn > 0 ? (
                    <span>
                      Resend code in <b className="text-cbrand">{googleResendIn}s</b>
                    </span>
                  ) : (
                    <button
                      className="font-semibold text-cbrand"
                      disabled={busy}
                      onClick={() => void sendGooglePhoneCode()}
                    >
                      Resend code
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  className="mt-3 w-full text-center text-[12.5px] font-semibold text-cmut transition hover:text-cink"
                  onClick={cancelGoogleSignup}
                >
                  Use a different account
                </button>
              </div>
            )}

            {/* ---------- error ---------- */}
            {error && (
              <div className="mt-4 flex items-start gap-2.5 rounded-2xl bg-[#FEF0EF] p-3.5">
                <AlertCircle size={17} className="mt-0.5 flex-none text-cred" />
                <p className="text-[13px] font-medium leading-5 text-cred">{error}</p>
              </div>
            )}
          </div>
        </div>

        <p className="mt-auto pt-8 text-center text-[12.5px] text-cmut md:pt-6">
          Secure peer-to-peer calls · Free &amp; unlimited
        </p>
      </div>
    </div>
  )
}
