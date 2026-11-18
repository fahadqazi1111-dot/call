'use client'

import { useEffect, useRef, useState } from 'react'
import { Avatar } from './Avatar'
import { CallLogoMark } from './CallLogo'
import { useApp } from '@/lib/callapp/store'
import { api } from '@/lib/callapp/api'
import { toast } from 'sonner'
import {
  User,
  Bell,
  ShieldCheck,
  Info,
  ChevronRight,
  Camera,
  Pencil,
  LogOut,
  Zap,
  Globe2,
  Wifi,
  BadgeCheck,
  Loader2,
  Coins,
  Bot,
  Shield,
  AtSign,
  CheckCircle2,
  XCircle,
  Clock3,
} from 'lucide-react'

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
  const [showEdit, setShowEdit] = useState(false)
  const [editName, setEditName] = useState(me?.name ?? '')
  const [editAbout, setEditAbout] = useState(me?.about ?? '')
  const [busy, setBusy] = useState(false)
  const [photoBusy, setPhotoBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const desk = variant === 'desktop'

  // username dialog state
  const [showUsername, setShowUsername] = useState(false)
  const [uname, setUname] = useState('')
  const [unameStatus, setUnameStatus] = useState<'idle' | 'checking' | 'ok' | 'bad'>('idle')
  const [unameMsg, setUnameMsg] = useState('')
  const [unameBusy, setUnameBusy] = useState(false)
  const [nowTick, setNowTick] = useState(Date.now())

  useEffect(() => {
    if (!showUsername) return
    const t = window.setInterval(() => setNowTick(Date.now()), 30_000)
    return () => window.clearInterval(t)
  }, [showUsername])

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

  return (
    <div
      className={`app-scroll h-full overflow-y-auto ${
        desk ? 'desk-scroll mx-auto w-full max-w-xl pb-10 pt-10' : 'pb-[96px]'
      }`}
    >
      <div className={`flex flex-col items-center px-6 text-center ${desk ? 'pt-2' : 'pt-14'}`}>
        <div className="relative">
          <Avatar name={me.name} avatarKey={me.avatarKey} size={104} src={me.avatarUrl} />
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => void onPickFile(e)} />
          <button
            className="absolute -bottom-0 -right-1 flex h-9 w-9 items-center justify-center rounded-full border-2 border-cbg bg-white text-cbrand shadow transition hover:bg-csoft disabled:opacity-60"
            aria-label="Change profile photo"
            title="Change profile photo"
            disabled={photoBusy}
            onClick={() => fileRef.current?.click()}
          >
            {photoBusy ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
          </button>
        </div>
        <h1 className="mt-3.5 text-2xl font-extrabold text-cink">{me.name}</h1>
        <button
          className="mt-1 flex items-center gap-1 text-sm font-bold text-cbrand transition hover:opacity-80"
          onClick={openUsername}
          aria-label="Edit username"
        >
          <AtSign size={14} className="-ml-1" />
          {me.username}
          <Pencil size={11} className="opacity-60" />
        </button>
        <p className="mt-1 text-sm text-cmut">+{me.phone}</p>
        <span className="mt-3 inline-block rounded-[20px] bg-[#E3EBFF] px-4 py-1.5 text-[13px] font-semibold text-cbrand-deep">
          {me.about}
        </span>
        <div className="mt-3 flex items-center gap-4">
          <button
            className="flex items-center gap-1.5 text-sm font-semibold text-cbrand transition hover:opacity-80"
            onClick={() => fileRef.current?.click()}
          >
            <Camera size={14} /> Change photo
          </button>
          <button
            className="flex items-center gap-1.5 text-sm font-semibold text-cbrand transition hover:opacity-80"
            onClick={openEdit}
          >
            <Pencil size={14} /> Edit profile
          </button>
        </div>
      </div>

      <div className="mx-6 mt-6 overflow-hidden rounded-[20px] border border-cline bg-white">
        <Row Icon={AtSign} label="Username" sub={`@${me.username} · unique handle`} onClick={openUsername} />
        <Row Icon={Coins} label="Wallet & coins" sub={wallet ? `🪙 ${wallet.coins} coins · 💎 ${wallet.earnings} diamonds` : 'Coins, gifts & withdrawals'} onClick={() => setOverlay('wallet')} />
        <Row Icon={Bot} label="CALL AI Assistant" sub="Chat, voice & image intelligence" onClick={() => setOverlay('ai')} />
        <Row Icon={Bell} label="Notifications" sub="Messages, gifts & battles" onClick={() => setOverlay('notifications')} />
        {me.role === 'admin' && <Row Icon={Shield} label="Admin panel" sub="Manage the CALL platform" onClick={() => setOverlay('admin')} />}
      </div>

      <div className="mx-6 mt-3 overflow-hidden rounded-[20px] border border-cline bg-white">
        <Row Icon={User} label="Account" sub={me.email ? `${me.email}${me.emailVerified ? ' ✓ verified' : ''}` : me.phone} />
        <Row Icon={Bell} label="Push notifications" sub="New messages & calls" onClick={enableNotifications} />
        <Row Icon={ShieldCheck} label="Privacy & security" sub="Peer-to-peer encrypted calls" />
        <Row Icon={Zap} label="Free & unlimited" sub="Zero budget app — no charges ever" />
      </div>

      <div className="mx-6 mt-3 overflow-hidden rounded-[20px] border border-cline bg-white">
        <Row Icon={Wifi} label="Connection" sub="WebRTC + realtime socket" />
        <Row Icon={Globe2} label="Language" sub="English" />
        <Row Icon={Info} label="Help & support" sub="One World. One Call." />
      </div>

      <button
        className="mx-6 mt-4 flex h-[52px] items-center justify-center gap-2 rounded-[16px] text-[15px] font-semibold text-cred hover:bg-[#FEF0EF]"
        onClick={() => {
          if (confirm('Log out of CALL?')) logout()
        }}
      >
        <LogOut size={19} /> Log out
      </button>

      <div className="mt-6 flex flex-col items-center gap-1.5 pb-4">
        <div className="flex items-center gap-2 text-cmut">
          <CallLogoMark size={26} />
          <span className="text-sm font-extrabold tracking-tight text-cink">CALL</span>
          <span className="text-xs text-cmut">· One World. One Call.</span>
        </div>
        <div className="flex items-center gap-1 text-[11px] text-[#9AA8C7]">
          <BadgeCheck size={12} className="text-cgreen" /> Free forever · v1.0
        </div>
      </div>

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
                className="app-input pl-9 pr-10"
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
      className="flex w-full items-center gap-3.5 border-b border-cline px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-cbg"
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
