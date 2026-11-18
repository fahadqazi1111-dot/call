'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { CallWordmark } from './CallLogo'
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

const COUNTRIES = [
  { code: '+92', label: 'PK' },
  { code: '+91', label: 'IN' },
  { code: '+1', label: 'US' },
  { code: '+44', label: 'UK' },
  { code: '+971', label: 'AE' },
  { code: '+966', label: 'SA' },
  { code: '+62', label: 'ID' },
  { code: '+880', label: 'BD' },
  { code: '+234', label: 'NG' },
  { code: '+212', label: 'MA' },
  { code: '+90', label: 'TR' },
  { code: '+20', label: 'EG' },
]

type Step = 'start' | 'otp' | 'name' | 'verify' | 'google'
type Mode = 'login' | 'signup'
type SignupMethod = 'phone' | 'email'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Turn "Ayesha Siddiqui" into "ayeshasiddiqui" — a username suggestion. */
function suggestUsername(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 16)
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

function SandboxBanner({ code, onFill }: { code: string; onFill: () => void }) {
  return (
    <div className="mb-5 flex items-center gap-3 rounded-2xl border border-[#F5A52433] bg-[#FFF8EB] p-4">
      <KeyRound size={20} className="flex-none text-[#B45309]" />
      <div className="text-[13px] leading-5 text-[#7A5B16]">
        Sandbox code (free mode):{' '}
        <button
          className="font-bold tracking-widest text-[#B45309] underline decoration-dotted"
          onClick={onFill}
        >
          {code}
        </button>
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
              className="h-14 w-12 rounded-2xl border-[1.5px] border-[#DDE3EE] text-lg font-bold shadow-none md:h-[52px] md:w-11"
            />
          ))}
        </InputOTPGroup>
      </InputOTP>
    </div>
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
          className="app-input w-full pl-9 pr-10"
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
  const resendTimer = useRef<number | null>(null)

  // login: one smart identifier — email or phone
  const [identifier, setIdentifier] = useState('')
  const idIsEmail = identifier.includes('@')
  const idDigits = identifier.replace(/\D/g, '')
  const [password, setPassword] = useState('')

  // signup
  const [signupMethod, setSignupMethod] = useState<SignupMethod>('phone')
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [usernameTouched, setUsernameTouched] = useState(false)
  const [email, setEmail] = useState('')

  // email verification
  const [pendingToken, setPendingToken] = useState('')
  const [emailCode, setEmailCode] = useState('')
  const [emailDevCode, setEmailDevCode] = useState('')

  const googleHostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (resendIn <= 0) return
    resendTimer.current = window.setTimeout(() => setResendIn((s) => s - 1), 1000)
    return () => {
      if (resendTimer.current) window.clearTimeout(resendTimer.current)
    }
  }, [resendIn])

  const signupPhone = () => `${country}${phone.replace(/\D/g, '')}`
  const loginPhone = () => `${country}${idDigits}`
  const isSignupPhone = mode === 'signup' && signupMethod === 'phone'
  const activePhone = isSignupPhone ? signupPhone() : loginPhone()

  const goStart = () => {
    setError('')
    setStep('start')
  }

  /* ---------- phone OTP (login + signup) ---------- */

  const requestOtp = async (fullPhone: string, resend = false) => {
    setBusy(true)
    setError('')
    try {
      const res = await api.requestOtp(fullPhone)
      setDevCode(res.devCode)
      setResendIn(30)
      if (!resend) setStep('otp')
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
      const res = isSignupPhone
        ? await api.verifyOtp(activePhone, otp, name.trim(), username.trim().toLowerCase())
        : await api.verifyOtp(activePhone, otp)
      if (res.needName) {
        setStep('name')
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

  /* ---------- email + password signup ---------- */

  const submitSignupEmail = async () => {
    setBusy(true)
    setError('')
    try {
      if (!name.trim()) {
        setError('Name is required')
        return
      }
      const uname = (username.trim() || suggestUsername(name)).toLowerCase()
      const res = await api.passwordRegister(name.trim(), email.trim().toLowerCase(), password, uname)
      // session starts right away; verify the email with a code next
      setPendingToken(res.token)
      const codeRes = await api.emailRequestCode(email.trim().toLowerCase())
      setEmailDevCode(codeRes.devCode)
      setStep('verify')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const verifyEmailCode = async () => {
    setBusy(true)
    setError('')
    try {
      await api.emailVerify(email.trim().toLowerCase(), emailCode, pendingToken)
      // token must be persisted BEFORE calling /api/me (it reads it from storage)
      setToken(pendingToken)
      const me = await api.me()
      loginSuccess(pendingToken, me.user)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const skipVerify = async () => {
    try {
      setToken(pendingToken)
      const me = await api.me()
      loginSuccess(pendingToken, me.user)
    } catch {
      setError('Could not start the session — please log in again')
    }
  }

  /* ---------- google ---------- */

  const onGoogleCredential = useCallback(
    async (credential: string) => {
      setBusy(true)
      setError('')
      try {
        const res = await api.googleSignIn(credential)
        loginSuccess(res.token, res.user)
      } catch (e) {
        setError((e as Error).message)
        setStep('start')
      } finally {
        setBusy(false)
      }
    },
    [loginSuccess]
  )

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

  const signupPhoneReady = name.trim().length >= 2 && phone.replace(/\D/g, '').length >= 7
  const signupEmailReady = name.trim().length >= 2 && EMAIL_RE.test(email.trim()) && password.length >= 8

  /* ---------- header copy ---------- */

  const header = (() => {
    if (step === 'otp')
      return { t: 'Verify your number', s: `We sent a 6-digit code to ${country} ${activePhone.replace(country, '')}` }
    if (step === 'name')
      return { t: 'Set up your profile', s: 'Choose the name and username your contacts will see.' }
    if (step === 'verify')
      return { t: 'Verify your email', s: `Enter the 6-digit code sent to ${email}` }
    if (step === 'google')
      return { t: 'Continue with Google', s: 'A unique username is created from your Google name automatically.' }
    return mode === 'login'
      ? { t: 'Welcome back', s: 'Log in with your email or phone number.' }
      : { t: 'Create your account', s: 'Pick a unique @username — it becomes your handle on CALL.' }
  })()

  const switchMode = (m: Mode) => {
    setError('')
    setMode(m)
    setStep('start')
  }

  const back = () => {
    setError('')
    if (step === 'name') setStep('otp')
    else goStart()
  }

  const showBack = step !== 'start'
  const showTabs = step === 'start'

  return (
    <div className="app-scroll absolute inset-0 overflow-y-auto bg-white md:bg-page-grad">
      <div className="mx-auto flex min-h-full w-full max-w-[480px] flex-col px-5 pb-8 pt-14 sm:px-6 md:pb-9 md:pt-10">
        <div className="md:my-auto">
          <div className="md:rounded-[30px] md:border md:border-white md:bg-white/95 md:p-9 md:shadow-[0_36px_90px_-45px_rgba(14,23,38,0.45)]">
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
                  {!idIsEmail && (
                    <select
                      className="app-input w-[106px] flex-none appearance-none px-2 text-center"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      aria-label="Country code"
                    >
                      {COUNTRIES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.label} {c.code}
                        </option>
                      ))}
                    </select>
                  )}
                  <div className="relative min-w-0 flex-1">
                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-cmut">
                      {idIsEmail ? <Mail size={18} /> : <Smartphone size={18} />}
                    </span>
                    <input
                      className="app-input w-full pl-11"
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
                        className="app-input w-full pl-11 pr-12"
                        type={showPw ? 'text' : 'password'}
                        autoComplete="current-password"
                        placeholder="Your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && loginReady && !busy && submitLogin()}
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-cmut transition hover:bg-cbg hover:text-cink"
                        onClick={() => setShowPw((v) => !v)}
                        aria-label={showPw ? 'Hide password' : 'Show password'}
                      >
                        {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
                      </button>
                    </div>
                  </div>
                )}

                <button
                  className="btn-p mt-6 w-full disabled:opacity-50"
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

                <div className="mt-5 flex items-start gap-2 rounded-2xl bg-cbg p-3.5 text-[12px] leading-5 text-cmut">
                  <Info size={14} className="mt-0.5 flex-none text-cbrand" />
                  <span>
                    Free sandbox build — verification codes are shown right in the app, no SMS needed.
                  </span>
                </div>
              </div>
            )}

            {/* ================= SIGNUP ================= */}
            {step === 'start' && mode === 'signup' && (
              <div className="mt-6">
                <FieldLabel>Full name</FieldLabel>
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-cmut">
                    <User size={18} />
                  </span>
                  <input
                    className="app-input w-full pl-11"
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

                <div className="mt-5">
                  <div className="mb-2 grid grid-cols-2 gap-1.5 rounded-[16px] bg-cbg p-1.5">
                    {(['phone', 'email'] as const).map((mth) => (
                      <button
                        key={mth}
                        className={`flex h-10 items-center justify-center gap-1.5 rounded-[12px] text-[13px] font-bold transition-all ${
                          signupMethod === mth
                            ? 'bg-white text-cink shadow-[0_2px_8px_rgba(14,23,38,0.1)]'
                            : 'text-cmut hover:text-cink'
                        }`}
                        onClick={() => {
                          setError('')
                          setSignupMethod(mth)
                        }}
                      >
                        {mth === 'phone' ? <Phone size={14} /> : <Mail size={14} />}
                        {mth === 'phone' ? 'Phone' : 'Email'}
                      </button>
                    ))}
                  </div>

                  {signupMethod === 'phone' ? (
                    <div className="flex gap-2.5">
                      <select
                        className="app-input w-[106px] flex-none appearance-none px-2 text-center"
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        aria-label="Country code"
                      >
                        {COUNTRIES.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.label} {c.code}
                          </option>
                        ))}
                      </select>
                      <div className="relative min-w-0 flex-1">
                        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-cmut">
                          <Smartphone size={18} />
                        </span>
                        <input
                          className="app-input w-full pl-11"
                          inputMode="tel"
                          placeholder="3XX 1234567"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && signupPhoneReady && !busy)
                              void requestOtp(signupPhone())
                          }}
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-cmut">
                          <Mail size={18} />
                        </span>
                        <input
                          className="app-input w-full pl-11"
                          type="email"
                          inputMode="email"
                          autoCapitalize="none"
                          autoComplete="email"
                          placeholder="you@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                        />
                      </div>
                      <div className="relative mt-4">
                        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-cmut">
                          <Lock size={18} />
                        </span>
                        <input
                          className="app-input w-full pl-11 pr-12"
                          type={showPw ? 'text' : 'password'}
                          autoComplete="new-password"
                          placeholder="At least 8 characters"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && signupEmailReady && !busy) void submitSignupEmail()
                          }}
                        />
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-cmut transition hover:bg-cbg hover:text-cink"
                          onClick={() => setShowPw((v) => !v)}
                          aria-label={showPw ? 'Hide password' : 'Show password'}
                        >
                          {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
                        </button>
                      </div>
                    </>
                  )}
                </div>

                <button
                  className="btn-p mt-6 w-full disabled:opacity-50"
                  disabled={busy || (signupMethod === 'phone' ? !signupPhoneReady : !signupEmailReady)}
                  onClick={() => {
                    if (signupMethod === 'phone') void requestOtp(signupPhone())
                    else void submitSignupEmail()
                  }}
                >
                  {busy ? (
                    <>
                      <Loader2 size={18} className="animate-spin" /> Please wait…
                    </>
                  ) : signupMethod === 'phone' ? (
                    <>
                      <Phone size={18} /> Send code
                    </>
                  ) : (
                    'Create my account'
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
                  By continuing you agree to CALL&apos;s Terms of Service and Privacy Policy.
                </p>
              </div>
            )}

            {/* ================= phone OTP ================= */}
            {step === 'otp' && (
              <div className="mt-6">
                {devCode && <SandboxBanner code={devCode} onFill={() => setOtp(devCode)} />}
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

            {/* ================= profile after phone OTP ================= */}
            {step === 'name' && (
              <div className="mt-6">
                <FieldLabel>Full name</FieldLabel>
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-cmut">
                    <User size={18} />
                  </span>
                  <input
                    className="app-input w-full pl-11"
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value)
                      if (!usernameTouched) setUsername(suggestUsername(e.target.value))
                    }}
                    autoFocus
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
                <button
                  className="btn-p mt-6 w-full disabled:opacity-50"
                  disabled={busy || name.trim().length < 2}
                  onClick={() => {
                    setBusy(true)
                    setError('')
                    api
                      .verifyOtp(activePhone, otp, name.trim(), username.trim().toLowerCase())
                      .then((res) => {
                        if (res.token && res.user) loginSuccess(res.token, res.user)
                      })
                      .catch((e) => setError((e as Error).message))
                      .finally(() => setBusy(false))
                  }}
                >
                  {busy ? 'Creating account…' : 'Create my account'}
                </button>
              </div>
            )}

            {/* ================= email verification ================= */}
            {step === 'verify' && (
              <div className="mt-6">
                {emailDevCode && <SandboxBanner code={emailDevCode} onFill={() => setEmailCode(emailDevCode)} />}
                <OtpSlots value={emailCode} onChange={setEmailCode} />
                <button
                  className="btn-p mt-6 w-full disabled:opacity-50"
                  disabled={busy || emailCode.length < 6}
                  onClick={() => void verifyEmailCode()}
                >
                  <ShieldCheck size={18} /> {busy ? 'Verifying…' : 'Verify & continue'}
                </button>
                <button
                  className="mt-4 w-full text-center text-sm font-semibold text-cmut"
                  onClick={() => void skipVerify()}
                >
                  Skip for now
                </button>
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
