'use client'

import { useMemo, useState } from 'react'
import { Avatar } from './Avatar'
import { useApp } from '@/lib/callapp/store'
import { useConferenceState } from '@/lib/callapp/conferenceManager'
import { Search, Video, Phone, Loader2, X, Users } from 'lucide-react'
import type { ConfInviteUser } from '@/lib/callapp/conferenceTypes'

/**
 * Incoming conference ring: full-screen dark overlay (same visual family as
 * CallOverlay's incoming state). Shown when someone invites me to a group
 * voice/video call — including the "X wants to add you to a group call"
 * suggestion after a 1:1 -> conference upgrade.
 */
export function ConferenceInviteUI() {
  const conf = useConferenceState()
  const acceptConferenceInvite = useApp((s) => s.acceptConferenceInvite)
  const declineConferenceInvite = useApp((s) => s.declineConferenceInvite)

  if (conf.phase !== 'invited' || !conf.invite) return null
  const inv = conf.invite
  const isVideo = inv.type === 'video'

  return (
    <div className="absolute inset-0 z-[95] flex flex-col overflow-hidden bg-dark-grad text-white">
      {/* top safe-area header */}
      <div className="flex flex-col items-center gap-1 bg-gradient-to-b from-black/40 to-transparent pb-4 pt-[max(env(safe-area-inset-top),12px)]">
        <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[#A9B6D3]">
          <Users size={13} /> Conference call
        </div>
      </div>

      {/* center: inviter + context */}
      <div className="flex flex-1 flex-col items-center justify-center">
        <div className="relative flex items-center justify-center">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="ring-anim absolute h-[150px] w-[150px] rounded-full border-2 border-[#3D6BFF]"
              style={{ animationDelay: `${i}s` }}
            />
          ))}
          <Avatar name={inv.from.name} avatarKey={inv.from.avatarKey} size={160} src={inv.from.avatarUrl} />
        </div>
        <h1 className="mt-8 text-[28px] font-extrabold tracking-tight">{inv.inviterName}</h1>
        <p className="mt-2.5 text-[15px] text-[#A9B6D3]">
          wants to add you to a group {isVideo ? 'video' : 'voice'} call
        </p>
        <p className="mt-1 text-[13px] text-[#6F7FA6]">
          {inv.memberCount} {inv.memberCount === 1 ? 'participant' : 'participants'} · free & encrypted
        </p>
      </div>

      {/* controls */}
      <div className="pb-[max(env(safe-area-inset-bottom),24px)] pt-4">
        <div className="flex items-end justify-around px-8">
          <button
            className="flex h-[68px] w-[68px] flex-col items-center justify-center rounded-full bg-cred text-white transition-transform active:scale-95"
            onClick={() => declineConferenceInvite()}
            aria-label="Decline group call"
          >
            <X size={26} />
            <span className="mt-0.5 text-[9px] font-bold">Decline</span>
          </button>
          <button
            className="flex h-[68px] w-[68px] flex-col items-center justify-center rounded-full bg-cgreen text-white shadow-[0_10px_28px_rgba(18,183,106,0.4)] transition-transform active:scale-95"
            onClick={() => void acceptConferenceInvite()}
            aria-label="Accept group call"
          >
            {isVideo ? <Video size={26} /> : <Phone size={26} />}
            <span className="mt-0.5 text-[9px] font-bold">Accept</span>
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Invite sheet — bottom sheet listing contacts with checkboxes, search and a
 * live "N/M participants" counter. Used both to CREATE a conference from the
 * Calls tab and to invite people into the CURRENT conference.
 * Capacity (max) comes from conference state (server-enforced value).
 */
export function ConferenceComposerSheet() {
  const conf = useConferenceState()
  if (conf.composerOpen === null) return null
  // keyed remount gives the sheet fresh local state every time it opens
  return <ComposerSheetInner key={conf.composerOpen} type={conf.composerOpen} />
}

function ComposerSheetInner({ type }: { type: 'voice' | 'video' }) {
  const conf = useConferenceState()
  const contacts = useApp((s) => s.contacts)
  const me = useApp((s) => s.me)
  const closeConferenceComposer = useApp((s) => s.closeConferenceComposer)
  const confirmConferenceComposer = useApp((s) => s.confirmConferenceComposer)

  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

  const candidates: ConfInviteUser[] = useMemo(
    () =>
      contacts
        .filter((c) => c.user && c.user.id !== me?.id)
        .map((c) => ({ id: c.user!.id, name: c.user!.name, avatarKey: c.user!.avatarKey, avatarUrl: c.user!.avatarUrl ?? null })),
    [contacts, me?.id]
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return candidates
    return candidates.filter((c) => c.name.toLowerCase().includes(q))
  }, [candidates, query])

  const members = conf.conf?.participants ?? []
  const memberIds = new Set(members.map((p) => p.userId))
  const max = conf.conf?.max ?? conf.maxParticipants
  const base = conf.conf ? members.length : 1 // I always count as a participant
  const total = base + selected.size
  const atCap = total >= max

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else if (!atCap && !memberIds.has(id)) {
        next.add(id)
      }
      return next
    })
  }

  const confirm = async () => {
    const users = candidates.filter((c) => selected.has(c.id))
    if (!users.length || busy) return
    setBusy(true)
    try {
      await confirmConferenceComposer(users)
      closeConferenceComposer()
    } catch {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 sm:items-center"
      onClick={() => !busy && closeConferenceComposer()}
      role="dialog"
      aria-modal="true"
      aria-label="Invite to group call"
    >
      <div
        className="flex max-h-[82dvh] w-full max-w-[560px] flex-col rounded-t-[24px] bg-white pb-[max(env(safe-area-inset-bottom),14px)] shadow-2xl sm:mb-4 sm:rounded-[24px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-center justify-between border-b border-cline px-4 py-3">
          <div className="flex items-center gap-2">
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-full text-white ${
                type === 'video' ? 'bg-gradient-to-r from-[#2f5bea] to-[#7B3FE4]' : 'bg-cbrand'
              }`}
            >
              {type === 'video' ? <Video size={15} /> : <Phone size={15} />}
            </span>
            <div>
              <div className="text-[14.5px] font-extrabold text-cink">
                {conf.conf ? 'Add people' : type === 'video' ? 'Group video call' : 'Group voice call'}
              </div>
              <div className="text-[11px] text-cmut">
                {total}/{max} participants · free & encrypted
              </div>
            </div>
          </div>
          <button
            onClick={() => !busy && closeConferenceComposer()}
            aria-label="Close"
            className="text-[12.5px] font-bold text-cmut hover:text-cink"
          >
            Close
          </button>
        </div>

        {/* search */}
        <div className="flex h-[42px] items-center gap-2.5 rounded-[14px] bg-[#F0F3FA] px-3.5 text-[#7A8499] mx-4 mt-3">
          <Search size={17} className="flex-none" />
          <input
            className="w-full min-w-0 bg-transparent text-[14px] text-cink outline-none placeholder:text-[#7A8499]"
            placeholder="Search contacts"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search contacts"
          />
        </div>

        {atCap && (
          <p className="mx-4 mt-2.5 rounded-[12px] bg-[#FFF0F3] px-3 py-2 text-[12.5px] font-semibold text-cred">
            Conference is full (max {max})
          </p>
        )}

        {/* list */}
        <div className="app-scroll mt-2 min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {/* current members: checked + disabled */}
          {members.map((m) => (
            <div key={m.userId} className="flex items-center gap-3 rounded-[14px] px-3 py-2.5 opacity-70">
              <Avatar name={m.name} avatarKey={m.avatarKey} size={44} src={m.avatarUrl} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-bold text-cink">
                  {m.name}
                  {m.userId === me?.id && <span className="font-semibold text-cmut"> (You)</span>}
                </div>
                <div className="text-[12px] text-cmut">In the call</div>
              </div>
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-csoft text-cbrand" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </span>
            </div>
          ))}

          {filtered.length === 0 && members.length === 0 && (
            <p className="px-6 py-10 text-center text-[13.5px] text-cmut">No contacts found</p>
          )}

          {filtered.map((c) => {
            const checked = selected.has(c.id)
            const disabled = memberIds.has(c.id) || (atCap && !checked)
            return (
              <button
                key={c.id}
                className={`flex w-full items-center gap-3 rounded-[14px] px-3 py-2.5 text-left transition-colors hover:bg-cbg ${
                  disabled ? 'opacity-50' : ''
                }`}
                onClick={() => !disabled && toggle(c.id)}
                aria-pressed={checked}
                disabled={disabled}
              >
                <Avatar name={c.name} avatarKey={c.avatarKey} size={44} src={c.avatarUrl} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-bold text-cink">{c.name}</div>
                  {memberIds.has(c.id) && <div className="text-[12px] text-cmut">Already invited</div>}
                </div>
                <span
                  className={`flex h-6 w-6 flex-none items-center justify-center rounded-full border-2 ${
                    checked ? 'border-cbrand bg-cbrand text-white' : 'border-[#C6CFE3] bg-white'
                  }`}
                  aria-hidden="true"
                >
                  {checked && (
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  )}
                </span>
              </button>
            )
          })}
        </div>

        {/* confirm */}
        <div className="border-t border-cline px-4 pt-3">
          <button
            className={`flex h-[50px] w-full items-center justify-center gap-2 rounded-[14px] font-bold text-white transition-all ${
              selected.size === 0 || busy ? 'bg-[#C6CFE3]' : 'bg-cbrand hover:bg-cbrand-deep'
            }`}
            disabled={selected.size === 0 || busy}
            onClick={() => void confirm()}
          >
            {busy && <Loader2 size={17} className="animate-spin" />}
            {conf.conf ? `Invite ${selected.size || ''}` : `Start group call${selected.size ? ` with ${selected.size}` : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}
