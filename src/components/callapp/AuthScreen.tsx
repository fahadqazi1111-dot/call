'use client'

import { useEffect, useRef, useState } from 'react'
import { CallWordmark } from './CallLogo'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { ChevronLeft, Phone, ShieldCheck, KeyRound } from 'lucide-react'
import { api } from '@/lib/callapp/api'
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

type Step = 'phone' | 'otp' | 'name'

export function AuthScreen() {
  const loginSuccess = useApp((s) => s.loginSuccess)
  const [step, setStep] = useState<Step>('phone')
  const [country, setCountry] = useState('+92')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [name, setName] = useState('')
  const [devCode, setDevCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [resendIn, setResendIn] = useState(0)
  const resendTimer = useRef<number | null>(null)

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

  const verify = async (withName?: string) => {
    setBusy(true)
    setError('')
    try {
      const res = await api.verifyOtp(fullPhone(), otp, withName)
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

  return (
    <div className="absolute inset-0 flex flex-col overflow-y-auto bg-white px-6 pb-8 app-scroll">
      <div className="pt-16">
        {step !== 'phone' ? (
          <button
            className="mb-4 flex h-9 w-9 items-center justify-center rounded-full bg-csoft text-cbrand"
            onClick={() => {
              setError('')
              setStep(step === 'name' ? 'otp' : 'phone')
            }}
            aria-label="Back"
          >
            <ChevronLeft size={20} />
          </button>
        ) : null}
        <CallWordmark size={44} showTagline={false} />
        <h1 className="mt-6 text-[32px] font-extrabold tracking-tight text-cink">
          {step === 'phone' && 'Welcome to CALL'}
          {step === 'otp' && 'Verify your number'}
          {step === 'name' && 'Set up your profile'}
        </h1>
        <p className="mt-2 text-[15px] text-cmut">
          {step === 'phone' && 'One World. One Call. Log in with your phone number.'}
          {step === 'otp' && `We sent a 6-digit code to ${country} ${phone}`}
          {step === 'name' && 'Choose the name your contacts will see.'}
        </p>
      </div>

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
          <p className="rounded-2xl bg-cbg p-4 text-[13px] leading-5 text-cmut">
            <span className="font-semibold text-cbrand">Free sandbox mode:</span> verification codes are
            generated right here — no SMS gateway needed. Your number stays on this device&apos;s database.
          </p>
        </div>
      )}

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

      {step === 'name' && (
        <div className="mt-8">
          <label className="mb-2 block text-[13px] font-semibold text-[#4A5568]">Full name</label>
          <input
            className="app-input"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && name.trim().length >= 2 && void verify(name.trim())}
            autoFocus
          />
          <button
            className="btn-p mt-6 w-full disabled:opacity-50"
            disabled={busy || name.trim().length < 2}
            onClick={() => void verify(name.trim())}
          >
            {busy ? 'Creating account…' : 'Create my account'}
          </button>
        </div>
      )}

      {error && <p className="mt-4 rounded-xl bg-[#FEF0EF] p-3 text-sm font-medium text-cred">{error}</p>}

      <p className="mt-auto pt-8 text-center text-[13px] text-cmut">
        Secure peer-to-peer calls · Free & unlimited
      </p>
    </div>
  )
}
