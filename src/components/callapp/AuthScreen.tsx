'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { CallWordmark } from './CallLogo'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { ChevronLeft, Phone, ShieldCheck, KeyRound, Mail, AtSign, Loader2, CheckCircle2, XCircle, Info } from 'lucide-react'
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

type Step = 'phone' | 'otp' | 'name' | 'email' | 'verify' | 'google'

/** Turn "Ayesha Siddiqui" into "ayeshasiddiqui" — a username suggestion. */
function suggestUsername(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 16)
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
      <label className="mb-2 block text-[13px] font-semibold text-[#4A5568]">
        Username <span className="font-normal text-cmut">(optional — unique, like a handle)</span>
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[15px] font-bold text-cmut">@</span>
        <input
          className="app-input pl-9 pr-10"
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
  const [step, setStep] = useState<Step>('phone')
  const [country, setCountry] = useState('+92')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [devCode, setDevCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [resendIn, setResendIn] = useState(0)
  const resendTimer = useRef<number | null>(null)

  // email steps
  const [emailTab, setEmailTab] = useState<'login' | 'signup'>('signup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pendingToken, setPendingToken] = useState('')
  const [emailCode, setEmailCode] = useState('')
  const [emailDevCode, setEmailDevCode] = useState('')
  const [usernameTouched, setUsernameTouched] = useState(false)
  const googleHostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (resendIn <= 0) return
    resendTimer.current = window.setTimeout(() => setResendIn((s) => s - 1), 1000)
    return () => {
      if (resendTimer.current) window.clearTimeout(resendTimer.current)
    }
  }, [resendIn])

  const fullPhone = () => `${country}${phone.replace(/\D/g, '')}`

  const requestOtp = async (resend = false) => {
    setBusy(true)
    setError('')
    try {
      const res = await api.requestOtp(fullPhone())
      setDevCode(res.devCode)
      setResendIn(30)
      if (!resend) setStep('otp')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const verify = async (withName?: string, withUsername?: string) => {
    setBusy(true)
    setError('')
    try {
      const res = await api.verifyOtp(fullPhone(), otp, withName, withUsername)
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

  /* ---------- email + password ---------- */

  const submitEmail = async () => {
    setBusy(true)
    setError('')
    try {
      if (emailTab === 'login') {
        const res = await api.passwordLogin(email.trim().toLowerCase(), password)
        loginSuccess(res.token, res.user)
        return
      }
      // signup — username falls back to a suggestion from the name
      const uname = (username.trim() || suggestUsername(name)).toLowerCase()
      if (!name.trim()) {
        setError('Name is required')
        return
      }
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
        setStep('phone')
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

  const backFromEmail = () => {
    setError('')
    setStep('phone')
  }

  const titles: Record<Step, string> = {
    phone: 'Welcome to CALL',
    otp: 'Verify your number',
    name: 'Set up your profile',
    email: emailTab === 'login' ? 'Log in to CALL' : 'Create your CALL account',
    verify: 'Verify your email',
    google: 'Continue with Google',
  }

  const subs: Record<Step, string> = {
    phone: 'One World. One Call. Log in with your phone number.',
    otp: `We sent a 6-digit code to ${country} ${phone}`,
    name: 'Choose the name and username your contacts will see.',
    email: emailTab === 'login' ? 'Use your email and password.' : 'Pick a unique username — it becomes your handle on CALL.',
    verify: `Enter the 6-digit code sent to ${email}`,
    google: 'Sign in with your Google account — a username is created for you automatically.',
  }

  return (
    <div className="app-scroll absolute inset-0 flex flex-col overflow-y-auto bg-white px-6 pb-8">
      <div className="mx-auto flex min-h-full w-full max-w-[460px] flex-1 flex-col">
        <div className="pt-16">
          {step !== 'phone' ? (
            <button
              className="mb-4 flex h-9 w-9 items-center justify-center rounded-full bg-csoft text-cbrand"
              onClick={() => {
                setError('')
                if (step === 'name') setStep('otp')
                else if (step === 'otp') setStep('phone')
                else if (step === 'google') setStep('phone')
                else if (step === 'verify') setStep('phone')
                else setStep('phone')
              }}
              aria-label="Back"
            >
              <ChevronLeft size={20} />
            </button>
          ) : null}
          <CallWordmark size={44} showTagline={false} />
          <h1 className="mt-6 text-[32px] font-extrabold tracking-tight text-cink">{titles[step]}</h1>
          <p className="mt-2 text-[15px] text-cmut">{subs[step]}</p>
        </div>

        {/* ============ phone step ============ */}
        {step === 'phone' && (
          <div className="mt-8">
            <label className="mb-2 block text-[13px] font-semibold text-[#4A5568]">Phone number</label>
            <div className="flex gap-2.5">
              <select
                className="app-input w-[108px] flex-none appearance-none px-3 text-center"
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
              <input
                className="app-input"
                inputMode="tel"
                placeholder="3XX XXXXXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && phone.replace(/\D/g, '').length >= 7 && void requestOtp()}
              />
            </div>
            <button
              className="btn-p mt-6 w-full disabled:opacity-50"
              disabled={busy || phone.replace(/\D/g, '').length < 7}
              onClick={() => void requestOtp()}
            >
              <Phone size={18} /> {busy ? 'Sending code…' : 'Continue'}
            </button>

            <div className="my-5 flex items-center gap-3 text-[13px] text-cmut">
              <div className="h-px flex-1 bg-cline" /> or <div className="h-px flex-1 bg-cline" />
            </div>

            <div className="flex flex-col gap-2.5">
              <button
                className="btn-p w-full bg-white text-cink shadow-[0_1px_2px_rgba(14,23,38,0.08)] border border-cline"
                onClick={() => {
                  setError('')
                  setEmailTab('signup')
                  setStep('email')
                }}
              >
                <Mail size={18} /> Continue with email
              </button>
              <button
                className="btn-p w-full bg-white text-cink shadow-[0_1px_2px_rgba(14,23,38,0.08)] border border-cline"
                onClick={() => {
                  setError('')
                  setStep('google')
                }}
              >
                <span className="text-[17px] leading-none font-extrabold" aria-hidden="true">
                  G
                </span>
                Continue with Google
              </button>
            </div>

            <p className="mt-5 text-center text-[13px] text-cmut">
              Already have an email account?{' '}
              <button
                className="font-semibold text-cbrand"
                onClick={() => {
                  setError('')
                  setEmailTab('login')
                  setStep('email')
                }}
              >
                Log in
              </button>
            </p>

            <p className="mt-5 rounded-2xl bg-cbg p-4 text-[13px] leading-5 text-cmut">
              <span className="font-semibold text-cbrand">Free sandbox mode:</span> verification codes are
              generated right here — no SMS gateway needed. Your number stays on this device&apos;s database.
            </p>
          </div>
        )}

        {/* ============ phone otp step ============ */}
        {step === 'otp' && (
          <div className="mt-8">
            {devCode && (
              <div className="mb-5 flex items-center gap-3 rounded-2xl border border-[#F5A52433] bg-[#FFF8EB] p-4">
                <KeyRound size={20} className="flex-none text-[#B45309]" />
                <div className="text-[13px] leading-5 text-[#7A5B16]">
                  Sandbox code (free mode):{' '}
                  <button
                    className="font-bold tracking-widest text-[#B45309] underline decoration-dotted"
                    onClick={() => setOtp(devCode)}
                  >
                    {devCode}
                  </button>
                </div>
              </div>
            )}
            <InputOTP maxLength={6} value={otp} onChange={setOtp}>
              <InputOTPGroup className="gap-2">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <InputOTPSlot key={i} index={i} className="h-14 w-12 rounded-2xl border-[1.5px] border-[#DDE3EE] text-lg font-bold shadow-none" />
                ))}
              </InputOTPGroup>
            </InputOTP>
            <button
              className="btn-p mt-6 w-full disabled:opacity-50"
              disabled={busy || otp.length < 6}
              onClick={() => void verify()}
            >
              <ShieldCheck size={18} /> {busy ? 'Verifying…' : 'Verify & continue'}
            </button>
            <div className="mt-4 text-center text-sm text-cmut">
              {resendIn > 0 ? (
                <span>
                  Resend code in <b className="text-cbrand">{resendIn}s</b>
                </span>
              ) : (
                <button className="font-semibold text-cbrand" onClick={() => void requestOtp(true)}>
                  Resend code
                </button>
              )}
            </div>
          </div>
        )}

        {/* ============ phone name+username step ============ */}
        {step === 'name' && (
          <div className="mt-8">
            <label className="mb-2 block text-[13px] font-semibold text-[#4A5568]">Full name</label>
            <input
              className="app-input"
              placeholder="Your name"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (!usernameTouched) setUsername(suggestUsername(e.target.value))
              }}
              autoFocus
            />
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
              onClick={() => void verify(name.trim(), username.trim().toLowerCase())}
            >
              {busy ? 'Creating account…' : 'Create my account'}
            </button>
          </div>
        )}

        {/* ============ email login / signup ============ */}
        {step === 'email' && (
          <div className="mt-8">
            <div className="mb-5 flex rounded-2xl bg-cbg p-1">
              {(['signup', 'login'] as const).map((t) => (
                <button
                  key={t}
                  className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition ${
                    emailTab === t ? 'bg-white text-cink shadow-sm' : 'text-cmut'
                  }`}
                  onClick={() => {
                    setError('')
                    setEmailTab(t)
                  }}
                >
                  {t === 'signup' ? 'Create account' : 'Log in'}
                </button>
              ))}
            </div>

            {emailTab === 'signup' && (
              <>
                <label className="mb-2 block text-[13px] font-semibold text-[#4A5568]">Full name</label>
                <input
                  className="app-input"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value)
                    if (!usernameTouched) setUsername(suggestUsername(e.target.value))
                  }}
                />
                <div className="mt-4">
                  <UsernameField
                    value={username}
                    onChange={(v) => {
                      setUsernameTouched(true)
                      setUsername(v)
                    }}
                  />
                </div>
              </>
            )}

            <div className="mt-4">
              <label className="mb-2 block text-[13px] font-semibold text-[#4A5568]">Email</label>
              <input
                className="app-input"
                type="email"
                inputMode="email"
                autoCapitalize="none"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="mt-4">
              <label className="mb-2 block text-[13px] font-semibold text-[#4A5568]">Password</label>
              <input
                className="app-input"
                type="password"
                placeholder={emailTab === 'signup' ? 'At least 8 characters' : 'Your password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && email && password && (emailTab === 'login' || name.trim().length >= 2))
                    void submitEmail()
                }}
              />
            </div>
            <button
              className="btn-p mt-6 w-full disabled:opacity-50"
              disabled={busy || !email || password.length < (emailTab === 'signup' ? 8 : 1) || (emailTab === 'signup' && name.trim().length < 2)}
              onClick={() => void submitEmail()}
            >
              {busy ? 'Please wait…' : emailTab === 'signup' ? 'Create my account' : 'Log in'}
            </button>
          </div>
        )}

        {/* ============ email verification ============ */}
        {step === 'verify' && (
          <div className="mt-8">
            {emailDevCode && (
              <div className="mb-5 flex items-center gap-3 rounded-2xl border border-[#F5A52433] bg-[#FFF8EB] p-4">
                <KeyRound size={20} className="flex-none text-[#B45309]" />
                <div className="text-[13px] leading-5 text-[#7A5B16]">
                  Sandbox code (free mode):{' '}
                  <button
                    className="font-bold tracking-widest text-[#B45309] underline decoration-dotted"
                    onClick={() => setEmailCode(emailDevCode)}
                  >
                    {emailDevCode}
                  </button>
                </div>
              </div>
            )}
            <InputOTP maxLength={6} value={emailCode} onChange={setEmailCode}>
              <InputOTPGroup className="gap-2">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <InputOTPSlot key={i} index={i} className="h-14 w-12 rounded-2xl border-[1.5px] border-[#DDE3EE] text-lg font-bold shadow-none" />
                ))}
              </InputOTPGroup>
            </InputOTP>
            <button
              className="btn-p mt-6 w-full disabled:opacity-50"
              disabled={busy || emailCode.length < 6}
              onClick={() => void verifyEmailCode()}
            >
              <ShieldCheck size={18} /> {busy ? 'Verifying…' : 'Verify & continue'}
            </button>
            <button className="mt-4 w-full text-center text-sm font-semibold text-cmut" onClick={() => void skipVerify()}>
              Skip for now
            </button>
          </div>
        )}

        {/* ============ google ============ */}
        {step === 'google' && (
          <div className="mt-10">
            <div className="flex min-h-[120px] flex-col items-center justify-center gap-4 rounded-3xl border border-cline bg-cbg p-6">
              <AtSign size={26} className="text-cbrand" />
              <p className="max-w-[300px] text-center text-[13px] leading-5 text-cmut">
                A unique username is generated from your Google name automatically. You can change it later from
                your profile.
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
                Google sign-in needs a Google Client ID configured by the admin (Admin panel → Settings → Auth).
                Until then, use phone or email.
              </span>
            </div>
          </div>
        )}

        {error && <p className="mt-4 rounded-xl bg-[#FEF0EF] p-3 text-sm font-medium text-cred">{error}</p>}

        <p className="mt-auto pt-8 text-center text-[13px] text-cmut">
          Secure peer-to-peer calls · Free &amp; unlimited
        </p>
      </div>
    </div>
  )
}
