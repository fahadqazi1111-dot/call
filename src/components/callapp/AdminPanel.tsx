'use client'

import { useEffect, useState } from 'react'
import {
  X, Users, Gift, Package, Gem, ShieldAlert, Bot, Megaphone, Image as ImageIcon,
  Loader2, Ban, Coins, Crown, Radio, Clapperboard, Trash2, Plus, Lock,
} from 'lucide-react'
import { api } from '@/lib/callapp/api'
import { useApp } from '@/lib/callapp/store'
import type { GiftItem, CoinPackage } from '@/lib/callapp/types'

type Section = 'overview' | 'users' | 'gifts' | 'packages' | 'withdrawals' | 'moderation' | 'ai' | 'ads' | 'broadcast'

/** In-app admin panel — role-gated (role === 'admin'), all data server-authoritative. */
export function AdminPanel({ onClose }: { onClose: () => void }) {
  const me = useApp((s) => s.me)
  const [section, setSection] = useState<Section>('overview')
  const [isAdmin, setIsAdmin] = useState(me?.role === 'admin')
  const [setupCode, setSetupCode] = useState('')
  const [bootErr, setBootErr] = useState('')
  const [booting, setBooting] = useState(false)

  const bootstrap = async () => {
    setBooting(true)
    setBootErr('')
    try {
      await api.adminBootstrap(setupCode.trim())
      await useApp.getState().loadNotifications()
      setIsAdmin(true)
    } catch (e) {
      setBootErr((e as Error).message)
    } finally {
      setBooting(false)
    }
  }

  if (!isAdmin) {
    return (
      <div className="fixed inset-0 z-[88] flex items-center justify-center bg-white px-6">
        <div className="w-full max-w-sm text-center">
          <Lock size={34} className="mx-auto text-cmut" />
          <h2 className="pt-3 text-lg font-extrabold text-cink">Admin access</h2>
          <p className="pt-1 text-[13px] text-cmut">Enter the one-time setup code (shown in the deploy notes) to claim admin.</p>
          <input
            className="mt-4 h-12 w-full rounded-[14px] bg-[#F0F3FA] px-4 text-center text-[15px] font-bold outline-none"
            placeholder="Setup code"
            value={setupCode}
            onChange={(e) => setSetupCode(e.target.value)}
          />
          {bootErr && <p className="pt-2 text-[12px] font-semibold text-cred">{bootErr}</p>}
          <button
            className="mt-3 h-12 w-full rounded-[14px] bg-brand-grad font-bold text-white disabled:opacity-40"
            disabled={!setupCode.trim() || booting}
            onClick={() => void bootstrap()}
          >
            {booting ? <Loader2 className="mx-auto animate-spin" size={18} /> : 'Unlock admin panel'}
          </button>
          <button className="mt-3 text-[13px] font-semibold text-cmut" onClick={onClose}>
            Back to app
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[88] flex flex-col bg-white">
      <header className="flex items-center gap-3 border-b border-cline px-4 py-3.5">
        <button className="rounded-full bg-cbg p-2 text-cmut hover:text-cbrand" onClick={onClose} aria-label="Close admin">
          <X size={20} />
        </button>
        <h2 className="flex-1 text-[16px] font-extrabold text-cink">Admin Panel</h2>
        <span className="rounded-full bg-csoft px-3 py-1.5 text-[11px] font-bold text-cbrand">CALL control center</span>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* section rail */}
        <nav className="app-scroll w-[52px] shrink-0 overflow-y-auto border-r border-cline py-3 md:w-[200px] md:px-3">
          {(
            [
              { id: 'overview', label: 'Overview', Icon: ShieldAlert },
              { id: 'users', label: 'Users', Icon: Users },
              { id: 'gifts', label: 'Gifts', Icon: Gift },
              { id: 'packages', label: 'Coin packages', Icon: Package },
              { id: 'withdrawals', label: 'Withdrawals', Icon: Gem },
              { id: 'moderation', label: 'Moderation', Icon: Radio },
              { id: 'ai', label: 'CALL AI', Icon: Bot },
              { id: 'ads', label: 'Ads', Icon: ImageIcon },
              { id: 'broadcast', label: 'Broadcast', Icon: Megaphone },
            ] as const
          ).map(({ id, label, Icon }) => (
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
          {section === 'gifts' && <GiftsSection />}
          {section === 'packages' && <PackagesSection />}
          {section === 'withdrawals' && <WithdrawalsSection />}
          {section === 'moderation' && <ModerationSection />}
          {section === 'ai' && <AiSection />}
          {section === 'ads' && <AdsSection />}
          {section === 'broadcast' && <BroadcastSection />}
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
                {u.name} {u.role === 'admin' && <Crown size={13} className="text-[#B7791F]" />}
                {u.blocked && <Ban size={13} className="text-cred" />}
              </p>
              <p className="text-[11px] text-cmut">
                +{u.phone} · 🪙 {u.coins} · 💎 {u.earnings}
              </p>
            </div>
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
            <button className="rounded-full bg-green-50 px-3 py-1.5 text-[11px] font-bold text-green-700" onClick={() => void act(u.id, 'grant_coins', Number(prompt('Grant how many coins?')))}>
              <Coins size={12} className="mr-1 inline" /> Grant
            </button>
            {u.blocked ? (
              <button className="rounded-full bg-csoft px-3 py-1.5 text-[11px] font-bold text-cbrand" onClick={() => void act(u.id, 'unblock')}>
                Unblock
              </button>
            ) : (
              <button className="rounded-full bg-red-50 px-3 py-1.5 text-[11px] font-bold text-cred" onClick={() => void act(u.id, 'block')}>
                Block
              </button>
            )}
            {u.role === 'admin' ? (
              <button className="rounded-full bg-cbg px-3 py-1.5 text-[11px] font-bold text-cmut" onClick={() => void act(u.id, 'make_user')}>
                Demote
              </button>
            ) : (
              <button className="rounded-full bg-amber-50 px-3 py-1.5 text-[11px] font-bold text-[#B7791F]" onClick={() => void act(u.id, 'make_admin')}>
                Make admin
              </button>
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

function BroadcastSection() {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [msg, setMsg] = useState('')
  const send = async () => {
    setSending(true)
    try {
      const res = await api.adminBroadcast(title, body)
      setMsg(`Sent to ${res.delivered} users`)
      setTitle('')
      setBody('')
    } catch (e) {
      setMsg((e as Error).message)
    } finally {
      setSending(false)
    }
  }
  return (
    <div className="max-w-xl">
      <h3 className="pb-1 text-[15px] font-extrabold text-cink">Broadcast notification</h3>
      <p className="pb-3 text-[12px] text-cmut">Send an announcement to every user (appears in their notification center).</p>
      <input
        className="h-12 w-full rounded-[12px] bg-[#F0F3FA] px-4 text-[14px] outline-none"
        placeholder="Title"
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
      <button className="mt-3 h-12 rounded-[14px] bg-brand-grad px-8 text-[14px] font-bold text-white disabled:opacity-50" disabled={!title.trim() || sending} onClick={() => void send()}>
        {sending ? <Loader2 className="mx-auto animate-spin" size={18} /> : 'Send broadcast'}
      </button>
    </div>
  )
}
