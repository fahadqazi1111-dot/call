'use client'

import { useRef, useState } from 'react'
import { Avatar } from './Avatar'
import { CallLogoMark } from './CallLogo'
import { useApp } from '@/lib/callapp/store'
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
} from 'lucide-react'

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

  if (!me) return null

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
