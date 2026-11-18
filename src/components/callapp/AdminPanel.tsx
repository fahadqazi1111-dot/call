'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  X, Users, Gift, Package, Gem, ShieldAlert, Bot, Megaphone, Image as ImageIcon,
  Loader2, Ban, Coins, Radio, Clapperboard, Trash2, Plus, Mail, Send,
  LogOut, LayoutDashboard, UserPlus, ShieldCheck, KeyRound, Smartphone,
} from 'lucide-react'
import { api } from '@/lib/callapp/api'
import { useApp } from '@/lib/callapp/store'
import { StaffTick } from './StaffTick'
import type { GiftItem, CoinPackage } from '@/lib/callapp/types'

type Section = 'overview' | 'users' | 'team' | 'gifts' | 'packages' | 'withdrawals' | 'moderation' | 'ai' | 'ads' | 'broadcast' | 'smtp'

interface StaffMember {
  id: string
  name: string
  username: string
  email: string
  role: string
  blocked: boolean
  createdAt: string
  lastSeen: string
}

interface SenderOptions {
  official: { id: string; name: string; username: string; role: string }
  staff: Array<{ id: string; name: string; username: string; role: string }>
}

/**
 * Admin panel / staff console. Staff (admins + team members) log in with their
 * email + password on the normal login screen and land straight here —
 * no separate URL and no setup code.
 *  - admins (blue tick): full control incl. team management, broadcasts, SMTP
 *  - team members (yellow tick): read-mostly operations
 */
export function AdminPanel({ onClose, mode = 'overlay' }: { onClose?: () => void; mode?: 'overlay' | 'console' }) {
  const me = useApp((s) => s.me)
  const setStaffView = useApp((s) => s.setStaffView)
  const isAdmin = me?.role === 'admin'
  const isStaff = isAdmin || me?.role === 'team'
  const [section, setSection] = useState<Section>('overview')

  if (!isStaff) {
    return (
      <div className="fixed inset-0 z-[88] flex items-center justify-center bg-white px-6">
        <div className="w-full max-w-sm text-center">
          <ShieldCheck size={34} className="mx-auto text-cmut" />
          <h2 className="pt-3 text-lg font-extrabold text-cink">Staff access only</h2>
          <p className="pt-1 text-[13px] leading-5 text-cmut">
            Log in on the normal login screen with an admin or team member email and password to open
            the CALL control center.
          </p>
          {mode === 'overlay' && (
            <button className="mt-3 text-[13px] font-semibold text-cmut" onClick={onClose}>
              Back to app
            </button>
          )}
        </div>
      </div>
    )
  }

  const navItems = (
    [
      { id: 'overview', label: 'Overview', Icon: ShieldAlert, adminOnly: false },
      { id: 'users', label: 'Users', Icon: Users, adminOnly: false },
      { id: 'team', label: 'Team', Icon: UserPlus, adminOnly: true },
      { id: 'gifts', label: 'Gifts', Icon: Gift, adminOnly: false },
      { id: 'packages', label: 'Coin packages', Icon: Package, adminOnly: false },
      { id: 'withdrawals', label: 'Withdrawals', Icon: Gem, adminOnly: false },
      { id: 'moderation', label: 'Moderation', Icon: Radio, adminOnly: false },
      { id: 'ai', label: 'CALL AI', Icon: Bot, adminOnly: false },
      { id: 'ads', label: 'Ads', Icon: ImageIcon, adminOnly: false },
      { id: 'broadcast', label: 'Messages', Icon: Megaphone, adminOnly: true },
      { id: 'smtp', label: 'Email / SMTP', Icon: Mail, adminOnly: true },
    ] as const
  ).filter((item) => isAdmin || !item.adminOnly)

  return (
    <div className="fixed inset-0 z-[88] flex flex-col bg-white">
      <header className="flex items-center gap-3 border-b border-cline px-4 py-3.5">
        {mode === 'overlay' ? (
          <button className="rounded-full bg-cbg p-2 text-cmut hover:text-cbrand" onClick={onClose} aria-label="Close admin">
            <X size={20} />
          </button>
        ) : (
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-csoft text-cbrand">
            <LayoutDashboard size={19} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-1.5 text-[16px] font-extrabold text-cink">
            CALL Control Center
            <StaffTick role={me?.role} isOfficial={me?.isOfficial} size={15} />
          </h2>
          <p className="truncate text-[11.5px] text-cmut">
            {me?.name} · {isAdmin ? 'Admin (blue tick)' : 'Team member (yellow tick)'}
          </p>
        </div>
        <button
          className="rounded-full bg-csoft px-4 py-2 text-[12.5px] font-bold text-cbrand transition hover:bg-[#e2e9fb]"
          onClick={() => setStaffView('app')}
        >
          Open user app
        </button>
        <button
          className="flex items-center gap-1.5 rounded-full bg-red-50 px-4 py-2 text-[12.5px] font-bold text-cred transition hover:bg-red-100"
          onClick={() => useApp.getState().logout()}
        >
          <LogOut size={14} /> Log out
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* section rail */}
        <nav className="app-scroll w-[52px] shrink-0 overflow-y-auto border-r border-cline py-3 md:w-[200px] md:px-3">
          {navItems.map(({ id, label, Icon }) => (
            <button
              key={id}
              className={`mb-1.5 flex w-full items-center gap-2.5 rounded-[12px] px-3 py-2.5 text-left text-[13px] font-semibold ${
                section === id ? 'bg-cbrand text-white' : 'text-cmut hover:bg-cbg'
              }`}
              onClick={() => setSection(id)}
            >
              <Icon size={17} className="flex-none" />
              <span className="hidden md:inline">{label}</span>
            </button>
          ))}
        </nav>

        <div className="app-scroll flex-1 overflow-y-auto px-4 py-4">
          {section === 'overview' && <OverviewSection />}
          {section === 'users' && <UsersSection />}
          {section === 'team' && isAdmin && <TeamSection />}
          {section === 'gifts' && <GiftsSection />}
          {section === 'packages' && <PackagesSection />}
          {section === 'withdrawals' && <WithdrawalsSection />}
          {section === 'moderation' && <ModerationSection />}
          {section === 'ai' && <AiSection />}
          {section === 'ads' && <AdsSection />}
          {section === 'broadcast' && isAdmin && <BroadcastSection />}
          {section === 'smtp' && isAdmin && <SmtpSection />}
        </div>
      </div>
    </div>
  )
}

/* ================= sections ================= */

function OverviewSection() {
  const [stats, setStats] = useState<{ users: number; rooms: number; lives: number; txCount: number } | null>(null)
  useEffect(() => {
    void (async () => {
      try {
        const [u, m] = await Promise.all([api.adminUsers(), api.adminModeration()])
        const w = await api.adminWithdrawals()
        setStats({ users: u.users.length, rooms: m.rooms.length, lives: m.lives.length, txCount: w.withdrawals.length })
      } catch {}
    })()
  }, [])
  const cards = [
    { label: 'Users (sampled)', value: stats?.users ?? '—', Icon: Users },
    { label: 'Live rooms', value: stats?.rooms ?? '—', Icon: Radio },
    { label: 'Live broadcasts', value: stats?.lives ?? '—', Icon: Clapperboard },
    { label: 'Withdrawal requests', value: stats?.txCount ?? '—', Icon: Gem },
  ]
  return (
    <div>
      <h3 className="pb-3 text-[15px] font-extrabold text-cink">Platform overview</h3>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map(({ label, value, Icon }) => (
          <div key={label} className="rounded-[16px] border border-cline bg-white p-4">
            <Icon size={18} className="text-cbrand" />
            <p className="pt-2 text-[24px] font-extrabold text-cink">{value}</p>
            <p className="text-[11px] text-cmut">{label}</p>
          </div>
        ))}
      </div>
      <p className="pt-4 text-[12px] text-cmut">
        Use the sections on the left to manage users, gifts, packages, withdrawals, moderation, the CALL AI, ads and broadcasts.
      </p>
    </div>
  )
}

function UsersSection() {
  const me = useApp((s) => s.me)
  const isAdmin = me?.role === 'admin'
  const [users, setUsers] = useState<Array<{ id: string; name: string; phone: string; role: string; blocked: boolean; coins: number; earnings: number }>>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)

  const load = async (query = '') => {
    setLoading(true)
    try {
      const res = await api.adminUsers(query)
      setUsers(res.users)
    } catch {}
    setLoading(false)
  }
  useEffect(() => {
    queueMicrotask(() => void load())
  }, [])

  const act = async (id: string, action: string, value?: number) => {
    try {
      await api.adminUserAction(id, action, value)
      await load(q)
    } catch (e) {
      alert((e as Error).message)
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2 pb-3">
        <h3 className="flex-1 text-[15px] font-extrabold text-cink">Users</h3>
        <input
          className="h-10 w-48 rounded-[12px] bg-[#F0F3FA] px-3 text-[13px] outline-none"
          placeholder="Search name/phone"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void load(q)}
        />
        <button className="rounded-full bg-cbrand px-3 py-2 text-[12px] font-bold text-white" onClick={() => void load(q)}>
          Search
        </button>
      </div>
      {loading && <Loader2 className="mx-auto animate-spin text-cbrand" size={22} />}
      <div className="space-y-2">
        {users.map((u) => (
          <div key={u.id} className="flex flex-wrap items-center gap-2 rounded-[14px] border border-cline px-3.5 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-[14px] font-bold text-cink">
                {u.name}
                <StaffTick role={u.role} size={14} />
                {u.blocked && <Ban size={13} className="text-cred" />}
              </p>
              <p className="text-[11px] text-cmut">
                {u.email ? `${u.email} · ` : ''}+{u.phone} · 🪙 {u.coins} · 💎 {u.earnings}
              </p>
            </div>
            {isAdmin && (
              <input
                type="number"
                placeholder="coins"
                className="h-9 w-20 rounded-[10px] bg-[#F0F3FA] px-2 text-[12px] outline-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const v = Number((e.target as HTMLInputElement).value)
                    if (v > 0) void act(u.id, 'grant_coins', v)
                  }
                }}
              />
            )}
            {isAdmin && (
              <button className="rounded-full bg-green-50 px-3 py-1.5 text-[11px] font-bold text-green-700" onClick={() => void act(u.id, 'grant_coins', Number(prompt('Grant how many coins?')))}>
                <Coins size={12} className="mr-1 inline" /> Grant
              </button>
            )}
            {isAdmin && (
              u.blocked ? (
                <button className="rounded-full bg-csoft px-3 py-1.5 text-[11px] font-bold text-cbrand" onClick={() => void act(u.id, 'unblock')}>
                  Unblock
                </button>
              ) : (
                <button className="rounded-full bg-red-50 px-3 py-1.5 text-[11px] font-bold text-cred" onClick={() => void act(u.id, 'block')}>
                  Block
                </button>
              )
            )}
            {isAdmin && (
              u.role === 'admin' ? (
                <button className="rounded-full bg-cbg px-3 py-1.5 text-[11px] font-bold text-cmut" onClick={() => void act(u.id, 'make_user')}>
                  Demote
                </button>
              ) : u.role === 'team' ? (
                <button className="rounded-full bg-csoft px-3 py-1.5 text-[11px] font-bold text-cbrand" onClick={() => void act(u.id, 'make_admin')}>
                  Make admin
                </button>
              ) : (
                <>
                  <button className="rounded-full bg-amber-50 px-3 py-1.5 text-[11px] font-bold text-[#B7791F]" onClick={() => void act(u.id, 'make_team')}>
                    <KeyRound size={12} className="mr-1 inline" /> Team
                  </button>
                  <button className="rounded-full bg-csoft px-3 py-1.5 text-[11px] font-bold text-cbrand" onClick={() => void act(u.id, 'make_admin')}>
                    Make admin
                  </button>
                </>
              )
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function GiftsSection() {
  const [gifts, setGifts] = useState<GiftItem[]>([])
  const [loading, setLoading] = useState(true)
  const load = async () => {
    setLoading(true)
    try {
      const res = await api.adminGifts()
      setGifts(res.gifts)
    } catch {}
    setLoading(false)
  }
  useEffect(() => {
    queueMicrotask(() => void load())
  }, [])

  const create = async () => {
    const name = prompt('Gift name:')
    if (!name) return
    const emoji = prompt('Emoji (e.g. 🎁):') || '🎁'
    const priceCoins = Number(prompt('Price (coins):') || '10')
    const earnValue = priceCoins * 0.5
    await api.adminGiftCreate({ name, emoji, priceCoins, earnValue, category: 'both' })
    queueMicrotask(() => void load())
  }
  const update = async (g: GiftItem) => {
    const price = Number(prompt(`New price for ${g.name} (current ${g.priceCoins}):`, String(g.priceCoins)))
    if (!price) return
    await api.adminGiftUpdate(g.id, { priceCoins: price, earnValue: price * 0.5 })
    queueMicrotask(() => void load())
  }
  const toggle = async (g: GiftItem) => {
    await api.adminGiftUpdate(g.id, { active: !g.active })
    queueMicrotask(() => void load())
  }
  const remove = async (g: GiftItem) => {
    if (!confirm(`Delete gift ${g.name}?`)) return
    await api.adminGiftDelete(g.id)
    queueMicrotask(() => void load())
  }

  if (loading) return <Loader2 className="mx-auto animate-spin text-cbrand" size={22} />
  return (
    <div>
      <div className="flex items-center gap-2 pb-3">
        <h3 className="flex-1 text-[15px] font-extrabold text-cink">Gifts & pricing</h3>
        <button className="flex items-center gap-1.5 rounded-full bg-cbrand px-3.5 py-2 text-[12px] font-bold text-white" onClick={() => void create()}>
          <Plus size={14} /> New gift
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {gifts.map((g) => (
          <div key={g.id} className={`rounded-[16px] border border-cline p-3.5 text-center ${g.active ? '' : 'opacity-45'}`}>
            <p className="text-[30px]">{g.emoji}</p>
            <p className="text-[13px] font-bold text-cink">{g.name}</p>
            <p className="text-[11px] text-cmut">🪙 {g.priceCoins} → 💎 {g.earnValue}</p>
            <p className="text-[10px] text-cmut">{g.category}</p>
            <div className="flex justify-center gap-1.5 pt-2">
              <button className="rounded-full bg-csoft px-2.5 py-1 text-[10px] font-bold text-cbrand" onClick={() => void update(g)}>
                Price
              </button>
              <button className="rounded-full bg-cbg px-2.5 py-1 text-[10px] font-bold text-cmut" onClick={() => void toggle(g)}>
                {g.active ? 'Disable' : 'Enable'}
              </button>
              <button className="rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-bold text-cred" onClick={() => void remove(g)}>
                <Trash2 size={11} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function PackagesSection() {
  const [packages, setPackages] = useState<CoinPackage[]>([])
  const [loading, setLoading] = useState(true)
  const load = async () => {
    setLoading(true)
    try {
      const res = await api.adminPackages()
      setPackages(res.packages)
    } catch {}
    setLoading(false)
  }
  useEffect(() => {
    queueMicrotask(() => void load())
  }, [])
  const create = async () => {
    const name = prompt('Package name:')
    if (!name) return
    const coins = Number(prompt('Coins:') || '100')
    const bonus = Number(prompt('Bonus coins (0):') || '0')
    const priceUsd = Number(prompt('Price USD:') || '0.99')
    await api.adminPackageCreate({ name, coins, bonus, priceUsd })
    queueMicrotask(() => void load())
  }
  if (loading) return <Loader2 className="mx-auto animate-spin text-cbrand" size={22} />
  return (
    <div>
      <div className="flex items-center gap-2 pb-3">
        <h3 className="flex-1 text-[15px] font-extrabold text-cink">Coin packages</h3>
        <button className="flex items-center gap-1.5 rounded-full bg-cbrand px-3.5 py-2 text-[12px] font-bold text-white" onClick={() => void create()}>
          <Plus size={14} /> New package
        </button>
      </div>
      <div className="space-y-2">
        {packages.map((p) => (
          <div key={p.id} className={`flex items-center gap-3 rounded-[14px] border border-cline px-3.5 py-2.5 ${p.active ? '' : 'opacity-45'}`}>
            <Coins size={18} className="text-[#F59E0B]" />
            <div className="flex-1">
              <p className="text-[14px] font-bold text-cink">
                {p.name} — {p.coins}{p.bonus ? ` +${p.bonus}` : ''} coins
              </p>
              <p className="text-[11px] text-cmut">${p.priceUsd}</p>
            </div>
            <button
              className="rounded-full bg-cbg px-3 py-1.5 text-[11px] font-bold text-cmut"
              onClick={async () => {
                await api.adminPackageUpdate(p.id, { active: !p.active })
                void load()
              }}
            >
              {p.active ? 'Disable' : 'Enable'}
            </button>
            <button
              className="rounded-full bg-red-50 px-3 py-1.5 text-[11px] font-bold text-cred"
              onClick={async () => {
                if (!confirm(`Delete ${p.name}?`)) return
                await api.adminPackageDelete(p.id)
                void load()
              }}
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function WithdrawalsSection() {
  const [items, setItems] = useState<Array<{ id: string; amount: number; method: string; destination: string; status: string; user: { name: string }; createdAt: string }>>([])
  const [loading, setLoading] = useState(true)
  const load = async () => {
    setLoading(true)
    try {
      const res = await api.adminWithdrawals()
      setItems(res.withdrawals)
    } catch {}
    setLoading(false)
  }
  useEffect(() => {
    queueMicrotask(() => void load())
  }, [])
  const review = async (id: string, action: 'approve' | 'reject') => {
    const note = action === 'reject' ? prompt('Rejection note (optional):') || '' : ''
    try {
      await api.adminWithdrawalReview(id, action, note)
      void load()
    } catch (e) {
      alert((e as Error).message)
    }
  }
  if (loading) return <Loader2 className="mx-auto animate-spin text-cbrand" size={22} />
  return (
    <div>
      <h3 className="pb-3 text-[15px] font-extrabold text-cink">Withdrawal requests</h3>
      <div className="space-y-2">
        {items.length === 0 && <p className="pt-6 text-center text-[13px] text-cmut">No requests</p>}
        {items.map((w) => (
          <div key={w.id} className="flex flex-wrap items-center gap-2 rounded-[14px] border border-cline px-3.5 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-bold text-cink">
                {w.amount.toLocaleString()} 💎 · {w.method.toUpperCase()}
              </p>
              <p className="truncate text-[11px] text-cmut">
                {w.user.name} → {w.destination} · {new Date(w.createdAt).toLocaleString()}
              </p>
            </div>
            <span className={`rounded-full px-3 py-1 text-[11px] font-bold capitalize ${w.status === 'approved' ? 'bg-green-50 text-green-700' : w.status === 'rejected' ? 'bg-red-50 text-cred' : 'bg-amber-50 text-[#B7791F]'}`}>
              {w.status}
            </span>
            {w.status === 'pending' && (
              <>
                <button className="rounded-full bg-green-600 px-3.5 py-1.5 text-[11px] font-bold text-white" onClick={() => void review(w.id, 'approve')}>
                  Approve
                </button>
                <button className="rounded-full bg-red-50 px-3.5 py-1.5 text-[11px] font-bold text-cred" onClick={() => void review(w.id, 'reject')}>
                  Reject
                </button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function ModerationSection() {
  const [data, setData] = useState<{ rooms: Array<{ id: string; title: string; host: string; participants: number; isPaid: boolean }>; lives: Array<{ id: string; title: string; host: string; viewerCount: number }>; stories: Array<{ id: string; kind: string; user: string; privacy: string }> } | null>(null)
  const load = async () => {
    try {
      setData(await api.adminModeration())
    } catch {}
  }
  useEffect(() => {
    queueMicrotask(() => void load())
  }, [])
  const act = async (type: 'room' | 'live' | 'story', id: string) => {
    await api.adminModerate(type, id)
    queueMicrotask(() => void load())
  }
  if (!data) return <Loader2 className="mx-auto animate-spin text-cbrand" size={22} />
  return (
    <div className="space-y-5">
      <div>
        <h3 className="pb-2 text-[15px] font-extrabold text-cink">Live voice rooms</h3>
        {data.rooms.length === 0 && <p className="text-[12px] text-cmut">None live</p>}
        {data.rooms.map((r) => (
          <div key={r.id} className="mb-2 flex items-center gap-3 rounded-[14px] border border-cline px-3.5 py-2.5">
            <Radio size={16} className="text-cbrand" />
            <div className="flex-1">
              <p className="text-[13px] font-bold text-cink">{r.title}</p>
              <p className="text-[11px] text-cmut">
                {r.host} · {r.participants} people {r.isPaid ? `· 💰 ${r.entryFee}` : ''}
              </p>
            </div>
            <button className="rounded-full bg-red-50 px-3 py-1.5 text-[11px] font-bold text-cred" onClick={() => void act('room', r.id)}>
              End room
            </button>
          </div>
        ))}
      </div>
      <div>
        <h3 className="pb-2 text-[15px] font-extrabold text-cink">Live broadcasts</h3>
        {data.lives.length === 0 && <p className="text-[12px] text-cmut">None live</p>}
        {data.lives.map((l) => (
          <div key={l.id} className="mb-2 flex items-center gap-3 rounded-[14px] border border-cline px-3.5 py-2.5">
            <Clapperboard size={16} className="text-[#E1306C]" />
            <div className="flex-1">
              <p className="text-[13px] font-bold text-cink">{l.title}</p>
              <p className="text-[11px] text-cmut">
                {l.host} · {l.viewerCount} viewers · {l.mode}
              </p>
            </div>
            <button className="rounded-full bg-red-50 px-3 py-1.5 text-[11px] font-bold text-cred" onClick={() => void act('live', l.id)}>
              End live
            </button>
          </div>
        ))}
      </div>
      <div>
        <h3 className="pb-2 text-[15px] font-extrabold text-cink">Recent stories</h3>
        {data.stories.length === 0 && <p className="text-[12px] text-cmut">None</p>}
        {data.stories.map((s) => (
          <div key={s.id} className="mb-2 flex items-center gap-3 rounded-[14px] border border-cline px-3.5 py-2.5">
            <span className="text-[16px]">{s.kind === 'photo' ? '🖼️' : s.kind === 'video' ? '🎬' : s.kind === 'voice' ? '🎙️' : '📝'}</span>
            <div className="flex-1">
              <p className="text-[13px] font-bold text-cink">{s.user}</p>
              <p className="text-[11px] text-cmut">
                {s.kind} · {s.privacy}
              </p>
            </div>
            <button className="rounded-full bg-red-50 px-3 py-1.5 text-[11px] font-bold text-cred" onClick={() => void act('story', s.id)}>
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function AiSection() {
  const [cfg, setCfg] = useState<Record<string, unknown> | null>(null)
  const [usage, setUsage] = useState<{ totals: { text: number; image: number; voice: number }; conversations: number; messages: number } | null>(null)
  const [saving, setSaving] = useState(false)
  const load = async () => {
    try {
      const res = await api.adminAi()
      setCfg(res.config)
      setUsage(res.usage)
    } catch {}
  }
  useEffect(() => {
    queueMicrotask(() => void load())
  }, [])
  const save = async () => {
    setSaving(true)
    try {
      await api.adminAiSave(cfg ?? {})
      await load()
      alert('AI settings saved')
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setSaving(false)
    }
  }
  if (!cfg) return <Loader2 className="mx-auto animate-spin text-cbrand" size={22} />
  const num = (k: string) => Number(cfg[k] ?? 0)
  const set = (k: string, v: unknown) => setCfg({ ...cfg, [k]: v })
  return (
    <div className="max-w-xl">
      <h3 className="pb-1 text-[15px] font-extrabold text-cink">CALL AI configuration</h3>
      <p className="pb-4 text-[12px] text-cmut">
        Provider: <b>{String(cfg.provider ?? 'zai')}</b> (credentials live server-side only) · Model: <b>{String(cfg.defaultModel ?? 'default')}</b>
      </p>
      <div className="grid grid-cols-2 gap-3">
        {(
          [
            ['dailyTextLimit', 'Daily text limit'],
            ['dailyImageLimit', 'Daily image limit'],
            ['dailyVoiceLimit', 'Daily voice limit'],
          ] as const
        ).map(([k, label]) => (
          <label key={k} className="block">
            <span className="text-[12px] font-semibold text-cmut">{label}</span>
            <input
              type="number"
              className="mt-1 h-11 w-full rounded-[12px] bg-[#F0F3FA] px-3 text-[14px] outline-none"
              value={num(k)}
              onChange={(e) => set(k, Number(e.target.value))}
            />
          </label>
        ))}
        <label className="flex items-center gap-2 rounded-[12px] bg-[#F0F3FA] px-3">
          <input type="checkbox" checked={!!cfg.voiceReplies} onChange={(e) => set('voiceReplies', e.target.checked)} />
          <span className="text-[13px] font-semibold text-cink">Voice replies (TTS)</span>
        </label>
        <label className="flex items-center gap-2 rounded-[12px] bg-[#F0F3FA] px-3">
          <input type="checkbox" checked={!!cfg.imageGen} onChange={(e) => set('imageGen', e.target.checked)} />
          <span className="text-[13px] font-semibold text-cink">Image generation</span>
        </label>
      </div>
      <button className="mt-4 h-12 rounded-[14px] bg-brand-grad px-8 text-[14px] font-bold text-white disabled:opacity-50" disabled={saving} onClick={() => void save()}>
        {saving ? <Loader2 className="mx-auto animate-spin" size={18} /> : 'Save AI settings'}
      </button>

      {usage && (
        <div className="mt-6">
          <h4 className="pb-2 text-[14px] font-extrabold text-cink">Usage (last 7 days)</h4>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-[14px] border border-cline p-3.5 text-center">
              <p className="text-[20px] font-extrabold text-cink">{usage.totals.text}</p>
              <p className="text-[11px] text-cmut">Text messages</p>
            </div>
            <div className="rounded-[14px] border border-cline p-3.5 text-center">
              <p className="text-[20px] font-extrabold text-cink">{usage.totals.image}</p>
              <p className="text-[11px] text-cmut">Images</p>
            </div>
            <div className="rounded-[14px] border border-cline p-3.5 text-center">
              <p className="text-[20px] font-extrabold text-cink">{usage.totals.voice}</p>
              <p className="text-[11px] text-cmut">Voice replies</p>
            </div>
          </div>
          <p className="pt-2 text-[12px] text-cmut">
            {usage.conversations} conversations · {usage.messages} total messages
          </p>
        </div>
      )}
    </div>
  )
}

function AdsSection() {
  const [ads, setAds] = useState<Array<{ id: string; title: string; body: string; active: boolean; placements: string; impressions: number; clicks: number }>>([])
  const [loading, setLoading] = useState(true)
  const load = async () => {
    setLoading(true)
    try {
      const res = await api.adminAds()
      setAds(res.ads)
    } catch {}
    setLoading(false)
  }
  useEffect(() => {
    queueMicrotask(() => void load())
  }, [])
  const create = async () => {
    const title = prompt('Ad title:')
    if (!title) return
    const body = prompt('Ad body:') || ''
    const linkUrl = prompt('Link URL (optional):') || undefined
    await api.adminAdCreate({ title, body, linkUrl, placements: ['chats', 'rooms'] })
    queueMicrotask(() => void load())
  }
  if (loading) return <Loader2 className="mx-auto animate-spin text-cbrand" size={22} />
  return (
    <div>
      <div className="flex items-center gap-2 pb-3">
        <h3 className="flex-1 text-[15px] font-extrabold text-cink">Ads (non-intrusive placements)</h3>
        <button className="flex items-center gap-1.5 rounded-full bg-cbrand px-3.5 py-2 text-[12px] font-bold text-white" onClick={() => void create()}>
          <Plus size={14} /> New ad
        </button>
      </div>
      <div className="space-y-2">
        {ads.length === 0 && <p className="pt-4 text-[13px] text-cmut">No ads configured</p>}
        {ads.map((a) => (
          <div key={a.id} className={`flex items-center gap-3 rounded-[14px] border border-cline px-3.5 py-2.5 ${a.active ? '' : 'opacity-45'}`}>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-bold text-cink">{a.title}</p>
              <p className="truncate text-[11px] text-cmut">
                {a.body} · {a.placements} · {a.impressions} views / {a.clicks} clicks
              </p>
            </div>
            <button
              className="rounded-full bg-cbg px-3 py-1.5 text-[11px] font-bold text-cmut"
              onClick={async () => {
                await api.adminAdUpdate(a.id, { active: !a.active })
                void load()
              }}
            >
              {a.active ? 'Disable' : 'Enable'}
            </button>
            <button
              className="rounded-full bg-red-50 px-3 py-1.5 text-[11px] font-bold text-cred"
              onClick={async () => {
                if (!confirm('Delete this ad?')) return
                await api.adminAdDelete(a.id)
                void load()
              }}
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

const SENDER_LABEL = (s: { name: string; role: string }) =>
  s.role === 'official' ? `${s.name} (Official)` : `${s.name} (${s.role === 'admin' ? 'Admin' : 'Team'})`

/** Mirrors DEFAULT_WELCOME_TEXT on the server — shown until the admin saves a custom one. */
const WELCOME_TEMPLATE_DEFAULT =
  'Welcome to CALL, {name}! Your account is ready and calling is completely free. Add contacts, start chats and enjoy unlimited voice and video calls. If you ever need help, this official account is where the CALL team will reach you.'

function BroadcastSection() {
  // ---- broadcast form ----
  const [senders, setSenders] = useState<SenderOptions | null>(null)
  const [senderId, setSenderId] = useState('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [msg, setMsg] = useState('')
  // ---- automated welcome ----
  const [welcomeSenderId, setWelcomeSenderId] = useState('')
  const [welcomeText, setWelcomeText] = useState(WELCOME_TEMPLATE_DEFAULT)
  const [welcomeLoading, setWelcomeLoading] = useState(true)
  const [savingWelcome, setSavingWelcome] = useState(false)

  const load = async () => {
    try {
      const res = await api.adminTeam()
      setSenders(res.senders)
      setSenderId((prev) => prev || res.senders.official.id)
      setWelcomeSenderId((prev) => prev || res.senders.official.id)
    } catch {}
    try {
      const s = await api.adminSettings()
      const m = (s.settings.messaging ?? {}) as { welcomeSenderId?: string; welcomeText?: string }
      if (m.welcomeSenderId) setWelcomeSenderId(m.welcomeSenderId)
      setWelcomeText(typeof m.welcomeText === 'string' && m.welcomeText.trim() ? m.welcomeText : WELCOME_TEMPLATE_DEFAULT)
    } catch {}
    setWelcomeLoading(false)
  }
  useEffect(() => {
    queueMicrotask(() => void load())
  }, [])

  const send = async () => {
    setSending(true)
    setMsg('')
    try {
      const res = await api.adminBroadcast(title, body, senderId || undefined)
      setMsg(`Delivered to ${res.delivered} users as "${res.senderName}"`)
      setTitle('')
      setBody('')
      toast.success(`Broadcast sent to ${res.delivered} users`)
    } catch (e) {
      setMsg((e as Error).message)
    } finally {
      setSending(false)
    }
  }

  const saveWelcome = async () => {
    setSavingWelcome(true)
    try {
      await api.adminSaveSettings('messaging', {
        welcomeSenderId: welcomeSenderId || null,
        welcomeText: welcomeText.trim(),
      })
      toast.success('Automated welcome message saved')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSavingWelcome(false)
    }
  }

  const senderList = senders ? [senders.official, ...senders.staff] : []

  return (
    <div className="max-w-2xl space-y-6">
      {/* ---------- automated messages ---------- */}
      <div className="rounded-[16px] border border-cline p-4">
        <h3 className="text-[15px] font-extrabold text-cink">Automated messages</h3>
        <p className="pb-3 pt-1 text-[12px] leading-5 text-cmut">
          Every new user is welcomed automatically with this message (plus a welcome email when the
          account has an email address and SMTP is configured). Pick which account sends it — users can
          never reply to the official account.
        </p>
        {welcomeLoading ? (
          <Loader2 className="animate-spin text-cbrand" size={20} />
        ) : (
          <>
            <label className="block">
              <span className="mb-1.5 block text-[12.5px] font-semibold text-[#4A5568]">Sent from</span>
              <select
                className="h-11 w-full rounded-[12px] bg-[#F0F3FA] px-3 text-[14px] font-medium outline-none"
                value={welcomeSenderId}
                onChange={(e) => setWelcomeSenderId(e.target.value)}
              >
                {senderList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {SENDER_LABEL(s)}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-3 block">
              <span className="mb-1.5 block text-[12.5px] font-semibold text-[#4A5568]">
                Welcome message · {'{name}'} becomes the user&apos;s first name
              </span>
              <textarea
                className="h-28 w-full resize-none rounded-[12px] bg-[#F0F3FA] px-4 py-3 text-[14px] outline-none"
                value={welcomeText}
                placeholder={WELCOME_TEMPLATE_DEFAULT}
                onChange={(e) => setWelcomeText(e.target.value)}
              />
            </label>
            <button
              className="mt-3 h-11 rounded-[14px] bg-brand-grad px-6 text-[13.5px] font-bold text-white disabled:opacity-50"
              disabled={savingWelcome || !welcomeText.trim()}
              onClick={() => void saveWelcome()}
            >
              {savingWelcome ? <Loader2 className="mx-auto animate-spin" size={17} /> : 'Save automated message'}
            </button>
          </>
        )}
      </div>

      {/* ---------- manual broadcast ---------- */}
      <div className="rounded-[16px] border border-cline p-4">
        <h3 className="text-[15px] font-extrabold text-cink">Broadcast to all users</h3>
        <p className="pb-3 pt-1 text-[12px] leading-5 text-cmut">
          One message, delivered to every user&apos;s chat from the account you pick below — official
          CALL by default, or any admin / team member. A notification is created as well.
        </p>
        {senders && (
          <label className="mb-3 block">
            <span className="mb-1.5 block text-[12.5px] font-semibold text-[#4A5568]">Send as</span>
            <select
              className="h-11 w-full rounded-[12px] bg-[#F0F3FA] px-3 text-[14px] font-medium outline-none"
              value={senderId}
              onChange={(e) => setSenderId(e.target.value)}
            >
              {senderList.map((s) => (
                <option key={s.id} value={s.id}>
                  {SENDER_LABEL(s)}
                </option>
              ))}
            </select>
          </label>
        )}
        <input
          className="h-12 w-full rounded-[12px] bg-[#F0F3FA] px-4 text-[14px] outline-none"
          placeholder="Title (first line of the message)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          className="mt-2 h-24 w-full resize-none rounded-[12px] bg-[#F0F3FA] px-4 py-3 text-[14px] outline-none"
          placeholder="Body (optional)"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        {msg && <p className="pt-2 text-[13px] font-semibold text-cbrand">{msg}</p>}
        <button
          className="mt-3 h-12 rounded-[14px] bg-brand-grad px-8 text-[14px] font-bold text-white disabled:opacity-50"
          disabled={!title.trim() || sending}
          onClick={() => void send()}
        >
          {sending ? (
            <>
              <Loader2 size={17} className="mr-2 inline animate-spin" /> Sending…
            </>
          ) : (
            <>
              <Send size={16} className="mr-2 inline" /> Send broadcast
            </>
          )}
        </button>
      </div>
    </div>
  )
}

/* ================= Team management ================= */

function TeamSection() {
  const me = useApp((s) => s.me)
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'team' as 'admin' | 'team' })
  const [creating, setCreating] = useState(false)
  const [err, setErr] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.adminTeam()
      setStaff(res.staff)
    } catch {}
    setLoading(false)
  }
  useEffect(() => {
    queueMicrotask(() => void load())
  }, [])

  const create = async () => {
    setCreating(true)
    setErr('')
    try {
      await api.adminTeamCreate({ ...form, email: form.email.trim().toLowerCase() })
      toast.success(`${form.name} added to the team`)
      setForm({ name: '', email: '', password: '', role: 'team' })
      setShowForm(false)
      await load()
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setCreating(false)
    }
  }

  const setRole = async (m: StaffMember, role: 'admin' | 'team' | 'user') => {
    try {
      await api.adminTeamUpdate(m.id, { role })
      toast.success(role === 'user' ? `${m.name} removed from the team` : `${m.name} is now ${role === 'admin' ? 'an admin' : 'a team member'}`)
      await load()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const resetPassword = async (m: StaffMember) => {
    const password = prompt(`New password for ${m.name} (min 8 characters):`)
    if (!password) return
    try {
      await api.adminTeamUpdate(m.id, { password })
      toast.success(`Password updated for ${m.name}`)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="flex flex-wrap items-center gap-2 pb-1">
        <h3 className="flex-1 text-[15px] font-extrabold text-cink">Team members</h3>
        <button
          className="flex items-center gap-1.5 rounded-full bg-cbrand px-4 py-2 text-[12.5px] font-bold text-white"
          onClick={() => setShowForm((v) => !v)}
        >
          <Plus size={14} /> New member
        </button>
      </div>
      <p className="pb-4 text-[12px] leading-5 text-cmut">
        Admins get the blue tick, team members the yellow tick. Staff log in on the normal login screen
        with their email + password and land in this control center.
      </p>

      {showForm && (
        <div className="mb-5 rounded-[16px] border border-cline bg-[#F8FAFF] p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              className="h-11 rounded-[12px] bg-white px-3.5 text-[14px] outline-none"
              placeholder="Full name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <input
              className="h-11 rounded-[12px] bg-white px-3.5 text-[14px] outline-none"
              placeholder="Email (used to log in)"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <input
              className="h-11 rounded-[12px] bg-white px-3.5 text-[14px] outline-none"
              placeholder="Password (min 8 characters)"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            <select
              className="h-11 rounded-[12px] bg-white px-3 text-[14px] font-medium outline-none"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as 'admin' | 'team' })}
            >
              <option value="team">Team member (yellow tick)</option>
              <option value="admin">Admin (blue tick)</option>
            </select>
          </div>
          {err && <p className="pt-2 text-[12.5px] font-semibold text-cred">{err}</p>}
          <button
            className="mt-3 h-11 rounded-[14px] bg-brand-grad px-6 text-[13.5px] font-bold text-white disabled:opacity-50"
            disabled={creating || form.name.trim().length < 2 || !form.email.trim() || form.password.length < 8}
            onClick={() => void create()}
          >
            {creating ? <Loader2 className="mx-auto animate-spin" size={17} /> : 'Create member'}
          </button>
        </div>
      )}

      {loading ? (
        <Loader2 className="mx-auto animate-spin text-cbrand" size={22} />
      ) : (
        <div className="space-y-2">
          {staff.map((m) => (
            <div key={m.id} className="flex flex-wrap items-center gap-2 rounded-[14px] border border-cline px-3.5 py-3">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-[14px] font-bold text-cink">
                  {m.name}
                  <StaffTick role={m.role} size={15} />
                  {m.id === me?.id && <span className="rounded-full bg-csoft px-2 py-0.5 text-[10px] font-bold text-cbrand">You</span>}
                </p>
                <p className="truncate text-[11px] text-cmut">
                  {m.email} · @{m.username} · joined {new Date(m.createdAt).toLocaleDateString()}
                </p>
              </div>
              {m.id !== me?.id && (
                <>
                  <select
                    className="h-9 rounded-[10px] bg-[#F0F3FA] px-2 text-[12px] font-semibold outline-none"
                    value={m.role}
                    onChange={(e) => void setRole(m, e.target.value as 'admin' | 'team' | 'user')}
                  >
                    <option value="admin">Admin (blue)</option>
                    <option value="team">Team (yellow)</option>
                    <option value="user">Remove from team</option>
                  </select>
                  <button
                    className="rounded-full bg-cbg px-3 py-1.5 text-[11px] font-bold text-cmut"
                    onClick={() => void resetPassword(m)}
                    aria-label={`Reset password for ${m.name}`}
                  >
                    <KeyRound size={12} className="mr-1 inline" /> Password
                  </button>
                </>
              )}
            </div>
          ))}
          {staff.length === 0 && <p className="pt-4 text-center text-[13px] text-cmut">No team members yet</p>}
        </div>
      )}

      <div className="mt-6 flex items-start gap-2.5 rounded-[14px] bg-cbg p-4 text-[12px] leading-5 text-cmut">
        <Smartphone size={15} className="mt-0.5 flex-none text-cbrand" />
        <span>
          Staff accounts have no phone number — they always log in with their email + password. OTP
          codes and calls are disabled for them.
        </span>
      </div>
    </div>
  )
}

/* ================= Email / SMTP ================= */

interface SmtpForm {
  host: string
  port: number
  secure: boolean
  user: string
  pass: string
  from: string
}

const SMTP_EMPTY: SmtpForm = { host: '', port: 587, secure: false, user: '', pass: '', from: '' }
const SMTP_GMAIL: SmtpForm = { host: 'smtp.gmail.com', port: 465, secure: true, user: '', pass: '', from: '' }

function SmtpSection() {
  const [form, setForm] = useState<SmtpForm | null>(null)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testTo, setTestTo] = useState('')
  const [configured, setConfigured] = useState(false)

  useEffect(() => {
    queueMicrotask(async () => {
      try {
        const res = await api.adminSettings()
        const s = (res.settings.smtp ?? {}) as Partial<SmtpForm>
        setForm({
          host: String(s.host ?? ''),
          port: Number(s.port ?? 587),
          secure: Boolean(s.secure ?? false),
          user: String(s.user ?? ''),
          pass: String(s.pass ?? ''),
          from: String(s.from ?? ''),
        })
        setConfigured(Boolean(s.host && s.user && s.pass && s.from))
      } catch {
        setForm(SMTP_EMPTY)
      }
    })
  }, [])

  if (!form) return <Loader2 className="mx-auto animate-spin text-cbrand" size={22} />

  const set = <K extends keyof SmtpForm>(k: K, v: SmtpForm[K]) => setForm({ ...form, [k]: v })
  const complete = form.host && form.user && form.pass && form.from

  const save = async () => {
    setSaving(true)
    try {
      await api.adminSaveSettings('smtp', { ...form, port: Number(form.port) || 587 })
      setConfigured(complete)
      toast.success('SMTP settings saved')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const runTest = async () => {
    setTesting(true)
    try {
      // pass the unsaved form values so the admin can test before saving
      const res = await api.adminSmtpTest({ ...form, port: Number(form.port) || 587 }, testTo.trim() || undefined)
      if (res.ok) toast.success(res.message || 'Test email sent')
      else toast.error(res.message || 'Test failed')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="max-w-xl">
      <div className="flex flex-wrap items-center gap-2 pb-1">
        <h3 className="text-[15px] font-extrabold text-cink">Email delivery (SMTP)</h3>
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
            configured ? 'bg-[#EDFAF3] text-[#067647]' : 'bg-cbg text-cmut'
          }`}
        >
          {configured ? 'Connected' : 'Not configured'}
        </span>
      </div>
      <p className="pb-4 text-[12px] leading-5 text-cmut">
        Used for email verification codes and OTP-based password reset emails. Credentials are stored
        server-side only.
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-[14px] bg-cbg p-3 text-[12px] leading-5 text-cmut">
        <Mail size={15} className="flex-none text-cbrand" />
        <span className="flex-1">
          <b>Gmail:</b> use host <b>smtp.gmail.com</b>, port <b>465</b>, and an <b>App Password</b> (Google
          Account → Security → 2-Step Verification → App passwords). Normal passwords do not work.
        </span>
        <button
          className="flex-none rounded-full bg-white px-3 py-1.5 text-[11.5px] font-bold text-cbrand shadow-sm"
          onClick={() => setForm({ ...SMTP_GMAIL, user: form.user, pass: form.pass, from: form.from })}
        >
          Use Gmail preset
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SmtpField label="SMTP host" value={form.host} onChange={(v) => set('host', v)} placeholder="smtp.gmail.com" />
        <SmtpField label="Port" value={String(form.port)} onChange={(v) => set('port', Number(v) || 0)} placeholder="465" type="number" />
        <SmtpField label="Username (email)" value={form.user} onChange={(v) => set('user', v)} placeholder="you@gmail.com" />
        <SmtpField label="App password" value={form.pass} onChange={(v) => set('pass', v)} placeholder="16-character app password" type="password" />
        <SmtpField label="From address" value={form.from} onChange={(v) => set('from', v)} placeholder="CALL <you@gmail.com> — just the email" />
        <label className="flex items-center gap-2.5 rounded-[12px] bg-[#F0F3FA] px-4 text-[13px] font-semibold text-cink sm:mt-0">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[#2f5bea]"
            checked={form.secure}
            onChange={(e) => set('secure', e.target.checked)}
          />
          Use SSL/TLS (port 465)
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2.5">
        <button
          className="h-11 rounded-[14px] bg-brand-grad px-6 text-[13.5px] font-bold text-white disabled:opacity-50"
          disabled={saving || !complete}
          onClick={() => void save()}
        >
          {saving ? <Loader2 className="mx-auto animate-spin" size={17} /> : 'Save settings'}
        </button>
      </div>

      <div className="mt-7 rounded-[16px] border border-cline p-4">
        <h4 className="text-[13.5px] font-extrabold text-cink">Test connection</h4>
        <p className="pb-3 pt-1 text-[12px] text-cmut">
          Verifies the login and sends a real test email. Tests the values in this form, even if not saved yet.
        </p>
        <div className="flex flex-col gap-2.5 sm:flex-row">
          <input
            className="h-11 flex-1 rounded-[12px] bg-[#F0F3FA] px-4 text-[14px] outline-none placeholder:text-[#8a94a8]"
            placeholder="Send test to… (default: SMTP username)"
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
          />
          <button
            className="flex h-11 items-center justify-center gap-2 rounded-[14px] border border-cline bg-white px-5 text-[13.5px] font-bold text-cink shadow-sm disabled:opacity-50"
            disabled={testing || !complete}
            onClick={() => void runTest()}
          >
            {testing ? <Loader2 className="animate-spin" size={16} /> : <Send size={15} className="text-cbrand" />}
            Send test email
          </button>
        </div>
      </div>
    </div>
  )
}

function SmtpField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12.5px] font-semibold text-[#4A5568]">{label}</span>
      <input
        className="h-11 w-full rounded-[12px] bg-[#F0F3FA] px-4 text-[14px] font-medium outline-none placeholder:text-[#8a94a8]"
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )
}
