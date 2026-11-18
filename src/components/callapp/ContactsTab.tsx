'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
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
  Upload,
  FileUp,
  ClipboardPaste,
  X,
  Share2,
  ShieldCheck,
  Zap,
  Users,
} from 'lucide-react'
import { useApp } from '@/lib/callapp/store'
import { toast } from 'sonner'
import { shareInvite } from '@/lib/callapp/invite'
import { parseContactsSource, parseContactFile, type ParsedContact } from '@/lib/callapp/importContacts'

interface PickerContact {
  name: string[]
  tel: string[]
}

type ContactsPicker = { select: (props: string[], opts?: { multiple?: boolean }) => Promise<PickerContact[]> }

const pickerSupported = (): boolean => {
  const nav = navigator as Navigator & { contacts?: ContactsPicker }
  return typeof nav.contacts?.select === 'function'
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

  // contact-access permission sheet (WhatsApp-style explainer before any fetch)
  const [showPerm, setShowPerm] = useState(false)
  const [permBusy, setPermBusy] = useState(false)

  // import dialog state
  const [showImport, setShowImport] = useState(false)
  const [importTab, setImportTab] = useState<'file' | 'paste'>('file')
  const [parsed, setParsed] = useState<ParsedContact[]>([])
  const [pasteText, setPasteText] = useState('')
  const [fileName, setFileName] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
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
  const canPick = pickerSupported()

  /** Ask once per device, like WhatsApp does on first open of Contacts. */
  useEffect(() => {
    if (contacts.length > 0) return
    try {
      if (localStorage.getItem('call.contactsAsked') === '1') return
    } catch {}
    setShowPerm(true)
  }, [])

  const rememberAsked = () => {
    try {
      localStorage.setItem('call.contactsAsked', '1')
    } catch {}
  }

  /**
   * The actual access step, shown after the user taps "Allow".
   * Chrome Android: the browser's own native permission + picker UI.
   * Everywhere else: the universal import dialog (.vcf / CSV / paste).
   */
  const runAccess = async () => {
    rememberAsked()
    setShowPerm(false)
    if (!canPick) {
      setShowImport(true)
      setImportTab('file')
      return
    }
    try {
      setPermBusy(true)
      const picked = await (navigator as Navigator & { contacts: ContactsPicker }).contacts.select(
        ['name', 'tel'],
        { multiple: true }
      )
      if (!picked?.length) return
      setBusy(true)
      const mapped = picked
        .map((p) => ({ name: p.name?.[0] ?? '', phone: p.tel?.[0] ?? '' }))
        .filter((c) => c.phone)
      const res = await syncDeviceContacts(mapped)
      if (res) {
        toast.success(
          res.matched > 0
            ? `${res.matched} friend${res.matched > 1 ? 's' : ''} already on CALL out of ${res.saved} contacts`
            : `Synced ${res.saved} contacts — none on CALL yet, send invites below`
        )
      }
    } catch {
      // user denied in the browser picker or cancelled — offer the import path
      toast.error('Contact access was not granted — you can import a file instead')
      setShowImport(true)
      setImportTab('file')
    } finally {
      setPermBusy(false)
      setBusy(false)
    }
  }

  /** Every sync entry point goes through the permission explainer first. */
  const startSyncFlow = () => {
    if (permBusy) return
    setShowPerm(true)
  }

  /* ---------- import dialog helpers ---------- */

  const resetImport = () => {
    setShowImport(false)
    setParsed([])
    setPasteText('')
    setFileName('')
    if (fileRef.current) fileRef.current.value = ''
  }

  const onFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const list = parseContactFile(file.name, text)
      setParsed(list)
      setFileName(file.name)
      if (!list.length) {
        toast.error(`No phone numbers found in ${file.name}. Export a .vcf or CSV from Google Contacts / iPhone.`)
      }
    } catch {
      toast.error('Could not read that file')
    }
  }

  const runImport = async () => {
    if (!parsed.length) return
    setBusy(true)
    const res = await syncDeviceContacts(parsed)
    setBusy(false)
    if (res) {
      toast.success(`Imported ${res.saved} contacts — ${res.matched} already on CALL`)
      resetImport()
    } else {
      toast.error('Import failed — please try again')
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
            onClick={startSyncFlow}
            disabled={busy || permBusy}
          >
            <span className="flex h-[52px] w-[52px] flex-none items-center justify-center rounded-full bg-csoft text-cbrand">
              {busy || permBusy ? <Loader2 size={24} className="animate-spin" /> : <Download size={24} />}
            </span>
            <div>
              <div className="text-[16px] font-bold text-cink">
                {canPick ? 'Sync device contacts' : 'Import contacts'}
              </div>
              <div className="mt-0.5 flex items-center gap-1 text-sm text-[#4A5568]">
                {canPick ? (
                  <>
                    <Smartphone size={14} /> Allow access, find friends on CALL
                  </>
                ) : (
                  <>
                    <FileUp size={14} /> Upload .vcf / CSV or paste numbers
                  </>
                )}
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
          <button
            className="flex w-full items-center gap-3.5 rounded-2xl p-2.5 text-left transition-colors hover:bg-cbg"
            onClick={() => void shareInvite()}
          >
            <span className="flex h-[52px] w-[52px] flex-none items-center justify-center rounded-full bg-csoft text-cgreen">
              <Share2 size={24} />
            </span>
            <div>
              <div className="text-[16px] font-bold text-cink">Invite friends</div>
              <div className="mt-0.5 text-sm text-[#4A5568]">Share CALL — free forever</div>
            </div>
          </button>
        </div>

        {groups.length === 0 ? (
          <div className="flex flex-col items-center pt-12 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-csoft text-cbrand">
              <Users size={34} />
            </div>
            <p className="mt-5 text-lg font-bold text-cink">No contacts yet</p>
            <p className="mt-1 px-10 text-sm text-cmut">
              Allow access to your contacts — friends already on CALL appear here automatically, just like WhatsApp.
            </p>
            <button
              className="btn-p mt-6 w-[230px]"
              onClick={startSyncFlow}
              disabled={busy || permBusy}
            >
              {busy || permBusy ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
              {canPick ? 'Sync contacts' : 'Import contacts'}
            </button>
            <button
              className="mt-3 flex h-11 items-center gap-2 rounded-full px-5 text-sm font-bold text-cbrand transition hover:bg-csoft"
              onClick={() => void shareInvite()}
            >
              <Share2 size={17} /> Invite friends instead
            </button>
          </div>
        ) : (
          groups.map(([letter, arr]) => (
            <div key={letter}>
              <div className={`pb-1 pt-3 text-xs font-bold text-cbrand ${desk ? 'px-5' : 'px-6'}`}>{letter}</div>
              {arr.map((c) => (
                <div key={c.id} className={`flex items-center gap-3 py-2.5 transition-colors hover:bg-cbg ${desk ? 'px-5' : 'px-6'}`}>
                  <Avatar
                    name={c.name}
                    avatarKey={c.user?.avatarKey ?? 0}
                    size={desk ? 42 : 46}
                    online={c.user ? online[c.user.id] : undefined}
                    src={c.user?.avatarUrl ?? null}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[15px] font-bold text-cink">
                      <span className="truncate">{c.name}</span>
                      {c.user && (
                        <span className="flex-none rounded-full bg-[#E3EBFF] px-2 py-0.5 text-[10px] font-bold text-cbrand-deep">
                          ON CALL
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 truncate text-[13px] text-[#4A5568]">
                      {c.user
                        ? online[c.user.id]
                          ? 'Online now'
                          : c.phone
                        : `Not on CALL · ${c.phone}`}
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
                    <button
                      className="flex h-9 flex-none items-center gap-1.5 rounded-full bg-[#DFF3E7] px-3.5 text-xs font-bold text-[#0B8A46] transition hover:bg-[#CFEDDC]"
                      aria-label={`Invite ${c.name} to CALL`}
                      onClick={() => void shareInvite({ name: c.name, phone: c.phone })}
                    >
                      <Share2 size={14} /> Invite
                    </button>
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

      {/* ---------- contact access permission explainer (WhatsApp-style) ---------- */}
      {showPerm && (
        <div
          className={`inset-0 z-50 flex bg-black/45 ${
            desk ? 'fixed items-center justify-center p-6' : 'absolute items-end'
          }`}
          onClick={() => {
            rememberAsked()
            setShowPerm(false)
          }}
        >
          <div
            className={`${desk ? 'w-full max-w-md rounded-[24px]' : 'w-full rounded-t-[28px]'} bg-white p-6 pb-8 shadow-2xl`}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Contact access permission"
          >
            {!desk && <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-cline" />}
            <div className="flex flex-col items-center text-center">
              <span className="flex h-[74px] w-[74px] items-center justify-center rounded-[24px] bg-csoft text-cbrand">
                <Users size={36} />
              </span>
              <h2 className="mt-4 text-xl font-extrabold text-cink">Find friends on CALL</h2>
              <p className="mt-1.5 text-[15px] leading-6 text-cmut">
                Allow CALL to read your contacts so friends already here show up automatically —
                just like WhatsApp.
              </p>
            </div>

            <ul className="mt-5 space-y-3 text-left">
              <li className="flex items-start gap-3">
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[12px] bg-csoft text-cbrand">
                  <ShieldCheck size={19} />
                </span>
                <div>
                  <div className="text-[14px] font-bold text-cink">Private by design</div>
                  <div className="text-[13px] text-cmut">
                    Numbers are only matched, never sold or posted anywhere.
                  </div>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[12px] bg-csoft text-cbrand">
                  <Zap size={19} />
                </span>
                <div>
                  <div className="text-[14px] font-bold text-cink">Instant friend list</div>
                  <div className="text-[13px] text-cmut">
                    Anyone already registered appears with an ON CALL badge — ready to call or chat.
                  </div>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[12px] bg-[#DFF3E7] text-[#0B8A46]">
                  <Share2 size={19} />
                </span>
                <div>
                  <div className="text-[14px] font-bold text-cink">One-tap invite</div>
                  <div className="text-[13px] text-cmut">
                    Friends not on CALL yet get an invite button — share via SMS or any app.
                  </div>
                </div>
              </li>
            </ul>

            {canPick ? (
              <button className="btn-p mt-6 w-full" disabled={permBusy} onClick={() => void runAccess()}>
                {permBusy ? <Loader2 size={18} className="animate-spin" /> : <Users size={18} />}
                {permBusy ? 'Waiting for permission…' : 'Allow contact access'}
              </button>
            ) : (
              <button className="btn-p mt-6 w-full" disabled={permBusy} onClick={() => void runAccess()}>
                {permBusy ? <Loader2 size={18} className="animate-spin" /> : <FileUp size={18} />}
                Choose how to import
              </button>
            )}
            <button
              className="mt-3 h-11 w-full text-sm font-bold text-cmut transition hover:text-cink"
              onClick={() => {
                rememberAsked()
                setShowPerm(false)
              }}
            >
              Not now
            </button>
          </div>
        </div>
      )}

      {/* ---------- add single contact ---------- */}
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

      {/* ---------- universal import (desktop browsers, iPhone, Google Contacts) ---------- */}
      {showImport && (
        <div
          className={`inset-0 z-50 flex bg-black/45 ${desk ? 'fixed items-center justify-center p-6' : 'absolute items-end'}`}
          onClick={resetImport}
        >
          <div
            className={`${desk ? 'w-full max-w-md rounded-[24px]' : 'w-full rounded-t-[28px]'} bg-white p-6 pb-7 shadow-2xl`}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Import contacts"
          >
            {!desk && <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-cline" />}
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-extrabold text-cink">Import contacts</h2>
                <p className="mt-1 text-sm text-cmut">
                  Free &amp; private — works in any browser, nothing leaves your contacts book.
                </p>
              </div>
              <button
                className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-cbg text-cmut hover:bg-csoft"
                aria-label="Close import"
                onClick={resetImport}
              >
                <X size={16} />
              </button>
            </div>

            {/* tabs */}
            <div className="mt-4 grid grid-cols-2 gap-1.5 rounded-[16px] bg-cbg p-1.5">
              <button
                className={`flex h-10 items-center justify-center gap-2 rounded-[12px] text-sm font-bold transition ${
                  importTab === 'file' ? 'bg-white text-cbrand shadow-sm' : 'text-cmut hover:text-cink'
                }`}
                onClick={() => setImportTab('file')}
                aria-pressed={importTab === 'file'}
              >
                <FileUp size={16} /> Upload file
              </button>
              <button
                className={`flex h-10 items-center justify-center gap-2 rounded-[12px] text-sm font-bold transition ${
                  importTab === 'paste' ? 'bg-white text-cbrand shadow-sm' : 'text-cmut hover:text-cink'
                }`}
                onClick={() => {
                  setImportTab('paste')
                  setParsed(pasteText.trim() ? parseContactsSource('paste', pasteText) : [])
                }}
                aria-pressed={importTab === 'paste'}
              >
                <ClipboardPaste size={16} /> Paste numbers
              </button>
            </div>

            {importTab === 'file' ? (
              <div className="mt-4">
                <label
                  className="flex cursor-pointer flex-col items-center gap-2 rounded-[18px] border-2 border-dashed border-[#C9D3EC] px-4 py-7 text-center transition hover:border-cbrand hover:bg-csoft/60"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault()
                    if (e.dataTransfer.files?.[0] && fileRef.current) {
                      fileRef.current.files = e.dataTransfer.files
                      void onFileChosen({ target: fileRef.current } as React.ChangeEvent<HTMLInputElement>)
                    }
                  }}
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-csoft text-cbrand">
                    <Upload size={22} />
                  </span>
                  <span className="text-[15px] font-bold text-cink">
                    {fileName ? fileName : 'Choose a .vcf or CSV file'}
                  </span>
                  <span className="text-[13px] text-cmut">
                    Google Contacts → Export → vCard, or iPhone share contact
                  </span>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".vcf,.csv,.txt,text/vcard,text/csv,text/plain"
                    className="hidden"
                    onChange={(e) => void onFileChosen(e)}
                  />
                </label>
              </div>
            ) : (
              <div className="mt-4">
                <textarea
                  className="app-input app-scroll h-[132px] w-full resize-none py-3 leading-6"
                  placeholder={'One per line:\nAli Khan, +92 300 1234567\nSara Ahmed 0321 8887766\n+14155550123'}
                  value={pasteText}
                  onChange={(e) => {
                    setPasteText(e.target.value)
                    setParsed(e.target.value.trim() ? parseContactsSource('paste', e.target.value) : [])
                  }}
                  aria-label="Paste contact numbers"
                />
                <p className="mt-1.5 text-[13px] text-cmut">Paste any list — name and number per line, or just numbers.</p>
              </div>
            )}

            {/* preview */}
            {parsed.length > 0 && (
              <div className="mt-3 rounded-[16px] border border-cline bg-cbg/70 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-cink">Found {parsed.length} contacts</span>
                  <span className="text-xs font-semibold text-cmut">max 2000</span>
                </div>
                <div className="app-scroll mt-1.5 max-h-[92px] overflow-y-auto">
                  {parsed.slice(0, 12).map((c, i) => (
                    <div key={i} className="flex items-center justify-between py-0.5 text-[13px]">
                      <span className="truncate font-semibold text-cink">{c.name}</span>
                      <span className="flex-none text-cmut">{c.phone}</span>
                    </div>
                  ))}
                  {parsed.length > 12 && (
                    <div className="py-0.5 text-[13px] text-cmut">+ {parsed.length - 12} more…</div>
                  )}
                </div>
              </div>
            )}

            <button
              className="btn-p mt-4 w-full disabled:opacity-50"
              disabled={busy || parsed.length === 0}
              onClick={() => void runImport()}
            >
              {busy ? <Loader2 size={18} className="animate-spin" /> : <UserPlus size={18} />}
              {busy ? 'Importing…' : parsed.length ? `Import ${parsed.length} contacts` : 'Import contacts'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
