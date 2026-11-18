'use client'

import { useEffect, useMemo, useState } from 'react'
import { Avatar } from './Avatar'
import {
  Search,
  Plus,
  UserPlus,
  Download,
  MessageCircle,
  Phone,
  Video,
  Smartphone,
  Loader2,
} from 'lucide-react'
import { useApp } from '@/lib/callapp/store'
import { toast } from 'sonner'

interface PickerContact {
  name: string[]
  tel: string[]
}

export function ContactsTab({ variant = 'mobile' }: { variant?: 'mobile' | 'desktop' }) {
  const contacts = useApp((s) => s.contacts)
  const online = useApp((s) => s.online)
  const openChat = useApp((s) => s.openChat)
  const startCall = useApp((s) => s.startCall)
  const addContact = useApp((s) => s.addContact)
  const syncDeviceContacts = useApp((s) => s.syncDeviceContacts)
  const setTab = useApp((s) => s.setTab)
  const [query, setQuery] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const desk = variant === 'desktop'

  /** Open a conversation and land on the chats section (required by the desktop shell). */
  const messageUser = (id: string) => {
    openChat(id)
    setTab('chats')
  }

  /** Desktop shell: main panel CTA asks the list panel to open the add-contact dialog. */
  useEffect(() => {
    if (!desk) return
    const open = () => setShowAdd(true)
    window.addEventListener('call:open-add-contact', open)
    return () => window.removeEventListener('call:open-add-contact', open)
  }, [desk])

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = contacts.filter(
      (c) => !q || c.name.toLowerCase().includes(q) || c.phone.includes(q)
    )
    const byLetter = new Map<string, typeof filtered>()
    for (const c of filtered) {
      const letter = (c.name[0] ?? '#').toUpperCase()
      const arr = byLetter.get(letter) ?? []
      arr.push(c)
      byLetter.set(letter, arr)
    }
    return Array.from(byLetter.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [contacts, query])

  const registeredCount = contacts.filter((c) => c.user).length

  const pickDeviceContacts = async () => {
    const nav = navigator as Navigator & {
      contacts?: { select: (props: string[], opts?: { multiple?: boolean }) => Promise<PickerContact[]> }
    }
    if (!nav.contacts?.select) {
      toast.error('Device contacts are not supported in this browser. Add a contact manually instead.')
      return
    }
    try {
      const picked = await nav.contacts.select(['name', 'tel'], { multiple: true })
      if (!picked?.length) return
      setBusy(true)
      const mapped = picked
        .map((p) => ({ name: p.name?.[0] ?? '', phone: p.tel?.[0] ?? '' }))
        .filter((c) => c.phone)
      const res = await syncDeviceContacts(mapped)
      if (res) {
        toast.success(`Synced ${res.saved} contacts — ${res.matched} on CALL`)
      }
    } catch {
      toast.error('Contact selection cancelled')
    } finally {
      setBusy(false)
    }
  }

  const submitAdd = async () => {
    if (!newName.trim() || newPhone.replace(/\D/g, '').length < 7) return
    setBusy(true)
    const ok = await addContact(newName.trim(), newPhone)
    setBusy(false)
    if (ok) {
      toast.success(`${newName.trim()} added to contacts`)
      setShowAdd(false)
      setNewName('')
      setNewPhone('')
    } else {
      toast.error('Could not add contact')
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header
        className={`flex items-center gap-2.5 ${desk ? 'border-b border-cline px-5 pb-3 pt-5' : 'px-6 pt-14'}`}
      >
        <h1 className={`flex-1 font-extrabold tracking-tight text-cink ${desk ? 'text-[26px]' : 'text-[32px]'}`}>
          Contacts
        </h1>
        <button
          className={`flex items-center justify-center rounded-full bg-cbrand text-white transition hover:bg-cbrand-deep ${
            desk ? 'h-10 w-10' : 'h-11 w-11'
          }`}
          aria-label="New contact"
          onClick={() => setShowAdd(true)}
        >
          <Plus size={21} />
        </button>
      </header>

      <div
        className={`flex h-[46px] items-center gap-2.5 rounded-[14px] bg-[#F0F3FA] px-3.5 text-[#7A8499] ${
          desk ? 'mx-4 mt-4' : 'mx-6 mt-4'
        }`}
      >
        <Search size={19} />
        <input
          className="w-full bg-transparent text-[15px] text-cink outline-none placeholder:text-[#7A8499]"
          placeholder={`Search ${contacts.length} contacts`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className={`app-scroll mt-2 flex-1 overflow-y-auto ${desk ? 'desk-scroll pb-4' : 'pb-[96px]'}`}>
        <div className="px-4 py-2">
          <button
            className="flex w-full items-center gap-3.5 rounded-2xl p-2.5 text-left transition-colors hover:bg-cbg"
            onClick={() => void pickDeviceContacts()}
            disabled={busy}
          >
            <span className="flex h-[52px] w-[52px] flex-none items-center justify-center rounded-full bg-csoft text-cbrand">
              {busy ? <Loader2 size={24} className="animate-spin" /> : <Download size={24} />}
            </span>
            <div>
              <div className="text-[16px] font-bold text-cink">Sync device contacts</div>
              <div className="mt-0.5 flex items-center gap-1 text-sm text-[#4A5568]">
                <Smartphone size={14} /> Import from this phone
              </div>
            </div>
          </button>
          <button
            className="flex w-full items-center gap-3.5 rounded-2xl p-2.5 text-left transition-colors hover:bg-cbg"
            onClick={() => setShowAdd(true)}
          >
            <span className="flex h-[52px] w-[52px] flex-none items-center justify-center rounded-full bg-csoft text-cbrand">
              <UserPlus size={24} />
            </span>
            <div>
              <div className="text-[16px] font-bold text-cink">New contact</div>
              <div className="mt-0.5 text-sm text-[#4A5568]">Add someone by number</div>
            </div>
          </button>
        </div>

        {groups.length === 0 ? (
          <div className="flex flex-col items-center pt-16 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-csoft text-cbrand">
              <UserPlus size={32} />
            </div>
            <p className="mt-5 text-lg font-bold text-cink">No contacts yet</p>
            <p className="mt-1 px-10 text-sm text-cmut">
              Sync your device contacts or add numbers manually. Friends on CALL show a badge.
            </p>
          </div>
        ) : (
          groups.map(([letter, arr]) => (
            <div key={letter}>
              <div className={`pb-1 pt-3 text-xs font-bold text-cbrand ${desk ? 'px-5' : 'px-6'}`}>{letter}</div>
              {arr.map((c) => (
                <div key={c.id} className={`flex items-center gap-3 py-2.5 transition-colors hover:bg-cbg ${desk ? 'px-5' : 'px-6'}`}>
                  <Avatar
                    name={c.user?.name ?? c.name}
                    avatarKey={c.user?.avatarKey ?? 0}
                    size={desk ? 42 : 46}
                    online={c.user ? online[c.user.id] : undefined}
                    src={c.user?.avatarUrl ?? null}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[15px] font-bold text-cink">
                      <span className="truncate">{c.user?.name ?? c.name}</span>
                      {c.user && (
                        <span className="flex-none rounded-full bg-[#E3EBFF] px-2 py-0.5 text-[10px] font-bold text-cbrand-deep">
                          ON CALL
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-[13px] text-[#4A5568]">
                      {c.user ? (online[c.user.id] ? 'Online now' : 'Invite them for a free call') : c.phone}
                    </div>
                  </div>
                  {c.user ? (
                    <>
                      <button
                        className="flex h-10 w-10 items-center justify-center rounded-full text-cbrand hover:bg-csoft"
                        aria-label={`Message ${c.user.name}`}
                        onClick={() => messageUser(c.user!.id)}
                      >
                        <MessageCircle size={20} />
                      </button>
                      <button
                        className="flex h-10 w-10 items-center justify-center rounded-full text-cbrand hover:bg-csoft"
                        aria-label={`Voice call ${c.user.name}`}
                        onClick={() => startCall(c.user!, 'voice')}
                      >
                        <Phone size={19} />
                      </button>
                      <button
                        className="flex h-10 w-10 items-center justify-center rounded-full text-cbrand hover:bg-csoft"
                        aria-label={`Video call ${c.user.name}`}
                        onClick={() => startCall(c.user!, 'video')}
                      >
                        <Video size={20} />
                      </button>
                    </>
                  ) : (
                    <span className="rounded-full bg-cbg px-3 py-1.5 text-xs font-semibold text-cmut">Not on CALL</span>
                  )}
                </div>
              ))}
            </div>
          ))
        )}

        <p className={`pt-4 text-center text-xs text-[#9AA8C7] ${desk ? 'px-5' : 'px-6'}`}>
          {registeredCount} of {contacts.length} contacts are on CALL
        </p>
      </div>

      {showAdd && (
        <div
          className={`inset-0 z-50 flex bg-black/45 ${
            desk ? 'fixed items-center justify-center p-6' : 'absolute items-end'
          }`}
          onClick={() => setShowAdd(false)}
        >
          <div
            className={`${desk ? 'w-full max-w-md rounded-[24px]' : 'w-full rounded-t-[28px]'} bg-white p-6 pb-8 shadow-2xl`}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Add contact"
          >
            {!desk && <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-cline" />}
            <h2 className="text-xl font-extrabold text-cink">New contact</h2>
            <p className="mt-1 text-sm text-cmut">Save a number to call and chat for free.</p>
            <div className="mt-5 space-y-3">
              <input className="app-input" placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)} />
              <input
                className="app-input"
                inputMode="tel"
                placeholder="Phone number (with country code)"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
              />
            </div>
            <button
              className="btn-p mt-5 w-full disabled:opacity-50"
              disabled={busy || !newName.trim() || newPhone.replace(/\D/g, '').length < 7}
              onClick={() => void submitAdd()}
            >
              <Plus size={18} /> Save contact
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
