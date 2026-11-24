'use client'

import { useEffect, useRef, useState } from 'react'
import { Avatar, OfficialAvatar } from './Avatar'
import { CallLogoMark } from './CallLogo'
import { StaffTick } from './StaffTick'
import { useApp } from '@/lib/callapp/store'
import { api } from '@/lib/callapp/api'
import { toast } from 'sonner'
import {
  User,
  Bell,
  ShieldCheck,
  ChevronRight,
  Camera,
  Pencil,
  LogOut,
  BadgeCheck,
  Loader2,
  Wallet,
  Bot,
  Shield,
  AtSign,
  CheckCircle2,
  XCircle,
  Clock3,
  Mail,
  Landmark,
  Gift,
  Megaphone,
  TrendingUp,
  Lock,
  LockOpen,
  LockKeyhole,
  Eye,
  EyeOff,
  Music4,
  Play,
  Square,
  Trash2,
  AlertTriangle,
  Coins,
  ShoppingBag,
  Scroll,
  Users,
  Cookie,
  LifeBuoy,
  Phone,
  KeyRound,
} from 'lucide-react'
import { RINGTONE_OPTIONS, getSelectedRingtone, setRingtone } from '@/lib/callapp/ringtones'
import { CountryPicker } from './CountryPicker'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'

const USERNAME_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000 // 1 week

/** Next epoch ms at which the username may be changed again (first change: 7d after signup). */
function nextChangeAt(me: { usernameChangedAt?: string | null; createdAt?: string | null }): number {
  const anchor = me.usernameChangedAt || me.createdAt
  return (anchor ? new Date(anchor).getTime() : Date.now()) + USERNAME_COOLDOWN_MS
}

function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtCountdown(ms: number): string {
  const diff = Math.max(0, ms - Date.now())
  const d = Math.floor(diff / 86400000)
  const h = Math.floor((diff % 86400000) / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

/** Center-crop an image file to a square and downscale to max 512px (jpeg). */
function fileToSizedBlob(file: File, max = 512): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      try {
        const side = Math.min(img.width, img.height)
        const scale = Math.min(1, max / side)
        const w = Math.max(1, Math.round(side * scale))
        const sx = (img.width - side) / 2
        const sy = (img.height - side) / 2
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = w
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('canvas unavailable')
        ctx.drawImage(img, sx, sy, side, side, 0, 0, w, w)
        canvas.toBlob(
          (b) => {
            URL.revokeObjectURL(url)
            if (b) resolve(b)
            else reject(new Error('encode failed'))
          },
          'image/jpeg',
          0.9,
        )
      } catch (e) {
        URL.revokeObjectURL(url)
        reject(e as Error)
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('invalid image'))
    }
    img.src = url
  })
}

export function ProfileTab({ variant = 'mobile' }: { variant?: 'mobile' | 'desktop' }) {
  const me = useApp((s) => s.me)
  const updateMe = useApp((s) => s.updateMe)
  const updateAvatar = useApp((s) => s.updateAvatar)
  const logout = useApp((s) => s.logout)
  const setOverlay = useApp((s) => s.setOverlay)
  const wallet = useApp((s) => s.wallet)
  const walletGifts = useApp((s) => s.walletGifts)
  const loadWallet = useApp((s) => s.loadWallet)
  const [showEdit, setShowEdit] = useState(false)
  const [editName, setEditName] = useState(me?.name ?? '')
  const [editAbout, setEditAbout] = useState(me?.about ?? '')
  const [busy, setBusy] = useState(false)
  const [photoBusy, setPhotoBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const desk = variant === 'desktop'

  // change-phone dialog state
  const [showChangePhone, setShowChangePhone] = useState(false)
  const [cpCountry, setCpCountry] = useState('+92')
  const [cpDigits, setCpDigits] = useState('')
  const [cpCode, setCpCode] = useState('')
  const [cpDevCode, setCpDevCode] = useState('')
  const [cpBusy, setCpBusy] = useState(false)
  const [cpSending, setCpSending] = useState(false)
  const [cpResendIn, setCpResendIn] = useState(0)

  // change-email dialog state
  const [showChangeEmail, setShowChangeEmail] = useState(false)
  const [ceEmail, setCeEmail] = useState('')
  const [ceCode, setCeCode] = useState('')
  const [ceDevCode, setCeDevCode] = useState('')
  const [ceBusy, setCeBusy] = useState(false)
  const [ceSending, setCeSending] = useState(false)
  const [ceResendIn, setCeResendIn] = useState(0)

  // username dialog state
  const [showUsername, setShowUsername] = useState(false)
  const [uname, setUname] = useState('')
  const [unameStatus, setUnameStatus] = useState<'idle' | 'checking' | 'ok' | 'bad'>('idle')
  const [unameMsg, setUnameMsg] = useState('')
  const [unameBusy, setUnameBusy] = useState(false)
  const [nowTick, setNowTick] = useState(Date.now())

  // password dialog state
  const [showPwd, setShowPwd] = useState(false)
  const [pwdCur, setPwdCur] = useState('')
  const [pwdNew, setPwdNew] = useState('')
  const [pwdConf, setPwdConf] = useState('')
  const [pwdBusy, setPwdBusy] = useState(false)
  const [showCur, setShowCur] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConf, setShowConf] = useState(false)
  const [ringtoneOpen, setRingtoneOpen] = useState(false)
  const markPasswordSet = useApp((s) => s.markPasswordSet)
  const changePhone = useApp((s) => s.changePhone)
  const changeEmail = useApp((s) => s.changeEmail)

  // delete account dialog state
  const [showDelete, setShowDelete] = useState(false)
  const [delPwd, setDelPwd] = useState('')
  const [delConfirmText, setDelConfirmText] = useState('')
  const [delAck, setDelAck] = useState(false)
  const [delBusy, setDelBusy] = useState(false)
  const [showDelPwd, setShowDelPwd] = useState(false)
  const deleteAccount = useApp((s) => s.deleteAccount)

  useEffect(() => {
    if (!showUsername) return
    const t = window.setInterval(() => setNowTick(Date.now()), 30_000)
    return () => window.clearInterval(t)
  }, [showUsername])

  // resend cooldown countdowns for the change-phone / change-email dialogs
  useEffect(() => {
    if (cpResendIn <= 0) return
    const t = window.setTimeout(() => setCpResendIn((s) => s - 1), 1000)
    return () => window.clearTimeout(t)
  }, [cpResendIn])
  useEffect(() => {
    if (ceResendIn <= 0) return
    const t = window.setTimeout(() => setCeResendIn((s) => s - 1), 1000)
    return () => window.clearTimeout(t)
  }, [ceResendIn])

  // keep the money stats fresh
  useEffect(() => {
    queueMicrotask(() => void loadWallet())
  }, [])

  // live availability check while typing (debounced)
  useEffect(() => {
    if (!showUsername) return
    const v = uname.trim().toLowerCase()
    if (!v || v === me?.username) {
      setUnameStatus('idle')
      setUnameMsg('')
      return
    }
    setUnameStatus('checking')
    const t = window.setTimeout(async () => {
      try {
        const res = await api.usernameCheck(v)
        if (res.available) {
          setUnameStatus('ok')
          setUnameMsg(`@${v} is available`)
        } else {
          setUnameStatus('bad')
          setUnameMsg(res.reason || `@${v} is taken`)
        }
      } catch {
        setUnameStatus('idle')
        setUnameMsg('')
      }
    }, 400)
    return () => window.clearTimeout(t)
  }, [uname, showUsername, me?.username])

  if (!me) return null

  const cooldownEnds = nextChangeAt(me)
  const cooldownActive = nowTick < cooldownEnds

  const openUsername = () => {
    setUname(me.username)
    setUnameStatus('idle')
    setUnameMsg('')
    setShowUsername(true)
  }

  const saveUsername = async () => {
    const v = uname.trim().toLowerCase()
    if (!v || v === me.username) {
      setShowUsername(false)
      return
    }
    setUnameBusy(true)
    try {
      await updateMe({ username: v })
      toast.success(`Username updated to @${v}`)
      setShowUsername(false)
    } catch (e) {
      toast.error((e as Error).message || 'Could not update username')
    } finally {
      setUnameBusy(false)
    }
  }

  const saveProfile = async () => {
    if (!editName.trim()) return
    setBusy(true)
    try {
      await updateMe({ name: editName.trim(), about: editAbout.trim() })
      toast.success('Profile updated')
      setShowEdit(false)
    } catch {
      toast.error('Could not update profile')
    } finally {
      setBusy(false)
    }
  }

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file')
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error('Image is too large (max 20MB)')
      return
    }
    setPhotoBusy(true)
    try {
      const blob = await fileToSizedBlob(file)
      await updateAvatar(blob, 'image/jpeg')
      toast.success('Profile photo updated')
    } catch {
      toast.error('Could not update photo — try another image')
    } finally {
      setPhotoBusy(false)
    }
  }

  const enableNotifications = async () => {
    if (!('Notification' in window)) {
      toast.error('Notifications are not supported in this browser')
      return
    }
    if (Notification.permission === 'granted') {
      toast.info('Notifications are already enabled')
      return
    }
    const res = await Notification.requestPermission()
    if (res === 'granted') toast.success('Notifications enabled')
    else toast.error('Notifications blocked')
  }

  const openEdit = () => {
    setEditName(me.name)
    setEditAbout(me.about)
    setShowEdit(true)
  }

  const isStaff = me.role === 'admin' || me.role === 'team'
  const hasPwd = !!me.hasPassword

  const openPassword = () => {
    setPwdCur('')
    setPwdNew('')
    setPwdConf('')
    setShowCur(false)
    setShowNew(false)
    setShowConf(false)
    setShowPwd(true)
  }

  const openDelete = () => {
    setDelPwd('')
    setDelConfirmText('')
    setDelAck(false)
    setShowDelPwd(false)
    setDelBusy(false)
    setShowDelete(true)
  }

  /** Open a legal / support page in a new tab so the user stays in the app. */
  const openLegal = (path: string) => {
    if (typeof window === 'undefined') return
    try {
      window.open(path, '_blank', 'noopener,noreferrer')
    } catch {
      window.location.href = path
    }
  }

  const confirmDelete = async () => {
    if (hasPwd && !delPwd) {
      toast.error('Enter your password to confirm')
      return
    }
    if (!delAck) {
      toast.error('Please acknowledge the consequences')
      return
    }
    if (delConfirmText.trim().toUpperCase() !== 'DELETE') {
      toast.error('Type DELETE to confirm')
      return
    }
    setDelBusy(true)
    try {
      await deleteAccount(hasPwd ? delPwd : null)
      toast.success('Your account has been deleted')
      setShowDelete(false)
    } catch (e) {
      toast.error((e as Error).message || 'Could not delete your account. Please try again.')
    } finally {
      setDelBusy(false)
    }
  }

  const savePassword = async () => {
    if (pwdNew.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    if (pwdNew !== pwdConf) {
      toast.error('New passwords do not match')
      return
    }
    if (hasPwd && !pwdCur) {
      toast.error('Enter your current password first')
      return
    }
    setPwdBusy(true)
    try {
      await api.passwordChange(hasPwd ? pwdCur : null, pwdNew)
      markPasswordSet()
      toast.success(hasPwd ? 'Password updated' : 'Password set — you can now log in with it')
      setShowPwd(false)
    } catch (e) {
      toast.error((e as Error).message || 'Could not update password')
    } finally {
      setPwdBusy(false)
    }
  }

  /* ---------- change phone number (OTP-gated) ---------- */
  const cpFullPhone = () => `${cpCountry}${cpDigits.replace(/\D/g, '')}`

  const openChangePhone = () => {
    setCpCountry('+92')
    setCpDigits('')
    setCpCode('')
    setCpDevCode('')
    setCpBusy(false)
    setCpSending(false)
    setCpResendIn(0)
    setShowChangePhone(true)
  }

  const sendCpCode = async () => {
    const full = cpFullPhone()
    if (cpDigits.replace(/\D/g, '').length < 7) {
      toast.error('Enter a valid phone number first')
      return
    }
    if (full === me.phone) {
      toast.error('This is already your phone number')
      return
    }
    setCpSending(true)
    try {
      const res = await api.requestOtp(full)
      setCpDevCode(res.devCode || '')
      setCpResendIn(60)
      setCpCode('')
      if (res.sandbox) {
        toast.info('Sandbox mode — phone code is shown below.')
      } else {
        toast.success(`Code sent to ${full}`)
      }
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setCpSending(false)
    }
  }

  const verifyAndChangePhone = async () => {
    const full = cpFullPhone()
    if (cpDigits.replace(/\D/g, '').length < 7) {
      toast.error('Enter a valid phone number first')
      return
    }
    if (cpCode.length !== 6) {
      toast.error('Enter the 6-digit code')
      return
    }
    setCpBusy(true)
    try {
      // 1) consume the OTP via the verify endpoint — this proves the user
      //    controls the new phone number before we mutate the account.
      await api.verifyPhoneOtp(full, cpCode)
      // 2) swap the phone on the account (the consumed OTP is the proof).
      const clientKey = `changephone:${me.id}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`
      await changePhone(full, cpCode, clientKey)
      toast.success('Phone number updated')
      setShowChangePhone(false)
    } catch (e) {
      toast.error((e as Error).message || 'Could not update phone number')
    } finally {
      setCpBusy(false)
    }
  }

  /* ---------- change email (OTP-gated) ---------- */
  const openChangeEmail = () => {
    setCeEmail(me.email ?? '')
    setCeCode('')
    setCeDevCode('')
    setCeBusy(false)
    setCeSending(false)
    setCeResendIn(0)
    setShowChangeEmail(true)
  }

  const sendCeCode = async () => {
    const e = ceEmail.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) {
      toast.error('Enter a valid email first')
      return
    }
    if (me.email && me.email.toLowerCase() === e) {
      toast.error('This is already your email address')
      return
    }
    setCeSending(true)
    try {
      const res = await api.emailRequestCode(e, 'change_email')
      setCeDevCode(res.devCode || '')
      setCeResendIn(60)
      setCeCode('')
      if (res.sandbox) {
        toast.info('Sandbox mode — email code is shown below.')
      } else {
        toast.success(`Code emailed to ${e}`)
      }
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setCeSending(false)
    }
  }

  const verifyAndChangeEmail = async () => {
    const e = ceEmail.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) {
      toast.error('Enter a valid email first')
      return
    }
    if (ceCode.length !== 6) {
      toast.error('Enter the 6-digit code')
      return
    }
    setCeBusy(true)
    try {
      // 1) consume the OTP via the verify endpoint with the matching
      //    purpose so a 'change_email' code can be matched + consumed.
      await api.emailVerify(e, ceCode, undefined, 'change_email')
      // 2) swap the email on the account (the consumed OTP is the proof).
      const clientKey = `changeemail:${me.id}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`
      await changeEmail(e, ceCode, clientKey)
      toast.success('Email updated')
      setShowChangeEmail(false)
    } catch (err) {
      toast.error((err as Error).message || 'Could not update email')
    } finally {
      setCeBusy(false)
    }
  }

  return (
    <div
      className={`app-scroll h-full overflow-y-auto ${desk ? 'desk-scroll w-full pb-10' : 'pb-[calc(84px+max(env(safe-area-inset-bottom),12px))]'}`}
    >
      {/* ============ hero banner ============ */}
      <div
        className={`relative overflow-hidden bg-dark-grad text-center text-white ${
          desk ? 'mx-5 mt-6 rounded-[30px] pb-24 pt-10' : 'rounded-b-[34px] pb-24 pt-12'
        }`}
      >
        {/* glow orbs */}
        <div className="pointer-events-none absolute -left-12 -top-20 h-60 w-60 rounded-full bg-[#2F5BE0]/45 blur-3xl" />
        <div className="pointer-events-none absolute -right-14 top-4 h-48 w-48 rounded-full bg-[#7B3FE4]/35 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 left-1/4 h-44 w-44 rounded-full bg-[#E1306C]/25 blur-3xl" />

        <div className="relative flex flex-col items-center px-6">
          <div className="relative">
            <span className="inline-flex rounded-full bg-white/10 p-[4px] ring-1 ring-white/25">
              {me.isOfficial ? (
                <OfficialAvatar
                  size={desk ? 110 : 104}
                  className="rounded-full ring-[3.5px] ring-white/95"
                />
              ) : (
                <Avatar
                  name={me.name}
                  avatarKey={me.avatarKey}
                  size={desk ? 110 : 104}
                  src={me.avatarUrl}
                  className="rounded-full ring-[3.5px] ring-white/95"
                />
              )}
            </span>
            {!me.isOfficial && (
              <>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => void onPickFile(e)} />
                <button
                  className="absolute -bottom-1 -right-1 flex h-10 w-10 items-center justify-center rounded-full border-[3px] border-[#0B1B40] bg-white text-cbrand shadow-lg transition hover:scale-105 disabled:opacity-60"
                  aria-label="Change profile photo"
                  title="Change profile photo"
                  disabled={photoBusy}
                  onClick={() => fileRef.current?.click()}
                >
                  {photoBusy ? <Loader2 size={17} className="animate-spin" /> : <Camera size={17} />}
                </button>
              </>
            )}
          </div>

          <h1 className="mt-4 flex items-center gap-2 text-[24px] font-extrabold tracking-tight">
            {me.name}
            {isStaff && <StaffTick role={me.role} size={19} />}
          </h1>

          <button
            className="mt-2 flex items-center gap-1 rounded-full bg-white/10 px-3.5 py-1.5 text-[13px] font-bold text-white/90 ring-1 ring-white/20 transition hover:bg-white/15"
            onClick={openUsername}
            aria-label="Edit username"
          >
            <AtSign size={13} />
            {me.username}
            <Pencil size={11} className="opacity-70" />
          </button>

          <p className="mt-1.5 text-[13px] font-medium text-white/55">+{me.phone}</p>

          {me.about && (
            <span className="mt-3 inline-block max-w-[300px] truncate rounded-[20px] bg-white/10 px-4 py-1.5 text-[13px] font-semibold text-white/85 ring-1 ring-white/15">
              {me.about}
            </span>
          )}
        </div>
      </div>

      {/* ============ real-money earnings card (overlaps hero) ============ */}
      <div className={`relative z-10 -mt-14 px-5 ${desk ? 'mx-auto max-w-2xl' : ''}`}>
        <div className="bg-brand-grad relative overflow-hidden rounded-[24px] p-5 text-white shadow-[0_16px_36px_rgba(47,91,234,0.30)]">
          <div className="pointer-events-none absolute -right-10 -top-12 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/75">My balance</p>
              <p className="mt-1 text-[34px] font-extrabold leading-none tracking-tight">
                ${(wallet?.available ?? 0).toFixed(2)}
              </p>
              {wallet && wallet.reserved > 0 && (
                <p className="mt-1 flex items-center gap-1 text-[11.5px] font-semibold text-white/70">
                  <Lock size={11} /> ${wallet.reserved.toFixed(2)} reserved in withdrawals
                </p>
              )}
            </div>
            <button
              className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2.5 text-[12.5px] font-extrabold text-cbrand shadow-lg transition active:scale-95"
              onClick={() => setOverlay('wallet')}
            >
              <Landmark size={14} /> Withdraw
            </button>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-white/12 px-3 py-2.5 ring-1 ring-white/15">
              <p className="flex items-center gap-1 text-[10px] font-bold text-white/70"><TrendingUp size={11} /> Lifetime earned</p>
              <p className="mt-0.5 text-[16px] font-extrabold">${(wallet?.totalEarned ?? 0).toFixed(2)}</p>
            </div>
            <div className="rounded-2xl bg-white/12 px-3 py-2.5 ring-1 ring-white/15">
              <p className="flex items-center gap-1 text-[10px] font-bold text-white/70"><Gift size={11} /> Gifts received</p>
              <p className="mt-0.5 text-[16px] font-extrabold">{walletGifts.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ============ quick actions ============ */}
      <section className={`mt-6 px-5 ${desk ? 'mx-auto max-w-2xl' : ''}`} aria-label="Quick actions">
        <h2 className="mb-2.5 px-1 text-[13px] font-bold uppercase tracking-wider text-[#9AA8C7]">Explore</h2>
        <div className={`grid gap-3 ${isStaff ? 'grid-cols-3 sm:grid-cols-6' : 'grid-cols-3 sm:grid-cols-5'}`}>
          <button className="qa-tile" onClick={() => setOverlay('wallet')}>
            <span className="qa-ico bg-[#E7F7EF] text-[#0B8A46]"><Wallet size={20} /></span>
            <span className="qa-lbl">Wallet</span>
          </button>
          <button className="qa-tile" onClick={() => setOverlay('coin-store')}>
            <span className="qa-ico bg-amber-50 text-amber-600"><Coins size={20} /></span>
            <span className="qa-lbl">Coin Store</span>
          </button>
          <button className="qa-tile" onClick={() => setOverlay('ads')}>
            <span className="qa-ico bg-[#FFF0F3] text-[#D6336C]"><Megaphone size={20} /></span>
            <span className="qa-lbl">My ads</span>
          </button>
          <button className="qa-tile" onClick={() => setOverlay('ai')}>
            <span className="qa-ico bg-[#F1ECFE] text-[#6D28D9]"><Bot size={20} /></span>
            <span className="qa-lbl">CALL AI</span>
          </button>
          <button className="qa-tile" onClick={() => setOverlay('notifications')}>
            <span className="qa-ico bg-[#E3EBFF] text-cbrand-deep"><Bell size={20} /></span>
            <span className="qa-lbl">Alerts</span>
          </button>
          {isStaff && (
            <button className="qa-tile" onClick={() => setOverlay('admin')}>
              <span className="qa-ico bg-[#FEECEB] text-cred"><Shield size={20} /></span>
              <span className="qa-lbl">Admin</span>
            </button>
          )}
        </div>
      </section>

      {/* ============ account settings ============ */}
      <section className={`mt-6 px-5 ${desk ? 'mx-auto max-w-2xl' : ''}`} aria-label="Account settings">
        <h2 className="mb-2.5 px-1 text-[13px] font-bold uppercase tracking-wider text-[#9AA8C7]">Account</h2>
        <div className="overflow-hidden rounded-[22px] border border-cline bg-white shadow-[0_1px_3px_rgba(16,32,72,0.04)]">
          <Row Icon={AtSign} label="Username" sub={`@${me.username} · unique handle`} onClick={openUsername} />
          <Row Icon={User} label="Edit profile" sub="Name, about & photo" onClick={openEdit} />
          <Row
            Icon={Phone}
            label="Phone number"
            sub={`+${me.phone} · verified`}
            onClick={openChangePhone}
          />
          <Row
            Icon={Mail}
            label="Email"
            sub={me.email ? `${me.email}${me.emailVerified ? ' · verified' : ''}` : 'Not linked yet'}
            onClick={openChangeEmail}
          />
          <Row
            Icon={LockKeyhole}
            label={hasPwd ? 'Change password' : 'Set password'}
            sub={hasPwd ? 'Update your login password anytime' : 'Add a password for email login & security'}
            onClick={openPassword}
          />
          <Row Icon={Bell} label="Push notifications" sub="New messages & calls" onClick={enableNotifications} />
          <Row
            Icon={Music4}
            label="Call ringtone"
            sub={getSelectedRingtone().name}
            onClick={() => setRingtoneOpen(true)}
          />
        </div>
      </section>

      {/* ============ privacy & support ============ */}
      <section className={`mt-5 px-5 ${desk ? 'mx-auto max-w-2xl' : ''}`} aria-label="Privacy and support">
        <h2 className="mb-2.5 px-1 text-[13px] font-bold uppercase tracking-wider text-[#9AA8C7]">Privacy & support</h2>
        <div className="overflow-hidden rounded-[22px] border border-cline bg-white shadow-[0_1px_3px_rgba(16,32,72,0.04)]">
          <button
            className="flex w-full items-center gap-3.5 border-b border-cline px-4 py-3 text-left transition-colors hover:bg-csoft"
            type="button"
            onClick={() => {
              const next = !me.allowNonContacts
              void updateMe({ allowNonContacts: next })
                .then(() => toast.success(next ? 'Non-contacts can now message you' : 'Only contacts can message you'))
                .catch(() => toast.error('Could not update the setting'))
            }}
          >
            <span className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[12px] bg-csoft text-cbrand">
              {me.allowNonContacts ? <LockOpen size={18} /> : <Lock size={18} />}
            </span>
            <span className="flex-1">
              <span className="block text-[15px] font-semibold text-cink">Message requests</span>
              <span className="block text-xs text-cmut">
                {me.allowNonContacts ? 'Anyone on CALL can message you' : 'Only your contacts can message you'}
              </span>
            </span>
            <span className={`relative h-6 w-11 flex-none rounded-full transition ${me.allowNonContacts ? 'bg-cgreen' : 'bg-[#C9D2E4]'}`}>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${me.allowNonContacts ? 'left-[22px]' : 'left-0.5'}`} />
            </span>
          </button>
          <Row
            Icon={ShieldCheck}
            label="Privacy Policy"
            sub="How we handle your data"
            onClick={() => openLegal('/legal/privacy')}
          />
          <Row
            Icon={Scroll}
            label="Terms of Service"
            sub="The rules for using CALL"
            onClick={() => openLegal('/legal/terms')}
          />
          <Row
            Icon={Users}
            label="Community Guidelines"
            sub="Be kind, be safe, be CALL"
            onClick={() => openLegal('/legal/community')}
          />
          <Row
            Icon={Cookie}
            label="Cookie Policy"
            sub="How we use cookies"
            onClick={() => openLegal('/legal/cookies')}
          />
          <Row
            Icon={Trash2}
            label="Account Deletion"
            sub="Request data deletion"
            onClick={() => openLegal('/legal/deletion')}
          />
          <Row
            Icon={LifeBuoy}
            label="Help & support"
            sub="One World. One Call."
            onClick={() => openLegal('/legal/contact')}
          />
        </div>
      </section>

      {/* ============ logout ============ */}
      <div className={`mt-6 px-5 ${desk ? 'mx-auto max-w-2xl' : ''}`}>
        <button
          className="flex h-[52px] w-full items-center justify-center gap-2 rounded-[18px] border border-[#FBC9C5] bg-white text-[15px] font-bold text-cred shadow-[0_1px_3px_rgba(16,32,72,0.04)] transition hover:bg-[#FEF0EF]"
          onClick={() => {
            if (confirm('Log out of CALL?')) logout()
          }}
        >
          <LogOut size={18} /> Log out
        </button>

        {/* ============ delete account (App Store / Play Store compliance) ============ */}
        <button
          className="mt-3 flex h-[52px] w-full items-center justify-center gap-2 rounded-[18px] border border-[#F0B9B3] bg-[#FEF1EF] text-[14.5px] font-bold text-cred shadow-[0_1px_3px_rgba(16,32,72,0.04)] transition hover:bg-[#FCE6E2]"
          onClick={openDelete}
        >
          <Trash2 size={17} /> Delete my account
        </button>

        <div className="mt-7 flex flex-col items-center gap-1.5 pb-2">
          <div className="flex items-center gap-2 text-cmut">
            <CallLogoMark size={24} />
            <span className="text-sm font-extrabold tracking-tight text-cink">CALL</span>
            <span className="text-xs text-cmut">· One World. One Call.</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-[#9AA8C7]">
            <BadgeCheck size={12} className="text-cgreen" /> Free forever · v1.0
          </div>
        </div>
      </div>

      {/* ---------- call ringtone sheet ---------- */}
      {ringtoneOpen && <RingtoneSheet desk={desk} onClose={() => setRingtoneOpen(false)} />}

      {/* ---------- edit profile sheet ---------- */}
      {showEdit && (
        <div
          className={`inset-0 z-50 flex bg-black/45 ${
            desk ? 'fixed items-center justify-center p-6' : 'absolute items-end'
          }`}
          onClick={() => setShowEdit(false)}
        >
          <div
            className={`${desk ? 'w-full max-w-md rounded-[24px]' : 'w-full rounded-t-[28px]'} bg-white p-6 pb-8 shadow-2xl`}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Edit profile"
          >
            {!desk && <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-cline" />}
            <h2 className="text-xl font-extrabold text-cink">Edit profile</h2>
            <div className="mt-5 space-y-3">
              <div>
                <label className="mb-2 block text-[13px] font-semibold text-[#4A5568]">Name</label>
                <input className="app-input" value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>
              <div>
                <label className="mb-2 block text-[13px] font-semibold text-[#4A5568]">Username</label>
                <button
                  className="app-input flex items-center gap-1.5 text-left text-cmut"
                  onClick={() => {
                    setShowEdit(false)
                    openUsername()
                  }}
                >
                  @{me.username}
                  <span className="ml-auto text-xs font-semibold text-cbrand">Change</span>
                </button>
              </div>
              <div>
                <label className="mb-2 block text-[13px] font-semibold text-[#4A5568]">About</label>
                <input className="app-input" value={editAbout} onChange={(e) => setEditAbout(e.target.value)} maxLength={120} />
              </div>
            </div>
            <button className="btn-p mt-5 w-full disabled:opacity-50" disabled={busy || !editName.trim()} onClick={() => void saveProfile()}>
              {busy ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      )}

      {/* ---------- username change dialog ---------- */}
      {showUsername && (
        <div
          className={`inset-0 z-50 flex bg-black/45 ${
            desk ? 'fixed items-center justify-center p-6' : 'absolute items-end'
          }`}
          onClick={() => setShowUsername(false)}
        >
          <div
            className={`${desk ? 'w-full max-w-md rounded-[24px]' : 'w-full rounded-t-[28px]'} bg-white p-6 pb-8 shadow-2xl`}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Change username"
          >
            {!desk && <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-cline" />}
            <h2 className="text-xl font-extrabold text-cink">Your username</h2>
            <p className="mt-1.5 text-[13px] leading-5 text-cmut">
              Your handle across CALL — people can find and mention you with it. It must be unique.
            </p>

            <div className="relative mt-5">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[15px] font-bold text-cmut">@</span>
              <input
                className="app-input w-full has-icon has-trailing"
                value={uname}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                maxLength={20}
                onChange={(e) => setUname(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                onKeyDown={(e) => {
                  if (e.key === ' ') e.preventDefault()
                  if (e.key === 'Enter' && unameStatus === 'ok' && !cooldownActive) void saveUsername()
                }}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2">
                {unameStatus === 'checking' && <Loader2 size={17} className="animate-spin text-cmut" />}
                {unameStatus === 'ok' && <CheckCircle2 size={17} className="text-[#067647]" />}
                {unameStatus === 'bad' && <XCircle size={17} className="text-cred" />}
              </span>
            </div>
            {unameMsg && (
              <p className={`mt-1.5 text-xs ${unameStatus === 'bad' ? 'text-cred' : unameStatus === 'ok' ? 'text-[#067647]' : 'text-cmut'}`}>
                {unameMsg}
              </p>
            )}

            {cooldownActive ? (
              <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-[#F5A52433] bg-[#FFF8EB] p-3.5">
                <Clock3 size={18} className="mt-0.5 flex-none text-[#B45309]" />
                <div className="text-[13px] leading-5 text-[#7A5B16]">
                  <b>Username changes are limited to once a week.</b>
                  <br />
                  You can change yours on <b>{fmtDate(cooldownEnds)}</b>
                  {cooldownEnds - nowTick > 0 && (
                    <>
                      {' '}
                      (in {fmtCountdown(cooldownEnds)})
                    </>
                  )}
                  .
                </div>
              </div>
            ) : (
              <p className="mt-4 text-[12px] leading-5 text-[#9AA8C7]">
                You can change it now. After this change there is a 1-week waiting period before the next one.
              </p>
            )}

            <button
              className="btn-p mt-5 w-full disabled:opacity-50"
              disabled={unameBusy || cooldownActive || unameStatus !== 'ok' || !uname.trim() || uname.trim() === me.username}
              onClick={() => void saveUsername()}
            >
              {unameBusy ? 'Saving…' : cooldownActive ? `Locked until ${fmtDate(cooldownEnds)}` : 'Save username'}
            </button>
          </div>
        </div>
      )}

      {/* ---------- password change / set dialog ---------- */}
      {showPwd && (
        <div
          className={`inset-0 z-50 flex bg-black/45 ${
            desk ? 'fixed items-center justify-center p-6' : 'absolute items-end'
          }`}
          onClick={() => setShowPwd(false)}
        >
          <div
            className={`${desk ? 'w-full max-w-md rounded-[24px]' : 'w-full rounded-t-[28px]'} bg-white p-6 pb-8 shadow-2xl`}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label={hasPwd ? 'Change password' : 'Set password'}
          >
            {!desk && <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-cline" />}
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 flex-none items-center justify-center rounded-[14px] bg-[#E7EEFF] text-cbrand">
                <LockKeyhole size={20} />
              </span>
              <div>
                <h2 className="text-xl font-extrabold text-cink">{hasPwd ? 'Change password' : 'Set a password'}</h2>
                <p className="mt-0.5 text-[12.5px] text-cmut">
                  {hasPwd ? 'Choose a strong password you don\u2019t use anywhere else.' : 'Add a password so you can also log in with your email.'}
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {hasPwd && (
                <PwdField
                  label="Current password"
                  value={pwdCur}
                  setValue={setPwdCur}
                  show={showCur}
                  toggle={() => setShowCur((v) => !v)}
                  autoComplete="current-password"
                  placeholder="Your current password"
                />
              )}
              <PwdField
                label={hasPwd ? 'New password' : 'Password'}
                value={pwdNew}
                setValue={setPwdNew}
                show={showNew}
                toggle={() => setShowNew((v) => !v)}
                autoComplete="new-password"
                placeholder="At least 8 characters"
                hint="Use at least 8 characters — a mix of letters and numbers is best."
              />
              <PwdField
                label="Confirm new password"
                value={pwdConf}
                setValue={setPwdConf}
                show={showConf}
                toggle={() => setShowConf((v) => !v)}
                autoComplete="new-password"
                placeholder="Repeat the new password"
              />
            </div>

            {pwdConf && pwdNew !== pwdConf && (
              <p className="mt-2 text-xs font-semibold text-cred">Passwords do not match yet.</p>
            )}

            <button
              className="btn-p mt-5 w-full disabled:opacity-50"
              disabled={
                pwdBusy ||
                pwdNew.length < 8 ||
                pwdNew !== pwdConf ||
                (hasPwd && !pwdCur)
              }
              onClick={() => void savePassword()}
            >
              {pwdBusy ? 'Saving…' : hasPwd ? 'Update password' : 'Set password'}
            </button>
          </div>
        </div>
      )}

      {/* ---------- delete account dialog (App Store / Play Store compliance) ---------- */}
      {showDelete && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/55 sm:items-center sm:p-6"
          onClick={() => !delBusy && setShowDelete(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Delete account"
        >
          <div
            className={`w-full bg-white shadow-2xl ${
              desk ? 'max-w-md rounded-[24px]' : 'rounded-t-[28px]'
            } p-6 pb-[max(env(safe-area-inset-bottom),24px)]`}
            onClick={(e) => e.stopPropagation()}
          >
            {!desk && <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-cline" />}

            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 flex-none items-center justify-center rounded-[14px] bg-[#FCE4E1] text-cred">
                <AlertTriangle size={20} />
              </span>
              <div>
                <h2 className="text-xl font-extrabold text-cred">Delete my account</h2>
                <p className="mt-0.5 text-[12.5px] text-cmut">This action is permanent and cannot be undone.</p>
              </div>
            </div>

            {/* consequences */}
            <div className="mt-5 space-y-2 rounded-2xl border border-[#F0B9B3] bg-[#FEF5F4] p-4">
              <p className="text-[13px] font-bold text-cred">You will permanently lose:</p>
              <ul className="space-y-1.5 text-[12.5px] leading-5 text-cink">
                <li className="flex gap-2">
                  <span className="mt-[2px] text-cred">•</span>
                  Your profile, @{me.username}, phone number and avatar
                </li>
                <li className="flex gap-2">
                  <span className="mt-[2px] text-cred">•</span>
                  All chats, voice notes, photos, videos and call history
                </li>
                <li className="flex gap-2">
                  <span className="mt-[2px] text-cred">•</span>
                  Contacts, stories, group memberships and notifications
                </li>
                <li className="flex gap-2">
                  <span className="mt-[2px] text-cred">•</span>
                  <span>
                    Your <b>wallet balance of ${(wallet?.available ?? 0).toFixed(2)}</b>
                    {wallet && wallet.reserved > 0 ? ` (plus $${wallet.reserved.toFixed(2)} reserved in withdrawals)` : ''} —
                    any unredeemed balance is forfeited.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="mt-[2px] text-cred">•</span>
                  Access to CALL on this phone number — you would need to sign up again.
                </li>
              </ul>
              <p className="mt-2 border-t border-[#F0B9B3] pt-2 text-[11.5px] leading-5 text-cmut">
                Financial records required for legal/audit purposes are retained in anonymized form
                (with all personal identifiers stripped) as required by law.
              </p>
            </div>

            {/* password (only when the user has one) */}
            {hasPwd && (
              <div className="mt-4">
                <label className="mb-2 block text-[13px] font-semibold text-[#4A5568]">
                  Confirm your password
                </label>
                <div className="relative">
                  <input
                    type={showDelPwd ? 'text' : 'password'}
                    className="app-input w-full has-trailing"
                    autoComplete="current-password"
                    placeholder="Your account password"
                    value={delPwd}
                    disabled={delBusy}
                    onChange={(e) => setDelPwd(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && delConfirmText.trim().toUpperCase() === 'DELETE' && delAck && !delBusy) {
                        void confirmDelete()
                      }
                    }}
                  />
                  <button
                    type="button"
                    aria-label={showDelPwd ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-cmut hover:text-cink"
                    onClick={() => setShowDelPwd((v) => !v)}
                  >
                    {showDelPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            )}

            {/* type DELETE to confirm */}
            <div className="mt-4">
              <label className="mb-2 block text-[13px] font-semibold text-[#4A5568]">
                Type <span className="font-extrabold text-cred">DELETE</span> to confirm
              </label>
              <input
                className="app-input w-full font-bold tracking-wider"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                placeholder="DELETE"
                value={delConfirmText}
                disabled={delBusy}
                onChange={(e) => setDelConfirmText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && delConfirmText.trim().toUpperCase() === 'DELETE' && delAck && !delBusy) {
                    void confirmDelete()
                  }
                }}
              />
            </div>

            {/* acknowledge checkbox */}
            <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-2xl bg-csoft p-3">
              <input
                type="checkbox"
                className="mt-0.5 h-[18px] w-[18px] flex-none accent-cred"
                checked={delAck}
                disabled={delBusy}
                onChange={(e) => setDelAck(e.target.checked)}
              />
              <span className="text-[12.5px] leading-5 text-cink">
                I understand this is <b>irreversible</b> and that my data, including my wallet balance,
                will be permanently erased.
              </span>
            </label>

            {/* actions */}
            <div className="mt-5 flex gap-3">
              <button
                className="flex-1 rounded-[14px] border border-cline bg-white px-4 py-3 text-[14.5px] font-bold text-cink transition hover:bg-cbg disabled:opacity-50"
                onClick={() => setShowDelete(false)}
                disabled={delBusy}
              >
                Cancel
              </button>
              <button
                className="flex flex-1 items-center justify-center gap-2 rounded-[14px] bg-cred px-4 py-3 text-[14.5px] font-extrabold text-white shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={
                  delBusy ||
                  !delAck ||
                  delConfirmText.trim().toUpperCase() !== 'DELETE' ||
                  (hasPwd && !delPwd)
                }
                onClick={() => void confirmDelete()}
              >
                {delBusy ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Deleting…
                  </>
                ) : (
                  <>
                    <Trash2 size={16} /> Delete my account
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- change phone number dialog ---------- */}
      {showChangePhone && (
        <div
          className={`inset-0 z-50 flex bg-black/45 ${
            desk ? 'fixed items-center justify-center p-6' : 'absolute items-end'
          }`}
          onClick={() => !cpBusy && !cpSending && setShowChangePhone(false)}
        >
          <div
            className={`${desk ? 'w-full max-w-md rounded-[24px]' : 'w-full rounded-t-[28px]'} bg-white p-6 pb-[max(env(safe-area-inset-bottom),28px)] shadow-2xl`}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Change phone number"
          >
            {!desk && <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-cline" />}
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 flex-none items-center justify-center rounded-[14px] bg-[#E7EEFF] text-cbrand">
                <Phone size={20} />
              </span>
              <div>
                <h2 className="text-xl font-extrabold text-cink">Change phone number</h2>
                <p className="mt-0.5 text-[12.5px] text-cmut">We text a 6-digit code to your new number.</p>
              </div>
            </div>

            <p className="mt-3 text-[12.5px] text-cmut">
              Current: <b className="text-cink">+{me.phone}</b>
            </p>

            <div className="mt-5 space-y-3">
              <div>
                <label className="mb-2 block text-[13px] font-semibold text-[#4A5568]">New phone number</label>
                <div className="flex gap-2">
                  <CountryPicker value={cpCountry} onChange={setCpCountry} />
                  <input
                    className="app-input flex-1"
                    inputMode="tel"
                    autoCapitalize="none"
                    autoCorrect="off"
                    placeholder="712 3456789"
                    value={cpDigits}
                    onChange={(e) => setCpDigits(e.target.value.replace(/\D/g, ''))}
                    maxLength={14}
                    disabled={cpBusy}
                  />
                </div>
              </div>

              {cpDevCode && (
                <SandboxBanner code={cpDevCode} channel="phone" onFill={() => setCpCode(cpDevCode)} />
              )}

              <div>
                <label className="mb-2 block text-[13px] font-semibold text-[#4A5568]">Verification code</label>
                <OtpInput value={cpCode} onChange={setCpCode} disabled={cpBusy} />
              </div>
            </div>

            <button
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-[14px] border border-cline bg-white px-4 py-3 text-[14px] font-bold text-cbrand transition hover:bg-cbg disabled:opacity-50"
              type="button"
              disabled={cpSending || cpBusy || cpDigits.replace(/\D/g, '').length < 7 || cpResendIn > 0}
              onClick={() => void sendCpCode()}
            >
              {cpSending ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Sending…
                </>
              ) : cpResendIn > 0 ? (
                `Resend code in ${cpResendIn}s`
              ) : cpDevCode ? (
                'Resend code'
              ) : (
                <>
                  <ShieldCheck size={16} /> Send code
                </>
              )}
            </button>

            <button
              className="btn-p mt-3 w-full disabled:opacity-50"
              type="button"
              disabled={cpBusy || cpSending || cpCode.length !== 6 || cpDigits.replace(/\D/g, '').length < 7}
              onClick={() => void verifyAndChangePhone()}
            >
              {cpBusy ? (
                <>
                  <Loader2 size={18} className="animate-spin" /> Verifying…
                </>
              ) : (
                <>
                  <ShieldCheck size={18} /> Verify &amp; change
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ---------- change email dialog ---------- */}
      {showChangeEmail && (
        <div
          className={`inset-0 z-50 flex bg-black/45 ${
            desk ? 'fixed items-center justify-center p-6' : 'absolute items-end'
          }`}
          onClick={() => !ceBusy && !ceSending && setShowChangeEmail(false)}
        >
          <div
            className={`${desk ? 'w-full max-w-md rounded-[24px]' : 'w-full rounded-t-[28px]'} bg-white p-6 pb-[max(env(safe-area-inset-bottom),28px)] shadow-2xl`}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Change email"
          >
            {!desk && <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-cline" />}
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 flex-none items-center justify-center rounded-[14px] bg-[#E7EEFF] text-cbrand">
                <Mail size={20} />
              </span>
              <div>
                <h2 className="text-xl font-extrabold text-cink">Change email</h2>
                <p className="mt-0.5 text-[12.5px] text-cmut">We email a 6-digit code to your new address.</p>
              </div>
            </div>

            {me.email && (
              <p className="mt-3 text-[12.5px] text-cmut">
                Current: <b className="text-cink">{me.email}</b>
              </p>
            )}

            <div className="mt-5 space-y-3">
              <div>
                <label className="mb-2 block text-[13px] font-semibold text-[#4A5568]">New email address</label>
                <input
                  className="app-input w-full"
                  type="email"
                  inputMode="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="you@example.com"
                  value={ceEmail}
                  onChange={(e) => setCeEmail(e.target.value)}
                  disabled={ceBusy}
                />
              </div>

              {ceDevCode && (
                <SandboxBanner code={ceDevCode} channel="email" onFill={() => setCeCode(ceDevCode)} />
              )}

              <div>
                <label className="mb-2 block text-[13px] font-semibold text-[#4A5568]">Verification code</label>
                <OtpInput value={ceCode} onChange={setCeCode} disabled={ceBusy} />
              </div>
            </div>

            <button
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-[14px] border border-cline bg-white px-4 py-3 text-[14px] font-bold text-cbrand transition hover:bg-cbg disabled:opacity-50"
              type="button"
              disabled={ceSending || ceBusy || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(ceEmail.trim().toLowerCase()) || ceResendIn > 0}
              onClick={() => void sendCeCode()}
            >
              {ceSending ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Sending…
                </>
              ) : ceResendIn > 0 ? (
                `Resend code in ${ceResendIn}s`
              ) : ceDevCode ? (
                'Resend code'
              ) : (
                <>
                  <ShieldCheck size={16} /> Send code
                </>
              )}
            </button>

            <button
              className="btn-p mt-3 w-full disabled:opacity-50"
              type="button"
              disabled={ceBusy || ceSending || ceCode.length !== 6 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(ceEmail.trim().toLowerCase())}
              onClick={() => void verifyAndChangeEmail()}
            >
              {ceBusy ? (
                <>
                  <Loader2 size={18} className="animate-spin" /> Verifying…
                </>
              ) : (
                <>
                  <ShieldCheck size={18} /> Verify &amp; change
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Row({
  Icon,
  label,
  sub,
  onClick,
}: {
  Icon: typeof User
  label: string
  sub?: string
  onClick?: () => void
}) {
  return (
    <button
      className="flex w-full items-center gap-3.5 border-b border-cline px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-csoft"
      onClick={onClick}
      type="button"
    >
      <span className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[12px] bg-csoft text-cbrand">
        <Icon size={19} />
      </span>
      <span className="flex-1">
        <span className="block text-[15px] font-semibold text-cink">{label}</span>
        {sub && <span className="block text-xs text-cmut">{sub}</span>}
      </span>
      <ChevronRight size={17} className="text-[#9AA8C7]" />
    </button>
  )
}

/* ================= OTP input + sandbox banner ================= */

/** 6-slot numeric OTP input — matches the AuthScreen visual style. */
function OtpInput({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  disabled?: boolean
}) {
  return (
    <div className="flex justify-center">
      <InputOTP
        maxLength={6}
        value={value}
        onChange={(v) => onChange(v.replace(/\D/g, '').slice(0, 6))}
        disabled={disabled}
      >
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

/**
 * Honest sandbox banner — shown only when the backend returned
 * `sandbox: true` (no SMS/SMTP provider configured). The code is surfaced
 * in-app so the user can complete the flow in dev/preview, with a clear
 * callout that production requires a real provider.
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
    <div className="flex items-start gap-3 rounded-2xl border border-[#F5A52433] bg-[#FFF8EB] p-3.5">
      <KeyRound size={18} className="mt-0.5 flex-none text-[#B45309]" />
      <div className="text-[12.5px] leading-5 text-[#7A5B16]">
        <b>Sandbox mode.</b>{' '}
        {channel === 'email'
          ? 'No SMTP server is configured — your email code is shown here so you can complete the flow.'
          : 'No SMS provider is configured — your code is shown here so you can complete the flow.'}{' '}
        <button
          type="button"
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

/* ================= call ringtone picker ================= */

function RingtoneSheet({ desk, onClose }: { desk?: boolean; onClose: () => void }) {
  const [selected, setSelected] = useState(getSelectedRingtone().id)
  const [previewing, setPreviewing] = useState<string | null>(null)
  const previewAudio = useRef<HTMLAudioElement | null>(null)

  const stopPreview = () => {
    if (previewAudio.current) {
      try {
        previewAudio.current.pause()
        previewAudio.current.currentTime = 0
      } catch {}
      previewAudio.current = null
    }
    setPreviewing(null)
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate?.(0)
      } catch {}
    }
  }

  const preview = (id: string, file: string | null) => {
    stopPreview()
    setSelected(id)
    if (!file) {
      // synthesized classic ring preview (one loop)
      try {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        const ctx = new AC()
        const blip = (freq: number, at: number) => {
          const osc = ctx.createOscillator()
          const g = ctx.createGain()
          osc.type = 'sine'
          osc.frequency.value = freq
          g.gain.setValueAtTime(0.0001, ctx.currentTime + at)
          g.gain.linearRampToValueAtTime(0.09, ctx.currentTime + at + 0.02)
          g.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + at + 0.38)
          osc.connect(g).connect(ctx.destination)
          osc.start(ctx.currentTime + at)
          osc.stop(ctx.currentTime + at + 0.4)
        }
        blip(880, 0)
        blip(700, 0.46)
        setPreviewing(id)
        window.setTimeout(() => {
          void ctx.close()
          setPreviewing(null)
        }, 1000)
      } catch {}
      return
    }
    const audio = new Audio(file)
    audio.loop = true
    audio.volume = 0.95
    previewAudio.current = audio
    setPreviewing(id)
    void audio.play().catch(() => {
      stopPreview()
    })
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate?.([400, 300, 400])
      } catch {}
    }
  }

  const choose = (id: string, file: string | null) => {
    setRingtone(id)
    setSelected(id)
    stopPreview()
    toast.success('Ringtone updated')
    onClose()
  }

  return (
    <div
      className={`inset-0 z-50 flex bg-black/45 ${desk ? 'fixed items-center justify-center p-6' : 'absolute items-end'}`}
      onClick={() => {
        stopPreview()
        onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Call ringtone"
    >
      <div
        className={`${desk ? 'w-full max-w-md rounded-[24px]' : 'w-full rounded-t-[28px]'} bg-white p-5 pb-[max(env(safe-area-inset-bottom),18px)] shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        {!desk && <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-cline" />}
        <h2 className="flex items-center gap-2 text-xl font-extrabold text-cink">
          <Music4 size={20} className="text-cbrand" /> Call ringtone
        </h2>
        <p className="mt-1 text-[12.5px] text-cmut">Plays when someone calls you. Tap the speaker to preview.</p>
        <div className="app-scroll mt-4 max-h-[46vh] overflow-y-auto">
          {RINGTONE_OPTIONS.map((r) => {
            const on = r.id === selected
            const playing = r.id === previewing
            return (
              <div
                key={r.id}
                className={`flex items-center gap-3 border-b border-cline py-2.5 last:border-b-0 ${on ? 'bg-csoft/60' : ''} rounded-xl px-2`}
              >
                <button
                  type="button"
                  className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-csoft text-cbrand transition hover:bg-cline"
                  aria-label={playing ? `Stop preview of ${r.name}` : `Preview ${r.name}`}
                  onClick={() => (playing ? stopPreview() : preview(r.id, r.file))}
                >
                  {playing ? <Square size={16} /> : <Play size={16} />}
                </button>
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => preview(r.id, r.file)}>
                  <span className="block truncate text-[15px] font-semibold text-cink">{r.name}</span>
                  <span className="block text-[11px] text-cmut">{r.file ? 'Free sound · mixkit' : 'Default synthesized ring'}</span>
                </button>
                <button
                  type="button"
                  className={`flex h-8 flex-none items-center gap-1.5 rounded-full px-3 text-[12px] font-bold transition ${
                    on ? 'bg-cbrand text-white' : 'bg-csoft text-cbrand hover:bg-cline'
                  }`}
                  onClick={() => choose(r.id, r.file)}
                >
                  {on ? <CheckCircle2 size={14} /> : null}
                  {on ? 'Selected' : 'Use'}
                </button>
              </div>
            )
          })}
        </div>
        <button
          className="btn-p mt-4"
          onClick={() => {
            stopPreview()
            onClose()
          }}
        >
          Done
        </button>
      </div>
    </div>
  )
}

/** Password input with show/hide toggle. */
function PwdField({
  label,
  value,
  setValue,
  show,
  toggle,
  autoComplete,
  placeholder,
  hint,
}: {
  label: string
  value: string
  setValue: (v: string) => void
  show: boolean
  toggle: () => void
  autoComplete: string
  placeholder?: string
  hint?: string
}) {
  return (
    <div>
      <label className="mb-2 block text-[13px] font-semibold text-[#4A5568]">{label}</label>
      <div className="relative">
        <input
          className="app-input w-full has-trailing"
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
        />
        <button
          type="button"
          tabIndex={-1}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-cmut transition hover:text-cink"
          onClick={toggle}
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>
      {hint && <p className="mt-1.5 text-[11px] leading-4 text-[#9AA8C7]">{hint}</p>}
    </div>
  )
}
