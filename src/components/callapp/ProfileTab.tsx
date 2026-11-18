'use client'

import { useState } from 'react'
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
} from 'lucide-react'

export function ProfileTab({ variant = 'mobile' }: { variant?: 'mobile' | 'desktop' }) {
  const me = useApp((s) => s.me)
  const updateMe = useApp((s) => s.updateMe)
  const logout = useApp((s) => s.logout)
  const [showEdit, setShowEdit] = useState(false)
  const [editName, setEditName] = useState(me?.name ?? '')
  const [editAbout, setEditAbout] = useState(me?.about ?? '')
  const [busy, setBusy] = useState(false)
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

  return (
    <div
      className={`app-scroll flex h-full flex-col overflow-y-auto ${
        desk ? 'desk-scroll mx-auto w-full max-w-xl pb-10 pt-10' : 'pb-[96px] pt-0'
      }`}
    >
      <div className={`flex flex-col items-center px-6 text-center ${desk ? 'pt-2' : 'pt-16'}`}>
        <div className="relative">
          <Avatar name={me.name} avatarKey={me.avatarKey} size={104} />
          <button
            className="absolute -bottom-0 -right-1 flex h-9 w-9 items-center justify-center rounded-full border-2 border-cbg bg-white text-cbrand shadow"
            aria-label="Edit profile"
            onClick={() => {
              setEditName(me.name)
              setEditAbout(me.about)
              setShowEdit(true)
            }}
          >
            <Camera size={16} />
          </button>
        </div>
        <h1 className="mt-3.5 text-2xl font-extrabold text-cink">{me.name}</h1>
        <p className="mt-1 text-sm text-cmut">+{me.phone}</p>
        <span className="mt-3 inline-block rounded-[20px] bg-[#E3EBFF] px-4 py-1.5 text-[13px] font-semibold text-cbrand-deep">
          {me.about}
        </span>
        <button
          className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-cbrand"
          onClick={() => {
            setEditName(me.name)
            setEditAbout(me.about)
            setShowEdit(true)
          }}
        >
          <Pencil size={14} /> Edit profile
        </button>
      </div>

      <div className="mx-6 mt-6 overflow-hidden rounded-[20px] border border-cline bg-white">
        <Row Icon={User} label="Account" sub={me.phone} />
        <Row Icon={Bell} label="Notifications" sub="New messages & calls" onClick={enableNotifications} />
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
