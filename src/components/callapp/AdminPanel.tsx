'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  X, Users, Gift, Banknote, ShieldAlert, Bot, Megaphone, Image as ImageIcon,
  Loader2, Ban, DollarSign, Radio, Clapperboard, Trash2, Plus, Mail, Send,
  LogOut, LayoutDashboard, UserPlus, ShieldCheck, KeyRound, Smartphone,
  Landmark, FlaskConical, TrendingUp, Percent, ReceiptText, Wallet, Check, Flag, PhoneCall, Sparkles,
} from 'lucide-react'
import { api } from '@/lib/callapp/api'
import { useApp } from '@/lib/callapp/store'
import { AI_PROVIDERS, type AiProviderMeta } from '@/lib/callapp/aiProvidersShared'
import { StaffTick } from './StaffTick'
import type { AdminPaymentRow, AdminReportRow, AdminWithdrawalRow, BroadcastRow, FinanceSummary, GiftItem } from '@/lib/callapp/types'

type Section = 'overview' | 'users' | 'team' | 'gifts' | 'finance' | 'withdrawals' | 'moderation' | 'ai' | 'ads' | 'calls' | 'app' | 'broadcast' | 'smtp'

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
      { id: 'finance', label: 'Finance', Icon: DollarSign, adminOnly: false },
      { id: 'users', label: 'Users', Icon: Users, adminOnly: false },
      { id: 'team', label: 'Team', Icon: UserPlus, adminOnly: true },
      { id: 'gifts', label: 'Gifts & pricing', Icon: Gift, adminOnly: false },
      { id: 'withdrawals', label: 'Withdrawals', Icon: Landmark, adminOnly: false },
      { id: 'moderation', label: 'Moderation', Icon: Radio, adminOnly: false },
      { id: 'ai', label: 'CALL AI', Icon: Bot, adminOnly: false },
      { id: 'calls', label: 'Calls & Conference', Icon: PhoneCall, adminOnly: true },
      { id: 'app', label: 'App experience', Icon: Sparkles, adminOnly: true },
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
          {section === 'finance' && <FinanceSection />}
          {section === 'withdrawals' && <WithdrawalsSection />}
          {section === 'moderation' && <ModerationSection />}
          {section === 'ai' && <AiSection />}
          {section === 'calls' && isAdmin && <CallsSection />}
          {section === 'app' && isAdmin && <AppSection />}
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
  const [stats, setStats] = useState<{ users: number; rooms: number; lives: number; wdPending: number } | null>(null)
  const [finance, setFinance] = useState<FinanceSummary | null>(null)
  useEffect(() => {
    void (async () => {
      try {
        const [u, m, f] = await Promise.all([api.adminUsers(), api.adminModeration(), api.adminFinance()])
        const w = await api.adminWithdrawals()
        setStats({
          users: u.users.length,
          rooms: m.rooms.length,
          lives: m.lives.length,
          wdPending: w.withdrawals.filter((x) => x.status === 'pending' || x.status === 'under_review').length,
        })
        setFinance(f.summary)
      } catch {}
    })()
  }, [])
  const money = (n: number) => `$${(n || 0).toFixed(2)}`
  const cards = [
    { label: 'Users (sampled)', value: stats?.users ?? '—', Icon: Users },
    { label: 'Live rooms', value: stats?.rooms ?? '—', Icon: Radio },
    { label: 'Live broadcasts', value: stats?.lives ?? '—', Icon: Clapperboard },
    { label: 'Withdrawals awaiting review', value: stats?.wdPending ?? '—', Icon: Landmark },
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
      {finance && (
        <div className="pt-5">
          <h4 className="pb-2 text-[13.5px] font-extrabold text-cink">Real money at a glance</h4>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-[16px] border border-cline bg-white p-4">
              <DollarSign size={17} className="text-cbrand" />
              <p className="pt-2 text-[20px] font-extrabold text-cink">{money(finance.giftRevenue.gross)}</p>
              <p className="text-[11px] text-cmut">Gift revenue (verified)</p>
            </div>
            <div className="rounded-[16px] border border-cline bg-white p-4">
              <Percent size={17} className="text-cbrand" />
              <p className="pt-2 text-[20px] font-extrabold text-cink">{money(finance.giftRevenue.platformCommission)}</p>
              <p className="text-[11px] text-cmut">Platform commission ({finance.config.platformCommission}%)</p>
            </div>
            <div className="rounded-[16px] border border-cline bg-white p-4">
              <TrendingUp size={17} className="text-cbrand" />
              <p className="pt-2 text-[20px] font-extrabold text-cink">{money(finance.giftRevenue.creatorNet)}</p>
              <p className="text-[11px] text-cmut">Creator earnings</p>
            </div>
            <div className="rounded-[16px] border border-cline bg-white p-4">
              <Banknote size={17} className="text-cbrand" />
              <p className="pt-2 text-[20px] font-extrabold text-cink">{money(finance.adRevenue.total)}</p>
              <p className="text-[11px] text-cmut">Ad campaign revenue</p>
            </div>
          </div>
          {finance.testMode.count > 0 && (
            <p className="flex items-center gap-1.5 pt-3 text-[12px] font-semibold text-[#B7791F]">
              <FlaskConical size={13} /> {finance.testMode.count} test transactions ({money(finance.testMode.gross)}) are flagged sandbox and excluded from real revenue.
            </p>
          )}
        </div>
      )}
      <p className="pt-4 text-[12px] text-cmut">
        Use the sections on the left to manage the finance ledger, users, gifts, withdrawals, moderation, the CALL AI, ads and broadcasts.
      </p>
    </div>
  )
}

function UsersSection() {
  const me = useApp((s) => s.me)
  const isAdmin = me?.role === 'admin'
  const [users, setUsers] = useState<Array<{ id: string; name: string; username: string; phone: string; email: string | null; role: string; blocked: boolean; available: number; reserved: number; totalEarned: number; totalWithdrawn: number }>>([])
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

  const act = async (id: string, action: string, value?: number, note?: string) => {
    try {
      await api.adminUserAction(id, action, value, note)
      await load(q)
      toast.success('Done')
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const adjustBalance = (u: { id: string; name: string }) => {
    const raw = prompt(`Adjust balance for ${u.name}\nPositive = credit, negative = debit (USD):`, '10')
    if (!raw) return
    const amount = Number(raw)
    if (!amount || isNaN(amount)) {
      toast.error('Invalid amount')
      return
    }
    const note = prompt('Reason / note (recorded in the ledger):', 'Support adjustment') || 'Admin adjustment'
    void act(u.id, 'adjust_balance', amount, note)
  }

  return (
    <div>
      <div className="flex items-center gap-2 pb-3">
        <h3 className="flex-1 text-[15px] font-extrabold text-cink">Users</h3>
        <input
          className="h-10 w-48 min-w-0 rounded-[12px] bg-[#F0F3FA] px-3 text-[13px] outline-none"
          placeholder="Search name/phone/email/@user"
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
                {u.email ? `${u.email} · ` : ''}+{u.phone} · @{u.username}
              </p>
            </div>
            <div className="rounded-[12px] bg-cbg px-3 py-1.5 text-right">
              <p className="text-[12.5px] font-extrabold text-cink">${u.available.toFixed(2)}</p>
              <p className="text-[9.5px] text-cmut">available{u.reserved > 0 ? ` · $${u.reserved.toFixed(2)} reserved` : ''}</p>
            </div>
            {isAdmin && (
              <button className="rounded-full bg-csoft px-3 py-1.5 text-[11px] font-bold text-cbrand" onClick={() => adjustBalance(u)}>
                <DollarSign size={12} className="mr-1 inline" /> Adjust
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
    const priceUsd = Number(prompt('Price in USD (real money, e.g. 0.60):') || '1')
    if (!priceUsd || priceUsd <= 0) {
      toast.error('Invalid price')
      return
    }
    await api.adminGiftCreate({ name, emoji, priceUsd, category: 'both' })
    queueMicrotask(() => void load())
  }
  const update = async (g: GiftItem) => {
    const price = Number(prompt(`New USD price for ${g.name} (current $${g.priceUsd.toFixed(2)}):`, String(g.priceUsd)))
    if (!price || price <= 0) return
    await api.adminGiftUpdate(g.id, { priceUsd: price })
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
      <div className="flex items-center gap-2 pb-2">
        <h3 className="flex-1 text-[15px] font-extrabold text-cink">Gifts & pricing (real money)</h3>
        <button className="flex items-center gap-1.5 rounded-full bg-cbrand px-3.5 py-2 text-[12px] font-bold text-white" onClick={() => void create()}>
          <Plus size={14} /> New gift
        </button>
      </div>
      <p className="pb-3 text-[12px] text-cmut">
        Every gift has its own money price — buyers pay directly per gift (no coins/diamonds). Creators earn the net
        amount after the platform commission and payment processing fee.
      </p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {gifts.map((g) => (
          <div key={g.id} className={`rounded-[16px] border border-cline p-3.5 text-center ${g.active ? '' : 'opacity-45'}`}>
            <p className="text-[30px]">{g.emoji}</p>
            <p className="text-[13px] font-bold text-cink">{g.name}</p>
            <p className="text-[13px] font-extrabold text-[#D6336C]">${g.priceUsd.toFixed(2)}</p>
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

function FinanceSection() {
  const [summary, setSummary] = useState<FinanceSummary | null>(null)
  const [txs, setTxs] = useState<AdminPaymentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<{ status: string; purpose: string; provider: string }>({ status: '', purpose: '', provider: '' })
  const [cfg, setCfg] = useState<{ platformCommission: number; minWithdrawal: number; paymentFeePercent: number; paymentFeeFixed: number } | null>(null)
  const [savingCfg, setSavingCfg] = useState(false)
  const load = async (f = filters) => {
    setLoading(true)
    try {
      const res = await api.adminFinance({ status: f.status || undefined, purpose: f.purpose || undefined, provider: f.provider || undefined })
      setSummary(res.summary)
      setTxs(res.transactions)
      setCfg({
        platformCommission: res.summary.config.platformCommission,
        minWithdrawal: res.summary.config.minWithdrawal,
        paymentFeePercent: res.summary.config.paymentFeePercent,
        paymentFeeFixed: res.summary.config.paymentFeeFixed,
      })
    } catch {}
    setLoading(false)
  }
  useEffect(() => {
    queueMicrotask(() => void load())
  }, [])
  const money = (n: number) => `$${(n || 0).toFixed(2)}`
  const wd = summary?.withdrawalTotals ?? {}
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 pb-3">
        <h3 className="flex-1 text-[15px] font-extrabold text-cink">Finance — verified transactions only</h3>
        <select className="h-10 rounded-[12px] bg-[#F0F3FA] px-3 text-[12.5px] outline-none" value={filters.status} onChange={(e) => { const f = { ...filters, status: e.target.value }; setFilters(f); void load(f) }}>
          <option value="">All statuses</option>
          <option value="successful">Successful</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
          <option value="refunded">Refunded</option>
        </select>
        <select className="h-10 rounded-[12px] bg-[#F0F3FA] px-3 text-[12.5px] outline-none" value={filters.purpose} onChange={(e) => { const f = { ...filters, purpose: e.target.value }; setFilters(f); void load(f) }}>
          <option value="">All purposes</option>
          <option value="gift">Gift</option>
          <option value="room_entry">Room entry</option>
          <option value="ad_campaign">Ad campaign</option>
        </select>
        <select className="h-10 rounded-[12px] bg-[#F0F3FA] px-3 text-[12.5px] outline-none" value={filters.provider} onChange={(e) => { const f = { ...filters, provider: e.target.value }; setFilters(f); void load(f) }}>
          <option value="">All providers</option>
          <option value="stripe">Stripe</option>
          <option value="sandbox">Sandbox (test)</option>
        </select>
        <button className="rounded-full bg-cbrand px-3 py-2 text-[12px] font-bold text-white" onClick={() => void load()}>Refresh</button>
      </div>

      {cfg && (
        <div className="mb-4 rounded-[16px] border border-cline bg-white p-4">
          <h4 className="pb-1 text-[13.5px] font-extrabold text-cink">Commission & payouts configuration</h4>
          <p className="pb-3 text-[11.5px] text-cmut">Applies to every new gift / room entry — historical transactions keep their recorded split.</p>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <label className="block">
              <span className="text-[11.5px] font-semibold text-cmut">Platform commission (%)</span>
              <input type="number" min={0} max={90} className="mt-1 h-10 w-full rounded-[12px] bg-[#F0F3FA] px-3 text-[14px] outline-none"
                value={cfg.platformCommission} onChange={(e) => setCfg({ ...cfg, platformCommission: Number(e.target.value) })} />
            </label>
            <label className="block">
              <span className="text-[11.5px] font-semibold text-cmut">Minimum withdrawal ($)</span>
              <input type="number" min={1} className="mt-1 h-10 w-full rounded-[12px] bg-[#F0F3FA] px-3 text-[14px] outline-none"
                value={cfg.minWithdrawal} onChange={(e) => setCfg({ ...cfg, minWithdrawal: Number(e.target.value) })} />
            </label>
            <label className="block">
              <span className="text-[11.5px] font-semibold text-cmut">Provider fee (%) — tracked separately</span>
              <input type="number" step="0.1" min={0} className="mt-1 h-10 w-full rounded-[12px] bg-[#F0F3FA] px-3 text-[14px] outline-none"
                value={cfg.paymentFeePercent} onChange={(e) => setCfg({ ...cfg, paymentFeePercent: Number(e.target.value) })} />
            </label>
            <label className="block">
              <span className="text-[11.5px] font-semibold text-cmut">Provider fixed fee ($)</span>
              <input type="number" step="0.01" min={0} className="mt-1 h-10 w-full rounded-[12px] bg-[#F0F3FA] px-3 text-[14px] outline-none"
                value={cfg.paymentFeeFixed} onChange={(e) => setCfg({ ...cfg, paymentFeeFixed: Number(e.target.value) })} />
            </label>
          </div>
          <button
            className="mt-3 h-10 rounded-[14px] bg-brand-grad px-6 text-[13px] font-bold text-white disabled:opacity-50"
            disabled={savingCfg}
            onClick={async () => {
              setSavingCfg(true)
              try {
                await api.adminSaveSettings('finance', cfg)
                toast.success('Commission settings saved')
                void load()
              } catch (e) {
                toast.error((e as Error).message)
              } finally {
                setSavingCfg(false)
              }
            }}
          >
            {savingCfg ? <Loader2 className="mx-auto animate-spin" size={16} /> : 'Save configuration'}
          </button>
        </div>
      )}

      {loading || !summary ? (
        <Loader2 className="mx-auto animate-spin text-cbrand" size={22} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {([
              ['Gross gift revenue', money(summary.giftRevenue.gross), `${summary.giftRevenue.count} gifts`, DollarSign],
              ['Platform commission', money(summary.giftRevenue.platformCommission), `${summary.config.platformCommission}% of gross`, Percent],
              ['Provider fees (separate)', money(summary.giftRevenue.providerFees), 'never merged into commission', ReceiptText],
              ['Creator earnings (net)', money(summary.giftRevenue.creatorNet), 'credited to wallets', TrendingUp],
              ['Ad campaign revenue', money(summary.adRevenue.total), `${summary.adRevenue.count} campaigns`, Banknote],
              ['Successful payments', money(summary.payments.successful.amount), `${summary.payments.successful.count} transactions`, Check],
              ['Failed payments', money(summary.payments.failed.amount), `${summary.payments.failed.count} transactions`, X],
              ['Refunded payments', money(summary.payments.refunded.amount), `${summary.payments.refunded.count} transactions`, ReceiptText],
              ['Withdrawals pending', money(wd.pending?.amount ?? 0), `${wd.pending?.count ?? 0} requests`, Landmark],
              ['Withdrawals approved', money(wd.approved?.amount ?? 0), `${wd.approved?.count ?? 0} awaiting bank transfer`, Landmark],
              ['Withdrawals paid', money(wd.paid?.amount ?? 0), `${wd.paid?.count ?? 0} completed transfers`, Landmark],
              ['Withdrawals rejected', money(wd.rejected?.amount ?? 0), `${wd.rejected?.count ?? 0} — funds released`, Landmark],
            ] as [string, string, string, typeof DollarSign][]).map(([label, value, note, Icon]) => (
              <div key={label} className="rounded-[16px] border border-cline bg-white p-4">
                <Icon size={16} className="text-cbrand" />
                <p className="pt-1.5 text-[19px] font-extrabold text-cink">{value}</p>
                <p className="text-[11px] font-semibold text-cink">{label}</p>
                <p className="text-[10px] text-cmut">{note}</p>
              </div>
            ))}
          </div>
          {summary.testMode.count > 0 && (
            <p className="flex items-center gap-1.5 pt-3 text-[12px] font-semibold text-[#B7791F]">
              <FlaskConical size={13} /> {summary.testMode.count} sandbox transactions ({money(summary.testMode.gross)} gross / {money(summary.testMode.commission)} commission) — permanently flagged as test, excluded from all real figures above.
            </p>
          )}

          <h4 className="pb-2 pt-5 text-[13.5px] font-extrabold text-cink">Transactions (latest {txs.length})</h4>
          <div className="overflow-hidden rounded-[14px] border border-cline">
            <div className="max-h-[420px] overflow-y-auto app-scroll">
              {txs.length === 0 && <p className="p-5 text-center text-[12.5px] text-cmut">No transactions match the filters</p>}
              {txs.map((t) => (
                <div key={t.id} className="flex items-center gap-2.5 border-b border-cline px-3.5 py-2.5 last:border-b-0">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold text-cink">
                      {t.description} {t.isTest && <span className="rounded-full bg-[#FFF7E6] px-1.5 py-0.5 text-[9px] font-bold text-[#B7791F]">TEST</span>}
                    </p>
                    <p className="truncate text-[11px] text-cmut">
                      {t.user.name} (@{t.user.username}) · {t.purpose} · {t.provider} · {new Date(t.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold capitalize ${t.status === 'successful' ? 'bg-green-50 text-green-700' : t.status === 'failed' ? 'bg-red-50 text-cred' : 'bg-amber-50 text-[#B7791F]'}`}>{t.status}</span>
                  <span className="w-20 text-right text-[13px] font-extrabold text-cink">{money(t.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function WithdrawalsSection() {
  const [items, setItems] = useState<AdminWithdrawalRow[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const load = async (status = statusFilter) => {
    setLoading(true)
    try {
      const res = await api.adminWithdrawals(status || undefined)
      setItems(res.withdrawals)
    } catch {}
    setLoading(false)
  }
  useEffect(() => {
    queueMicrotask(() => void load())
  }, [])
  const act = async (w: AdminWithdrawalRow, action: 'under_review' | 'approve' | 'reject' | 'paid') => {
    try {
      if (action === 'reject') {
        const note = prompt('Rejection note (the reserved amount is released back to the creator):') || ''
        await api.adminWithdrawalReview(w.id, 'reject', note)
      } else if (action === 'paid') {
        const ref = prompt('Bank transfer reference (required, recorded in the audit trail):')
        if (!ref) return
        await api.adminWithdrawalReview(w.id, 'paid', undefined, ref)
      } else if (action === 'approve') {
        await api.adminWithdrawalReview(w.id, 'approve')
      } else {
        await api.adminWithdrawalReview(w.id, 'under_review')
      }
      toast.success(`Marked ${action === 'paid' ? 'paid' : action.replace('_', ' ')}`)
      void load()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }
  const STATUS_CLS: Record<string, string> = {
    pending: 'bg-amber-50 text-[#B7791F]',
    under_review: 'bg-[#EEF2FF] text-[#4338CA]',
    approved: 'bg-green-50 text-green-700',
    paid: 'bg-green-100 text-green-800',
    rejected: 'bg-red-50 text-cred',
  }
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 pb-3">
        <h3 className="flex-1 text-[15px] font-extrabold text-cink">Withdrawals — bank transfer only</h3>
        <select
          className="h-10 rounded-[12px] bg-[#F0F3FA] px-3 text-[12.5px] outline-none"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); void load(e.target.value) }}
        >
          <option value="">All</option>
          <option value="pending">Pending</option>
          <option value="under_review">Under review</option>
          <option value="approved">Approved</option>
          <option value="paid">Paid</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>
      <p className="pb-3 text-[12px] text-cmut">
        Requesting does NOT destroy the money — it moves to <b>reserved</b>. Marking <b>Paid</b> (after the real bank
        transfer) finalizes the deduction; rejecting releases the funds back to the creator.
      </p>
      {loading && <Loader2 className="mx-auto animate-spin text-cbrand" size={22} />}
      <div className="space-y-2">
        {items.length === 0 && !loading && <p className="pt-6 text-center text-[13px] text-cmut">No requests</p>}
        {items.map((w) => (
          <div key={w.id} className="rounded-[14px] border border-cline px-3.5 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-bold text-cink">
                  ${w.amount.toFixed(2)} · {w.method.toUpperCase()}
                  <span className={`ml-2 rounded-full px-2.5 py-0.5 text-[10px] font-bold capitalize ${STATUS_CLS[w.status] ?? ''}`}>{w.status.replace('_', ' ')}</span>
                </p>
                <p className="truncate text-[11px] text-cmut">
                  {w.user.name} ({w.user.username}) · {new Date(w.createdAt).toLocaleString()}
                  {w.transferRef ? ` · ref ${w.transferRef}` : ''}
                </p>
              </div>
              {w.status === 'pending' && (
                <button className="rounded-full bg-csoft px-3 py-1.5 text-[11px] font-bold text-cbrand" onClick={() => void act(w, 'under_review')}>
                  Under review
                </button>
              )}
              {['pending', 'under_review'].includes(w.status) && (
                <button className="rounded-full bg-green-600 px-3.5 py-1.5 text-[11px] font-bold text-white" onClick={() => void act(w, 'approve')}>
                  Approve
                </button>
              )}
              {w.status === 'approved' && (
                <button className="rounded-full bg-brand-grad px-3.5 py-1.5 text-[11px] font-bold text-white" onClick={() => void act(w, 'paid')}>
                  Mark paid
                </button>
              )}
              {!['paid', 'rejected'].includes(w.status) && (
                <button className="rounded-full bg-red-50 px-3.5 py-1.5 text-[11px] font-bold text-cred" onClick={() => void act(w, 'reject')}>
                  Reject
                </button>
              )}
            </div>
            <div className="mt-2 rounded-[12px] bg-cbg px-3 py-2 text-[11.5px] leading-[17px] text-cmut">
              <b className="text-cink">Bank details:</b> {w.bank.holderName} · {w.bank.bankName} ({w.bank.countryCode}) ·
              acct {w.bank.accountNumber}
              {w.bank.iban ? ` · IBAN ${w.bank.iban}` : ''}
              {w.bank.swift ? ` · SWIFT ${w.bank.swift}` : ''}
            </div>
            {w.adminNote && <p className="mt-1.5 px-1 text-[11px] text-cmut">Note: {w.adminNote}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}

function ModerationSection() {
  const [data, setData] = useState<{ rooms: Array<{ id: string; title: string; host: string; participants: number; isPaid: boolean; entryFee: number }>; lives: Array<{ id: string; title: string; host: string; viewerCount: number; mode: string }>; stories: Array<{ id: string; kind: string; user: string; privacy: string }>; reports: AdminReportRow[] } | null>(null)
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
  const reportAct = async (id: string, action: 'ban' | 'resolve' | 'dismiss') => {
    try {
      await api.adminModerate('report', id, action)
      queueMicrotask(() => void load())
    } catch (e) {
      toast((e as Error).message)
    }
  }
  if (!data) return <Loader2 className="mx-auto animate-spin text-cbrand" size={22} />
  return (
    <div className="space-y-5">
      <div>
        <h3 className="pb-2 text-[15px] font-extrabold text-cink">User reports</h3>
        {data.reports.length === 0 && <p className="text-[12px] text-cmut">No reports</p>}
        {data.reports.map((r) => (
          <div key={r.id} className="mb-2 rounded-[14px] border border-cline px-3.5 py-2.5">
            <div className="flex items-center gap-3">
              <Flag size={16} className="shrink-0 text-cred" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-bold text-cink">
                  {r.reporter.name} <span className="font-normal text-cmut">({r.reporter.username})</span>
                  <span className="mx-1.5 text-cmut">→</span>
                  {r.reported.name} <span className="font-normal text-cmut">({r.reported.username})</span>
                </p>
                <p className="mt-1 flex items-center gap-2 text-[11px] text-cmut">
                  <span className="rounded-full bg-csoft px-2 py-0.5 text-[10px] font-bold capitalize text-cbrand">{r.reason}</span>
                  {new Date(r.createdAt).toLocaleString()}
                  {r.status !== 'open' ? ` · ${r.status}` : ''}
                </p>
              </div>
            </div>
            {r.details && <p className="mt-1.5 line-clamp-2 px-0.5 text-[11.5px] leading-[17px] text-cmut">{r.details}</p>}
            {r.reported.blocked && (
              <p className="mt-1.5 px-0.5 text-[11px] font-bold text-cred">This user is already banned</p>
            )}
            {r.status === 'open' && (
              <div className="mt-2 flex gap-2">
                <button className="rounded-full bg-red-50 px-3 py-1.5 text-[11px] font-bold text-cred" onClick={() => void reportAct(r.id, 'ban')}>
                  Ban user
                </button>
                <button className="rounded-full bg-csoft px-3 py-1.5 text-[11px] font-bold text-cbrand" onClick={() => void reportAct(r.id, 'resolve')}>
                  Resolve
                </button>
                <button className="rounded-full bg-csoft px-3 py-1.5 text-[11px] font-bold text-cmut" onClick={() => void reportAct(r.id, 'dismiss')}>
                  Dismiss
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      <div>
        <h3 className="pb-2 text-[15px] font-extrabold text-cink">Live voice rooms</h3>
        {data.rooms.length === 0 && <p className="text-[12px] text-cmut">None live</p>}
        {data.rooms.map((r) => (
          <div key={r.id} className="mb-2 flex items-center gap-3 rounded-[14px] border border-cline px-3.5 py-2.5">
            <Radio size={16} className="text-cbrand" />
            <div className="flex-1">
              <p className="text-[13px] font-bold text-cink">{r.title}</p>
              <p className="text-[11px] text-cmut">
                {r.host} · {r.participants} people {r.isPaid ? `· $${r.entryFee.toFixed(2)} entry` : ''}
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

type AiProviderConfUi = { apiKey?: string; baseUrl?: string; model?: string }
type AiTestResult = { ok: boolean; text: string }

function AiSection() {
  const [cfg, setCfg] = useState<Record<string, unknown> | null>(null)
  const [usage, setUsage] = useState<{ totals: { text: number; image: number; voice: number }; conversations: number; messages: number } | null>(null)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<Record<string, AiTestResult>>({})
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
      toast.success('AI settings saved')
    } catch (e) {
      toast.error((e as Error).message || 'Could not save')
    } finally {
      setSaving(false)
    }
  }
  if (!cfg) return <Loader2 className="mx-auto animate-spin text-cbrand" size={22} />
  const num = (k: string) => Number(cfg[k] ?? 0)
  const set = (k: string, v: unknown) => setCfg({ ...cfg, [k]: v })
  const provs = (cfg.providers ?? {}) as Record<string, AiProviderConfUi>
  const activeProvider = String(cfg.activeProvider ?? 'zai')
  const setProv = (id: string, patch: AiProviderConfUi) =>
    setCfg({
      ...cfg,
      providers: { ...provs, [id]: { ...(provs[id] ?? {}), ...patch } },
    })
  const test = async (id: string) => {
    setTesting(id)
    try {
      const meta = AI_PROVIDERS.find((p) => p.id === id)
      const conf = provs[id] ?? {}
      const res = await api.adminAiTest({
        provider: id,
        model: conf.model || meta?.defaultModel,
        apiKey: conf.apiKey,
        baseUrl: conf.baseUrl,
      })
      setTestResult((r) => ({
        ...r,
        [id]: res.ok
          ? { ok: true, text: `Working — ${res.latencyMs}ms${res.reply ? ` · "${res.reply}"` : ''}` }
          : { ok: false, text: res.error || 'Test failed' },
      }))
    } catch (e) {
      setTestResult((r) => ({ ...r, [id]: { ok: false, text: (e as Error).message || 'Test failed' } }))
    } finally {
      setTesting(null)
    }
  }
  return (
    <div className="max-w-xl">
      <h3 className="pb-1 text-[15px] font-extrabold text-cink">CALL AI configuration</h3>
      <p className="pb-4 text-[12px] text-cmut">
        Active provider: <b>{activeProvider}</b> · API keys are stored server-side and never exposed to users.
        If the active provider fails, the built-in Z-AI provider answers automatically.
      </p>

      {/* ---- providers ---- */}
      <h4 className="pb-2 text-[14px] font-extrabold text-cink">AI providers</h4>
      <div className="flex flex-col gap-3">
        {AI_PROVIDERS.map((p) => (
          <ProviderCard
            key={p.id}
            meta={p}
            conf={provs[p.id] ?? {}}
            active={activeProvider === p.id}
            testing={testing === p.id}
            result={testResult[p.id]}
            onChange={(patch) => setProv(p.id, patch)}
            onTest={() => void test(p.id)}
            onActivate={() => set('activeProvider', p.id)}
          />
        ))}
      </div>

      {/* ---- limits ---- */}
      <h4 className="pb-2 pt-6 text-[14px] font-extrabold text-cink">Limits &amp; features</h4>
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

/** One provider card: API key, base URL (Venom), model select, test + activate. */
function ProviderCard({
  meta,
  conf,
  active,
  testing,
  result,
  onChange,
  onTest,
  onActivate,
}: {
  meta: AiProviderMeta
  conf: AiProviderConfUi
  active: boolean
  testing: boolean
  result?: AiTestResult
  onChange: (patch: AiProviderConfUi) => void
  onTest: () => void
  onActivate: () => void
}) {
  const modelInList = !!conf.model && meta.models.includes(conf.model)
  return (
    <div className={`rounded-[14px] border p-3.5 ${active ? 'border-cbrand bg-csoft/60' : 'border-cline'}`}>
      <div className="flex items-center gap-2">
        <p className="text-[13.5px] font-bold text-cink">{meta.label}</p>
        {active && <span className="rounded-full bg-cbrand px-2 py-0.5 text-[10px] font-bold text-white">Active</span>}
        <div className="ml-auto flex flex-none items-center gap-2">
          <button
            className="rounded-full bg-white px-3 py-1.5 text-[11px] font-bold text-cbrand ring-1 ring-cline disabled:opacity-50"
            disabled={testing}
            onClick={onTest}
          >
            {testing ? <Loader2 className="animate-spin" size={12} /> : 'Test'}
          </button>
          {!active && (
            <button className="rounded-full bg-cbrand px-3 py-1.5 text-[11px] font-bold text-white" onClick={onActivate}>
              Set active
            </button>
          )}
        </div>
      </div>
      {result && (
        <p className={`pt-1.5 text-[11px] leading-4 ${result.ok ? 'text-emerald-600' : 'text-red-600'}`}>{result.text}</p>
      )}
      {meta.keyless ? (
        <p className="pt-1.5 text-[11.5px] text-cmut">{meta.note}</p>
      ) : (
        <div className="pt-2.5">
          <div className="flex items-center gap-2">
            <input
              type="password"
              autoComplete="off"
              className="h-10 min-w-0 flex-1 rounded-[10px] bg-[#F0F3FA] px-3 text-[13px] outline-none"
              placeholder={conf.apiKey ? `Saved key ${conf.apiKey} — paste a new key to replace` : 'Paste API key'}
              value={conf.apiKey ?? ''}
              onChange={(e) => onChange({ apiKey: e.target.value })}
            />
            {meta.keyUrl && (
              <a href={meta.keyUrl} target="_blank" rel="noreferrer" className="flex-none text-[11px] font-bold text-cbrand underline">
                Get key
              </a>
            )}
          </div>
          {meta.editableBaseUrl && (
            <input
              className="mt-2 h-10 w-full rounded-[10px] bg-[#F0F3FA] px-3 text-[13px] outline-none"
              placeholder={`Base URL (default: ${meta.baseUrl})`}
              value={conf.baseUrl ?? ''}
              onChange={(e) => onChange({ baseUrl: e.target.value })}
            />
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <select
              aria-label={`${meta.label} model`}
              className="h-10 min-w-0 flex-1 rounded-[10px] bg-[#F0F3FA] px-2 text-[13px] outline-none"
              value={modelInList ? conf.model : ''}
              onChange={(e) => e.target.value && onChange({ model: e.target.value })}
            >
              <option value="">{conf.model && !modelInList ? `Current: ${conf.model}` : 'Select a model…'}</option>
              {meta.models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <input
              className="h-10 w-full rounded-[10px] bg-[#F0F3FA] px-3 text-[12px] outline-none sm:w-44"
              placeholder="Custom model id"
              aria-label="Custom model id"
              value={conf.model ?? ''}
              onChange={(e) => onChange({ model: e.target.value })}
            />
          </div>
        </div>
      )}
    </div>
  )
}

/** App experience: splash screen toggle (client-side, instant effect) */
function AppSection() {
  const [splashEnabled, setSplashEnabled] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const load = async () => {
    try {
      const res = await api.adminSettings()
      const app = (res.settings?.app ?? {}) as { splashEnabled?: boolean }
      setSplashEnabled(app.splashEnabled !== false)
    } catch {}
    setLoading(false)
  }
  useEffect(() => {
    queueMicrotask(() => void load())
  }, [])
  const save = async (next: boolean) => {
    setSaving(true)
    try {
      await api.adminSaveSettings('app', { splashEnabled: next })
      setSplashEnabled(next)
      toast.success(next ? 'Splash screen enabled' : 'Splash screen disabled — the app opens straight to login')
    } catch (e) {
      toast.error((e as Error).message || 'Could not save')
    } finally {
      setSaving(false)
    }
  }
  if (loading) return <Loader2 className="mx-auto animate-spin text-cbrand" size={22} />
  return (
    <div className="max-w-xl">
      <h3 className="pb-1 text-[15px] font-extrabold text-cink">App experience</h3>
      <p className="pb-4 text-[12px] text-cmut">
        Control branding surfaces shown before the app loads. Changes apply instantly for every user
        on the next app open.
      </p>
      <div className="flex items-center justify-between rounded-[16px] border border-cline px-4 py-3.5">
        <div>
          <p className="text-[13.5px] font-bold text-cink">Splash screen</p>
          <p className="text-[11.5px] text-cmut">Animated CALL logo while the app boots</p>
        </div>
        <button
          role="switch"
          aria-checked={splashEnabled}
          aria-label="Toggle splash screen"
          className={`relative h-8 w-14 flex-none rounded-full transition ${splashEnabled ? 'bg-cbrand' : 'bg-[#C6CFE3]'}`}
          disabled={saving}
          onClick={() => void save(!splashEnabled)}
        >
          <span
            className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${splashEnabled ? 'left-7' : 'left-1'}`}
          />
        </button>
      </div>
    </div>
  )
}

function CallsSection() {
  const [maxParticipants, setMaxParticipants] = useState<number>(5)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const load = async () => {
    try {
      const res = await api.adminSettings()
      const calls = (res.settings?.calls ?? {}) as { maxConferenceParticipants?: number }
      setMaxParticipants(Number(calls.maxConferenceParticipants ?? 5))
    } catch {}
    setLoading(false)
  }
  useEffect(() => {
    queueMicrotask(() => void load())
  }, [])
  const save = async () => {
    setSaving(true)
    try {
      const clamped = Math.min(12, Math.max(2, Math.floor(maxParticipants || 5)))
      await api.adminSaveSettings('calls', { maxConferenceParticipants: clamped })
      setMaxParticipants(clamped)
      alert('Conference settings saved — new conferences will use this limit')
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setSaving(false)
    }
  }
  if (loading) return <Loader2 className="mx-auto animate-spin text-cbrand" size={22} />
  return (
    <div className="max-w-xl">
      <h3 className="pb-1 text-[15px] font-extrabold text-cink">Calls &amp; Conference configuration</h3>
      <p className="pb-4 text-[12px] text-cmut">
        Conference calls use an encrypted peer-to-peer mesh. The participant limit is enforced by the
        call server — when the limit is reached, additional invitees are refused with a “conference is
        full” message.
      </p>
      <label className="block">
        <span className="text-[12px] font-semibold text-cmut">Maximum conference participants (2–12, default 5)</span>
        <input
          type="number"
          min={2}
          max={12}
          className="mt-1 h-11 w-full rounded-[12px] bg-[#F0F3FA] px-3 text-[14px] outline-none"
          value={maxParticipants}
          onChange={(e) => setMaxParticipants(Number(e.target.value))}
        />
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        {[3, 5, 8, 10].map((n) => (
          <button
            key={n}
            className={`rounded-full px-4 py-2 text-[12.5px] font-bold transition ${
              maxParticipants === n ? 'bg-cbrand text-white' : 'bg-csoft text-cmut hover:bg-[#e2e9fb]'
            }`}
            onClick={() => setMaxParticipants(n)}
          >
            {n}
          </button>
        ))}
      </div>
      <button
        className="mt-4 h-12 rounded-[14px] bg-brand-grad px-8 text-[14px] font-bold text-white disabled:opacity-50"
        disabled={saving}
        onClick={() => void save()}
      >
        {saving ? <Loader2 className="mx-auto animate-spin" size={18} /> : 'Save conference settings'}
      </button>
    </div>
  )
}

function AdsSection() {
  const [tab, setTab] = useState<'campaigns' | 'packages' | 'settings'>('campaigns')
  const [ads, setAds] = useState<Array<{
    id: string; title: string; body: string; imageUrl: string | null; linkUrl: string | null
    placements: string; status: string; isUserAd: boolean
    owner: { id: string; name: string; username: string; email: string | null } | null
    pkg: { id: string; name: string; durationDays: number; priceUsd: number } | null
    budget: number; totalCost: number; rejectionReason: string | null
    impressions: number; clicks: number; createdAt: string
  }>>([])
  const [packages, setPackages] = useState<Array<{ id: string; name: string; description: string; priceUsd: number; durationDays: number; placements: string; minBudget: number; order: number; active: boolean }>>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const [c, p] = await Promise.all([api.adminAds(), api.adminAdPackages()])
      setAds(c.ads)
      setPackages(p.packages)
    } catch {}
    setLoading(false)
  }
  useEffect(() => {
    queueMicrotask(() => void load())
  }, [])

  const act = async (id: string, action: 'approve' | 'reject' | 'activate' | 'pause' | 'complete') => {
    try {
      const reason = action === 'reject' ? prompt('Rejection reason (shown to the advertiser):') || 'Does not meet content guidelines' : undefined
      await api.adminAdAction(id, action, reason)
      toast.success(`Campaign ${action}d`)
      void load()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }
  const createHouseAd = async () => {
    const title = prompt('Ad title:')
    if (!title) return
    const body = prompt('Ad body:') || ''
    const linkUrl = prompt('Link URL (optional):') || undefined
    await api.adminAdCreate({ title, body, linkUrl, placements: ['chats', 'rooms'] })
    void load()
  }
  const createPackage = async () => {
    const name = prompt('Package name:')
    if (!name) return
    const priceUsd = Number(prompt('Price USD:', '15') || '15')
    const durationDays = Number(prompt('Duration (days):', '7') || '7')
    const minBudget = Number(prompt('Minimum budget USD (0 = none):', '0') || '0')
    await api.adminAdPackageCreate({ name, priceUsd, durationDays, minBudget, placements: 'chats,rooms,profile' })
    void load()
  }

  /* ---------- serving settings (chat ad frequency, placements, CPM) ---------- */
  const [adsCfg, setAdsCfg] = useState<{ enabled: boolean; placements: string[]; chatAdFirstAfter: number; chatAdInterval: number; cpmUsd: number } | null>(null)
  const loadAdsCfg = async () => {
    try {
      const res = await api.adminSettings()
      const a = (res.settings as Record<string, Record<string, unknown>>).ads || {}
      setAdsCfg({
        enabled: a.enabled !== false,
        placements: Array.isArray(a.placements) ? (a.placements as string[]) : ['chats', 'rooms', 'profile'],
        chatAdFirstAfter: Number(a.chatAdFirstAfter ?? 10),
        chatAdInterval: Number(a.chatAdInterval ?? 20),
        cpmUsd: Number(a.cpmUsd ?? 2.5),
      })
    } catch {}
  }
  useEffect(() => {
    if (tab === 'settings') queueMicrotask(() => void loadAdsCfg())
  }, [tab])
  const saveAdsCfg = async () => {
    if (!adsCfg) return
    try {
      await api.adminSaveSettings('ads', {
        enabled: adsCfg.enabled,
        placements: adsCfg.placements,
        chatAdFirstAfter: Math.max(1, Math.floor(adsCfg.chatAdFirstAfter || 10)),
        chatAdInterval: Math.max(1, Math.floor(adsCfg.chatAdInterval || 20)),
        cpmUsd: Math.max(0.1, adsCfg.cpmUsd || 2.5),
      })
      toast.success('Ad serving settings saved')
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const STATUS_CLS: Record<string, string> = {
    active: 'bg-green-50 text-green-700',
    paused: 'bg-amber-50 text-[#B7791F]',
    pending_payment: 'bg-[#EEF2FF] text-[#4338CA]',
    payment_completed: 'bg-[#EEF2FF] text-[#4338CA]',
    pending_approval: 'bg-[#FFF7E6] text-[#B7791F]',
    approved: 'bg-green-50 text-green-700',
    rejected: 'bg-red-50 text-cred',
    completed: 'bg-cbg text-cmut',
  }

  if (loading) return <Loader2 className="mx-auto animate-spin text-cbrand" size={22} />
  return (
    <div>
      <div className="flex items-center gap-2 pb-3">
        <div className="flex gap-1.5">
          <button className={`h-9 rounded-full px-4 text-[12px] font-bold ${tab === 'campaigns' ? 'bg-cink text-white' : 'bg-csoft text-cmut'}`} onClick={() => setTab('campaigns')}>
            Campaigns
          </button>
          <button className={`h-9 rounded-full px-4 text-[12px] font-bold ${tab === 'packages' ? 'bg-cink text-white' : 'bg-csoft text-cmut'}`} onClick={() => setTab('packages')}>
            Ad packages
          </button>
          <button className={`h-9 rounded-full px-4 text-[12px] font-bold ${tab === 'settings' ? 'bg-cink text-white' : 'bg-csoft text-cmut'}`} onClick={() => setTab('settings')}>
            Serving settings
          </button>
        </div>
        <div className="flex-1" />
        {tab === 'campaigns' ? (
          <button className="flex items-center gap-1.5 rounded-full bg-cbrand px-3.5 py-2 text-[12px] font-bold text-white" onClick={() => void createHouseAd()}>
            <Plus size={14} /> New house ad
          </button>
        ) : (
          <button className="flex items-center gap-1.5 rounded-full bg-cbrand px-3.5 py-2 text-[12px] font-bold text-white" onClick={() => void createPackage()}>
            <Plus size={14} /> New package
          </button>
        )}
      </div>

      {tab === 'settings' && adsCfg && (
        <div className="space-y-3 rounded-[16px] border border-cline p-4">
          <h3 className="text-[14px] font-extrabold text-cink">Ad serving settings</h3>
          <label className="flex items-center gap-2 text-[13px] font-semibold text-cink">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[#2F5BEA]"
              checked={adsCfg.enabled}
              onChange={(e) => setAdsCfg({ ...adsCfg, enabled: e.target.checked })}
            />
            Ads enabled platform-wide
          </label>
          <div className="flex flex-wrap gap-3 text-[12.5px] text-cink">
            {['chats', 'rooms', 'profile'].map((p) => (
              <label key={p} className="flex items-center gap-1.5 font-semibold capitalize">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[#2F5BEA]"
                  checked={adsCfg.placements.includes(p)}
                  onChange={(e) =>
                    setAdsCfg({
                      ...adsCfg,
                      placements: e.target.checked ? [...adsCfg.placements, p] : adsCfg.placements.filter((x) => x !== p),
                    })
                  }
                />
                {p}
              </label>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-[11.5px] font-bold uppercase tracking-wide text-cmut">Chat ad — first ad after N messages</span>
              <input
                type="number"
                min={1}
                className="mt-1 h-10 w-full rounded-[10px] border border-cline px-3 text-[13px] outline-none focus:border-cbrand"
                value={adsCfg.chatAdFirstAfter}
                onChange={(e) => setAdsCfg({ ...adsCfg, chatAdFirstAfter: Number(e.target.value) })}
              />
            </label>
            <label className="block">
              <span className="text-[11.5px] font-bold uppercase tracking-wide text-cmut">Next ads every M messages</span>
              <input
                type="number"
                min={1}
                className="mt-1 h-10 w-full rounded-[10px] border border-cline px-3 text-[13px] outline-none focus:border-cbrand"
                value={adsCfg.chatAdInterval}
                onChange={(e) => setAdsCfg({ ...adsCfg, chatAdInterval: Number(e.target.value) })}
              />
            </label>
            <label className="block">
              <span className="text-[11.5px] font-bold uppercase tracking-wide text-cmut">Effective CPM (USD / 1000 impressions)</span>
              <input
                type="number"
                min={0.1}
                step={0.1}
                className="mt-1 h-10 w-full rounded-[10px] border border-cline px-3 text-[13px] outline-none focus:border-cbrand"
                value={adsCfg.cpmUsd}
                onChange={(e) => setAdsCfg({ ...adsCfg, cpmUsd: Number(e.target.value) })}
              />
            </label>
          </div>
          <p className="text-[11px] leading-4 text-cmut">
            Example: first ad after {adsCfg.chatAdFirstAfter} messages, then another every {adsCfg.chatAdInterval} messages. Campaigns
            with a budget stop serving automatically once they deliver (budget ÷ CPM) × 1000 impressions. Ads rotate fairly across all
            eligible advertisers.
          </p>
          <button className="h-11 w-full rounded-full bg-cbrand text-[13px] font-bold text-white" onClick={() => void saveAdsCfg()}>
            Save serving settings
          </button>
        </div>
      )}

      {tab === 'campaigns' ? (
        <div className="space-y-2">
          {ads.length === 0 && <p className="pt-4 text-[13px] text-cmut">No ads or campaigns yet</p>}
          {ads.map((a) => (
            <div key={a.id} className="rounded-[14px] border border-cline px-3.5 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-bold text-cink">
                    {a.title}
                    <span className={`ml-2 rounded-full px-2.5 py-0.5 text-[10px] font-bold capitalize ${STATUS_CLS[a.status] ?? 'bg-cbg text-cmut'}`}>
                      {a.status.replace('_', ' ')}
                    </span>
                    {a.isUserAd && <span className="ml-1.5 rounded-full bg-[#EEF2FF] px-2 py-0.5 text-[10px] font-bold text-cbrand">USER CAMPAIGN</span>}
                  </p>
                  <p className="truncate text-[11px] text-cmut">
                    {a.isUserAd && a.owner ? `${a.owner.name} (@${a.owner.username}) · ` : 'House ad · '}
                    {a.pkg ? `${a.pkg.name} — $${a.pkg.priceUsd} / ${a.pkg.durationDays}d · ` : ''}
                    {a.placements} · {a.impressions} impressions / {a.clicks} clicks
                  </p>
                  {a.rejectionReason && <p className="text-[11px] text-cred">Rejected: {a.rejectionReason}</p>}
                </div>
                {a.isUserAd && a.status === 'pending_approval' && (
                  <>
                    <button className="rounded-full bg-green-600 px-3.5 py-1.5 text-[11px] font-bold text-white" onClick={() => void act(a.id, 'approve')}>
                      Approve & activate
                    </button>
                    <button className="rounded-full bg-red-50 px-3.5 py-1.5 text-[11px] font-bold text-cred" onClick={() => void act(a.id, 'reject')}>
                      Reject
                    </button>
                  </>
                )}
                {a.status === 'active' && (
                  <>
                    <button className="rounded-full bg-cbg px-3 py-1.5 text-[11px] font-bold text-cmut" onClick={() => void act(a.id, 'pause')}>
                      Pause
                    </button>
                    <button className="rounded-full bg-cbg px-3 py-1.5 text-[11px] font-bold text-cmut" onClick={() => void act(a.id, 'complete')}>
                      Complete
                    </button>
                  </>
                )}
                {['paused', 'approved'].includes(a.status) && (
                  <button className="rounded-full bg-green-600 px-3.5 py-1.5 text-[11px] font-bold text-white" onClick={() => void act(a.id, 'activate')}>
                    Activate
                  </button>
                )}
                {!a.isUserAd && (
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
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {packages.length === 0 && <p className="pt-4 text-[13px] text-cmut">No packages — user campaigns cannot be created until one exists</p>}
          {packages.map((p) => (
            <div key={p.id} className={`flex flex-wrap items-center gap-3 rounded-[14px] border border-cline px-3.5 py-2.5 ${p.active ? '' : 'opacity-45'}`}>
              <Banknote size={17} className="text-cbrand" />
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-bold text-cink">{p.name} — ${p.priceUsd.toFixed(2)} / {p.durationDays} days</p>
                <p className="text-[11px] text-cmut">{p.description} · placements: {p.placements}{p.minBudget > 0 ? ` · min budget $${p.minBudget}` : ''}</p>
              </div>
              <button
                className="rounded-full bg-cbg px-3 py-1.5 text-[11px] font-bold text-cmut"
                onClick={async () => {
                  await api.adminAdPackageUpdate(p.id, { active: !p.active })
                  void load()
                }}
              >
                {p.active ? 'Disable' : 'Enable'}
              </button>
              <button
                className="rounded-full bg-red-50 px-3 py-1.5 text-[11px] font-bold text-cred"
                onClick={async () => {
                  if (!confirm(`Delete package ${p.name}?`)) return
                  await api.adminAdPackageDelete(p.id)
                  void load()
                }}
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
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
  // ---- delivery history ----
  const [history, setHistory] = useState<BroadcastRow[]>([])

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
    try {
      const h = await api.adminBroadcasts()
      setHistory(h.broadcasts)
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
      setMsg(
        `Delivered to ${res.delivered}/${res.total} users as "${res.senderName}"${res.failed > 0 ? ` — ${res.failed} failed (retry below)` : ''}`
      )
      setTitle('')
      setBody('')
      toast.success(`Broadcast delivered to ${res.delivered}/${res.total} users`)
      void load()
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

      {/* ---------- delivery records ---------- */}
      <div className="rounded-[16px] border border-cline p-4">
        <h3 className="text-[15px] font-extrabold text-cink">Broadcast delivery records</h3>
        <p className="pb-3 pt-1 text-[12px] text-cmut">
          Every recipient is tracked individually — duplicates are impossible (one delivery per user per broadcast) and
          failed sends can be retried.
        </p>
        {history.length === 0 ? (
          <p className="py-4 text-center text-[12.5px] text-cmut">No broadcasts sent yet</p>
        ) : (
          <div className="space-y-2">
            {history.map((b) => (
              <div key={b.id} className="rounded-[12px] bg-cbg px-3.5 py-2.5">
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-bold text-cink">{b.title}</p>
                    <p className="text-[11px] text-cmut">
                      from {b.sender.isOfficial ? `${b.sender.name} (Official)` : b.sender.name} ·{' '}
                      {new Date(b.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <span className="rounded-full bg-green-50 px-2.5 py-1 text-[10.5px] font-bold text-green-700">
                    {b.deliveredCount}/{b.totalTargets} delivered
                  </span>
                  {b.failedCount > 0 && (
                    <button
                      className="rounded-full bg-amber-100 px-3 py-1.5 text-[10.5px] font-bold text-[#B7791F]"
                      onClick={async () => {
                        try {
                          const res = await api.adminBroadcastRetry(b.id)
                          toast.success(`Retry complete — ${res.fixed} recovered, ${res.failedCount} still failed`)
                          void load()
                        } catch (e) {
                          toast.error((e as Error).message)
                        }
                      }}
                    >
                      {b.failedCount} failed — retry
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
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
      setConfigured(Boolean(complete))
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
            className="h-11 min-w-0 flex-1 rounded-[12px] bg-[#F0F3FA] px-4 text-[14px] outline-none placeholder:text-[#8a94a8]"
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
