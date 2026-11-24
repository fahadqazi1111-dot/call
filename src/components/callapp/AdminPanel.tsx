'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  X, Users, Gift, Banknote, ShieldAlert, Bot, Megaphone, Image as ImageIcon,
  Loader2, Ban, DollarSign, Radio, Clapperboard, Trash2, Plus, Mail, Send,
  LogOut, LayoutDashboard, UserPlus, ShieldCheck, KeyRound, Smartphone,
  Landmark, FlaskConical, TrendingUp, Percent, ReceiptText, Wallet, Check, Flag, PhoneCall, Sparkles,
  MessageSquare, Coins, Bell, Settings,
} from 'lucide-react'
import { api } from '@/lib/callapp/api'
import { useApp } from '@/lib/callapp/store'
import { AI_PROVIDERS, type AiProviderMeta } from '@/lib/callapp/aiProvidersShared'
import { StaffTick } from './StaffTick'
import { ConfirmDialog, InputDialog, FormDialog } from './admin/AdminDialogs'
import type { AdminPaymentRow, AdminReportRow, AdminWithdrawalRow, BroadcastRow, CoinPack, CoinSettings, FinanceSummary, GiftItem } from '@/lib/callapp/types'

type Section = 'overview' | 'users' | 'team' | 'gifts' | 'coins' | 'finance' | 'withdrawals' | 'moderation' | 'ai' | 'ads' | 'calls' | 'app' | 'broadcast' | 'smtp' | 'auth' | 'push'

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
      { id: 'coins', label: 'Coin system', Icon: Coins, adminOnly: false },
      { id: 'withdrawals', label: 'Withdrawals', Icon: Landmark, adminOnly: false },
      { id: 'moderation', label: 'Moderation', Icon: Radio, adminOnly: false },
      { id: 'ai', label: 'CALL AI', Icon: Bot, adminOnly: false },
      { id: 'calls', label: 'Calls & Conference', Icon: PhoneCall, adminOnly: true },
      { id: 'app', label: 'App experience', Icon: Sparkles, adminOnly: true },
      { id: 'ads', label: 'Ads', Icon: ImageIcon, adminOnly: false },
      { id: 'broadcast', label: 'Messages', Icon: Megaphone, adminOnly: true },
      { id: 'push', label: 'Push', Icon: Bell, adminOnly: true },
      { id: 'auth', label: 'Authentication', Icon: ShieldCheck, adminOnly: true },
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
          {section === 'coins' && <CoinsSection />}
          {section === 'finance' && <FinanceSection />}
          {section === 'withdrawals' && <WithdrawalsSection />}
          {section === 'moderation' && <ModerationSection />}
          {section === 'ai' && <AiSection />}
          {section === 'calls' && isAdmin && <CallsSection />}
          {section === 'app' && isAdmin && <AppSection />}
          {section === 'ads' && <AdsSection />}
          {section === 'broadcast' && isAdmin && <BroadcastSection />}
          {section === 'push' && isAdmin && <PushSection />}
          {section === 'auth' && isAdmin && <AuthSection />}
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
  const [users, setUsers] = useState<Array<{ id: string; name: string; username: string; phone: string; email: string | null; emailVerified: boolean; phoneVerified: boolean; role: string; blocked: boolean; available: number; reserved: number; totalEarned: number; totalWithdrawn: number; coins: number }>>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)

  // ---- adjust-balance modal (replaces two sequential prompt() calls) ----
  const [balanceOpen, setBalanceOpen] = useState(false)
  const [balanceBusy, setBalanceBusy] = useState(false)
  const [balanceUser, setBalanceUser] = useState<{ id: string; name: string } | null>(null)
  // ---- adjust-coins modal (InputDialog → /api/admin/coins/adjust) ----
  const [coinUser, setCoinUser] = useState<{ id: string; name: string; coins: number } | null>(null)
  const [coinBusy, setCoinBusy] = useState(false)
  // ---- create-user modal ----
  const [createOpen, setCreateOpen] = useState(false)
  const [createBusy, setCreateBusy] = useState(false)

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
    setBalanceUser(u)
    setBalanceOpen(true)
  }

  const submitBalance = async (values: Record<string, string>) => {
    if (!balanceUser) return
    const amount = Number(values.amount)
    if (!amount || isNaN(amount)) {
      toast.error('Invalid amount')
      return
    }
    const note = (values.note || '').trim() || 'Admin adjustment'
    setBalanceBusy(true)
    try {
      await api.adminUserAction(balanceUser.id, 'adjust_balance', amount, note)
      await load(q)
      toast.success(`Balance updated for ${balanceUser.name}`)
      setBalanceOpen(false)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBalanceBusy(false)
    }
  }

  const submitCreate = async (values: Record<string, string>) => {
    setCreateBusy(true)
    try {
      const role = (values.role || 'user') as 'user' | 'team' | 'admin'
      await api.adminUserCreate({
        name: values.name.trim(),
        username: values.username?.trim() || undefined,
        phone: values.phone.trim(),
        email: values.email?.trim() || undefined,
        password: values.password,
        role,
      })
      toast.success('User created')
      setCreateOpen(false)
      await load(q)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setCreateBusy(false)
    }
  }

  const adjustCoins = (u: { id: string; name: string; coins: number }) => {
    setCoinUser(u)
  }

  const submitCoinAdjust = async (amountStr: string) => {
    if (!coinUser) return
    const amount = Number(amountStr)
    if (!amount || isNaN(amount)) {
      toast.error('Invalid amount')
      return
    }
    setCoinBusy(true)
    try {
      await api.adminCoinAdjust({
        userId: coinUser.id,
        amount,
        note: `Admin adjustment by ${me?.name ?? 'admin'}`,
      })
      await load(q)
      toast.success(`Coins updated for ${coinUser.name}`)
      setCoinUser(null)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setCoinBusy(false)
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2 pb-3">
        <h3 className="flex-1 text-[15px] font-extrabold text-cink">Users</h3>
        {isAdmin && (
          <button
            className="flex items-center gap-1.5 rounded-full bg-cbrand px-3.5 py-2 text-[12px] font-bold text-white"
            onClick={() => setCreateOpen(true)}
          >
            <Plus size={14} /> Create user
          </button>
        )}
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
              <p className="mt-0.5 flex items-center gap-2 text-[10.5px] text-cmut">
                <span className="inline-flex items-center gap-0.5">
                  {u.emailVerified ? (
                    <span className="inline-flex items-center gap-0.5 text-[#067647]"><Check size={11} /> Email</span>
                  ) : u.email ? (
                    <span className="inline-flex items-center gap-0.5 text-cred"><Flag size={10} /> Email</span>
                  ) : (
                    <span className="text-[#9AA8C7]">No email</span>
                  )}
                </span>
                <span className="inline-flex items-center gap-0.5">
                  {u.phoneVerified ? (
                    <span className="inline-flex items-center gap-0.5 text-[#067647]"><Check size={11} /> Phone</span>
                  ) : (
                    <span className="inline-flex items-center gap-0.5 text-cred"><Flag size={10} /> Phone</span>
                  )}
                </span>
              </p>
            </div>
            <div className="rounded-[12px] bg-cbg px-3 py-1.5 text-right">
              <p className="text-[12.5px] font-extrabold text-cink">${u.available.toFixed(2)}</p>
              <p className="text-[9.5px] text-cmut">available{u.reserved > 0 ? ` · $${u.reserved.toFixed(2)} reserved` : ''}</p>
            </div>
            <div className="rounded-[12px] bg-amber-50/60 px-3 py-1.5 text-right">
              <p className="text-[12.5px] font-extrabold text-[#B7791F]">🪙 {u.coins.toLocaleString()}</p>
              <p className="text-[9.5px] text-cmut">coins</p>
            </div>
            {isAdmin && (
              <button className="rounded-full bg-csoft px-3 py-1.5 text-[11px] font-bold text-cbrand" onClick={() => adjustBalance(u)}>
                <DollarSign size={12} className="mr-1 inline" /> Adjust
              </button>
            )}
            {isAdmin && (
              <button className="rounded-full bg-amber-50 px-3 py-1.5 text-[11px] font-bold text-[#B7791F]" onClick={() => adjustCoins(u)}>
                <Coins size={12} className="mr-1 inline" /> Coins
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

      {/* adjust balance — FormDialog with amount + note (replaces 2 prompts) */}
      <FormDialog
        open={balanceOpen}
        onOpenChange={(o) => { setBalanceOpen(o); if (!o) setBalanceUser(null) }}
        title={`Adjust balance${balanceUser ? ` — ${balanceUser.name}` : ''}`}
        description="Positive = credit, negative = debit (USD). The note is recorded in the ledger."
        fields={[
          { key: 'amount', label: 'Amount (USD)', placeholder: '10', defaultValue: '10', type: 'number' as const, required: true },
          { key: 'note', label: 'Reason / note', placeholder: 'Support adjustment', defaultValue: 'Support adjustment' },
        ]}
        confirmLabel="Apply adjustment"
        loading={balanceBusy}
        onConfirm={(v) => void submitBalance(v)}
      />

      {/* adjust coins — InputDialog (positive = credit, negative = debit) → /api/admin/coins/adjust */}
      <InputDialog
        open={!!coinUser}
        onOpenChange={(o) => { if (!o) setCoinUser(null) }}
        title={coinUser ? `Adjust coins — ${coinUser.name}` : 'Adjust coins'}
        description={coinUser ? `Current balance: 🪙 ${coinUser.coins.toLocaleString()}. Positive = credit, negative = debit. The change is recorded in the coin ledger.` : undefined}
        label="Amount in coins (e.g. 100 or -50)"
        placeholder="100"
        defaultValue=""
        confirmLabel="Apply adjustment"
        loading={coinBusy}
        validate={(v) => {
          const n = Number(v)
          if (!v.trim() || isNaN(n) || n === 0) return 'Enter a non-zero number'
          if (!Number.isInteger(n)) return 'Amount must be a whole number'
          if (Math.abs(n) > 10_000_000) return 'Amount out of range'
          return null
        }}
        onConfirm={(v) => void submitCoinAdjust(v)}
      />

      {/* create user — FormDialog with name, username, phone, email, password, role */}
      <FormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Create user"
        description="Provision a new account manually — no OTP required. A wallet is created automatically."
        fields={[
          { key: 'name', label: 'Full name', placeholder: 'Jane Doe', required: true },
          { key: 'username', label: 'Username (optional, auto-generated if blank)', placeholder: 'janedoe' },
          { key: 'phone', label: 'Phone number', placeholder: '14155550123', required: true },
          { key: 'email', label: 'Email (optional)', placeholder: 'jane@example.com', type: 'text' as const },
          { key: 'password', label: 'Password (min 8 characters)', placeholder: '••••••••', required: true },
          { key: 'role', label: 'Role', defaultValue: 'user' },
        ]}
        confirmLabel="Create user"
        loading={createBusy}
        onConfirm={(v) => void submitCreate(v)}
      />
    </div>
  )
}

function GiftsSection() {
  const [gifts, setGifts] = useState<GiftItem[]>([])
  const [loading, setLoading] = useState(true)

  // ---- create-gift modal (replaces 3 prompts) ----
  const [createOpen, setCreateOpen] = useState(false)
  const [createBusy, setCreateBusy] = useState(false)
  // ---- edit-price modal (now FormDialog with both USD + coin prices) ----
  const [editing, setEditing] = useState<GiftItem | null>(null)
  const [priceBusy, setPriceBusy] = useState(false)
  // ---- delete-gift confirm (replaces confirm()) ----
  const [deleting, setDeleting] = useState<GiftItem | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

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

  const submitCreate = async (values: Record<string, string>) => {
    const name = (values.name || '').trim()
    if (!name) {
      toast.error('Gift name is required')
      return
    }
    const emoji = (values.emoji || '').trim() || '🎁'
    const priceUsd = Number(values.priceUsd)
    if (!priceUsd || priceUsd <= 0) {
      toast.error('Invalid USD price')
      return
    }
    // Coins are optional — when the admin leaves the field blank we default
    // to the standard $1 = 100 coins conversion so the gift is immediately
    // purchasable with coins. Setting 0 means "coin payment disabled".
    const rawCoins = (values.priceCoins || '').trim()
    const priceCoins =
      rawCoins === '' ? Math.round(priceUsd * 100) : Math.max(0, Math.floor(Number(rawCoins) || 0))
    setCreateBusy(true)
    try {
      await api.adminGiftCreate({ name, emoji, priceUsd, priceCoins, category: 'both' })
      toast.success('Gift created')
      setCreateOpen(false)
      await load()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setCreateBusy(false)
    }
  }

  const submitPrice = async (values: Record<string, string>) => {
    if (!editing) return
    const priceUsd = Number(values.priceUsd)
    if (!priceUsd || priceUsd <= 0) {
      toast.error('Invalid USD price')
      return
    }
    const priceCoins = Math.max(0, Math.floor(Number(values.priceCoins) || 0))
    setPriceBusy(true)
    try {
      await api.adminGiftUpdate(editing.id, { priceUsd, priceCoins })
      toast.success(`Prices updated for ${editing.name}`)
      setEditing(null)
      await load()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setPriceBusy(false)
    }
  }

  const toggle = async (g: GiftItem) => {
    await api.adminGiftUpdate(g.id, { active: !g.active })
    queueMicrotask(() => void load())
  }

  const submitDelete = async () => {
    if (!deleting) return
    setDeleteBusy(true)
    try {
      await api.adminGiftDelete(deleting.id)
      toast.success(`Deleted ${deleting.name}`)
      setDeleting(null)
      await load()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setDeleteBusy(false)
    }
  }

  if (loading) return <Loader2 className="mx-auto animate-spin text-cbrand" size={22} />
  return (
    <div>
      <div className="flex items-center gap-2 pb-2">
        <h3 className="flex-1 text-[15px] font-extrabold text-cink">Gifts & pricing (USD + coins)</h3>
        <button className="flex items-center gap-1.5 rounded-full bg-cbrand px-3.5 py-2 text-[12px] font-bold text-white" onClick={() => setCreateOpen(true)}>
          <Plus size={14} /> New gift
        </button>
      </div>
      <p className="pb-3 text-[12px] text-cmut">
        Every gift has a real-money price AND an optional coin price. Buyers can pay with USD (card)
        or with coins earned via purchases / conversions. Leave the coin price at 0 to disable coin
        payment for that gift.
      </p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {gifts.map((g) => (
          <div key={g.id} className={`rounded-[16px] border border-cline p-3.5 text-center ${g.active ? '' : 'opacity-45'}`}>
            <p className="text-[30px]">{g.emoji}</p>
            <p className="text-[13px] font-bold text-cink">{g.name}</p>
            <p className="text-[13px] font-extrabold text-[#D6336C]">
              ${g.priceUsd.toFixed(2)}
              <span className="mx-1 text-cmut">/</span>
              <span className="text-cbrand">🪙 {g.priceCoins ?? 0}</span>
            </p>
            <p className="text-[10px] text-cmut">{g.category}</p>
            <div className="flex justify-center gap-1.5 pt-2">
              <button className="rounded-full bg-csoft px-2.5 py-1 text-[10px] font-bold text-cbrand" onClick={() => setEditing(g)}>
                Price
              </button>
              <button className="rounded-full bg-cbg px-2.5 py-1 text-[10px] font-bold text-cmut" onClick={() => void toggle(g)}>
                {g.active ? 'Disable' : 'Enable'}
              </button>
              <button className="rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-bold text-cred" onClick={() => setDeleting(g)}>
                <Trash2 size={11} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* create gift — FormDialog with name, emoji, priceUsd, priceCoins */}
      <FormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="New gift"
        description="Set the gift name, emoji and prices. Leave coin price blank to auto-derive from USD ($1 = 100 coins); set 0 to disable coin payment."
        fields={[
          { key: 'name', label: 'Gift name', placeholder: 'Super Sticker', required: true },
          { key: 'emoji', label: 'Emoji', placeholder: '🎁', defaultValue: '🎁' },
          { key: 'priceUsd', label: 'Price in USD (real money)', placeholder: '0.60', defaultValue: '1', type: 'number' as const, required: true },
          { key: 'priceCoins', label: 'Coin price (blank = auto, 0 = disabled)', placeholder: '100', type: 'number' as const },
        ]}
        confirmLabel="Create gift"
        loading={createBusy}
        onConfirm={(v) => void submitCreate(v)}
      />

      {/* edit prices — FormDialog with both USD and coin prices */}
      <FormDialog
        open={!!editing}
        onOpenChange={(o) => { if (!o) setEditing(null) }}
        title={editing ? `Edit prices — ${editing.name}` : 'Edit prices'}
        description={editing ? `Current: $${editing.priceUsd.toFixed(2)} / 🪙 ${editing.priceCoins ?? 0}. Set coin price to 0 to disable coin payment.` : undefined}
        fields={[
          { key: 'priceUsd', label: 'Price in USD', placeholder: '0.60', defaultValue: editing ? String(editing.priceUsd) : '', type: 'number' as const, required: true },
          { key: 'priceCoins', label: 'Coin price (0 = disabled)', placeholder: '100', defaultValue: editing ? String(editing.priceCoins ?? 0) : '0', type: 'number' as const, required: true },
        ]}
        confirmLabel="Update prices"
        loading={priceBusy}
        onConfirm={(v) => void submitPrice(v)}
      />

      {/* delete confirm — ConfirmDialog (replaces confirm) */}
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => { if (!o) setDeleting(null) }}
        title={deleting ? `Delete ${deleting.name}?` : 'Delete gift?'}
        description="This permanently removes the gift. Existing gift transactions are preserved in the ledger."
        confirmLabel="Delete"
        cancelLabel="Keep"
        variant="destructive"
        loading={deleteBusy}
        onConfirm={() => void submitDelete()}
      />
    </div>
  )
}

/* ================= Coin system ================= */

const COIN_SETTINGS_DEFAULT: CoinSettings = {
  coinsPerUsd: 100,
  convertBonusPercent: 10,
  coinsEnabled: true,
  coinPacks: [
    { id: 'pack_starter', coins: 100, priceUsd: 0.99, bonus: 0, label: 'Starter' },
    { id: 'pack_popular', coins: 550, priceUsd: 4.99, bonus: 50, label: 'Popular', popular: true },
    { id: 'pack_pro', coins: 1200, priceUsd: 9.99, bonus: 200, label: 'Pro' },
    { id: 'pack_whale', coins: 3000, priceUsd: 24.99, bonus: 500, label: 'Whale' },
  ],
}

function CoinsSection() {
  const [settings, setSettings] = useState<CoinSettings | null>(null)
  const [savingSettings, setSavingSettings] = useState(false)
  const [savingPacks, setSavingPacks] = useState(false)
  // ---- pack editor (add / edit share the same FormDialog) ----
  const [editingPack, setEditingPack] = useState<{ pack: CoinPack | null; open: boolean }>({ pack: null, open: false })
  const [packBusy, setPackBusy] = useState(false)
  // ---- pack delete confirm ----
  const [deletingPack, setDeletingPack] = useState<CoinPack | null>(null)
  const [deletePackBusy, setDeletePackBusy] = useState(false)

  useEffect(() => {
    void (async () => {
      try {
        const res = await api.adminSettings()
        const s = (res.settings.coins ?? null) as CoinSettings | null
        // Merge with defaults so newly-enabled fields are always present.
        setSettings({
          coinsPerUsd: Number(s?.coinsPerUsd) || COIN_SETTINGS_DEFAULT.coinsPerUsd,
          convertBonusPercent: Number(s?.convertBonusPercent) || COIN_SETTINGS_DEFAULT.convertBonusPercent,
          coinsEnabled: s?.coinsEnabled !== false,
          coinPacks: Array.isArray(s?.coinPacks) && s!.coinPacks.length > 0 ? s!.coinPacks : COIN_SETTINGS_DEFAULT.coinPacks,
        })
      } catch {
        setSettings({ ...COIN_SETTINGS_DEFAULT })
      }
    })()
  }, [])

  if (!settings) return <Loader2 className="mx-auto animate-spin text-cbrand" size={22} />

  const setS = <K extends keyof CoinSettings>(k: K, v: CoinSettings[K]) =>
    setSettings({ ...settings, [k]: v })

  const saveSettings = async () => {
    setSavingSettings(true)
    try {
      await api.adminSaveSettings('coins', {
        coinsEnabled: settings.coinsEnabled,
        coinsPerUsd: Number(settings.coinsPerUsd) || 100,
        convertBonusPercent: Number(settings.convertBonusPercent) || 0,
        // packs are saved separately, but we still echo them so the merge stays correct
        coinPacks: settings.coinPacks,
      })
      toast.success('Coin settings saved')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSavingSettings(false)
    }
  }

  const savePacks = async (next: CoinPack[]) => {
    setSavingPacks(true)
    try {
      await api.adminSaveSettings('coins', {
        coinsEnabled: settings.coinsEnabled,
        coinsPerUsd: settings.coinsPerUsd,
        convertBonusPercent: settings.convertBonusPercent,
        coinPacks: next,
      })
      setSettings({ ...settings, coinPacks: next })
      toast.success('Coin packs saved')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSavingPacks(false)
    }
  }

  const submitPack = async (values: Record<string, string>) => {
    const label = (values.label || '').trim()
    if (!label) {
      toast.error('Label is required')
      return
    }
    const coins = Math.max(1, Math.floor(Number(values.coins) || 0))
    const priceUsd = Math.max(0.1, Number(values.priceUsd) || 0.1)
    const bonus = Math.max(0, Math.floor(Number(values.bonus) || 0))
    const popular = values.popular === 'true'

    const existing = editingPack.pack
    let next: CoinPack[]
    if (existing) {
      next = settings.coinPacks.map((p) => (p.id === existing.id ? { ...p, label, coins, priceUsd, bonus, popular } : p))
    } else {
      // unique-ish id so we can reference the pack again later
      const id = `pack_${label.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 24)}_${Date.now().toString(36).slice(-4)}`
      next = [...settings.coinPacks, { id, label, coins, priceUsd, bonus, popular }]
    }
    setPackBusy(true)
    try {
      await savePacks(next)
      setEditingPack({ pack: null, open: false })
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setPackBusy(false)
    }
  }

  const submitDeletePack = async () => {
    if (!deletingPack) return
    setDeletePackBusy(true)
    try {
      const next = settings.coinPacks.filter((p) => p.id !== deletingPack.id)
      await savePacks(next)
      setDeletingPack(null)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setDeletePackBusy(false)
    }
  }

  return (
    <div className="max-w-3xl">
      <h3 className="text-[15px] font-extrabold text-cink">Coin system</h3>
      <p className="pb-4 pt-1 text-[12px] leading-5 text-cmut">
        Coins are CALL&apos;s virtual currency. Users buy them with USD (coin packs) or convert them
        from gift earnings, and spend them on gifts. Coins are NOT withdrawable — only real USD
        earnings are. Disable the system here to hide the coin UI app-wide (existing balances are
        preserved).
      </p>

      {/* ---- Coin settings card ---- */}
      <div className="rounded-[16px] border border-cline bg-white p-4">
        <h4 className="text-[13.5px] font-extrabold text-cink">Coin settings</h4>
        <p className="pb-3 pt-1 text-[11.5px] text-cmut">
          Changing the conversion rate only affects future purchases / conversions — existing coin
          balances are not retroactively recalculated.
        </p>

        <AuthToggle
          label="Enable coin system"
          hint="When off, the coin wallet, coin store and coin payments are hidden app-wide."
          checked={settings.coinsEnabled}
          onChange={(v) => setS('coinsEnabled', v)}
        />

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-[12.5px] font-semibold text-[#4A5568]">Coins per USD</span>
            <input
              type="number"
              min={1}
              className="h-11 w-full rounded-[12px] bg-[#F0F3FA] px-4 text-[14px] font-medium outline-none"
              value={settings.coinsPerUsd}
              onChange={(e) => setS('coinsPerUsd', Math.max(1, Math.floor(Number(e.target.value) || 0)))}
            />
            <span className="mt-1 block text-[11px] text-cmut">
              100 = $1 buys 100 coins. Higher = cheaper coins for users.
            </span>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[12.5px] font-semibold text-[#4A5568]">Conversion bonus %</span>
            <input
              type="number"
              min={0}
              max={1000}
              className="h-11 w-full rounded-[12px] bg-[#F0F3FA] px-4 text-[14px] font-medium outline-none"
              value={settings.convertBonusPercent}
              onChange={(e) => setS('convertBonusPercent', Math.max(0, Math.floor(Number(e.target.value) || 0)))}
            />
            <span className="mt-1 block text-[11px] text-cmut">
              10 = converting $1 of earnings gives 110 coins (10% bonus). Encourages retention over withdrawals.
            </span>
          </label>
        </div>

        <button
          className="mt-3 h-11 rounded-[14px] bg-brand-grad px-6 text-[13.5px] font-bold text-white disabled:opacity-50"
          disabled={savingSettings}
          onClick={() => void saveSettings()}
        >
          {savingSettings ? <Loader2 className="mx-auto animate-spin" size={17} /> : 'Save settings'}
        </button>
      </div>

      {/* ---- Coin packs manager ---- */}
      <div className="mt-4 rounded-[16px] border border-cline bg-white p-4">
        <div className="flex items-center gap-2">
          <h4 className="flex-1 text-[13.5px] font-extrabold text-cink">Coin packs</h4>
          <button
            className="flex items-center gap-1.5 rounded-full bg-cbrand px-3.5 py-2 text-[12px] font-bold text-white"
            onClick={() => setEditingPack({ pack: null, open: true })}
          >
            <Plus size={14} /> Add pack
          </button>
        </div>
        <p className="pb-3 pt-1 text-[11.5px] text-cmut">
          Packs are the buyable options in the Coin Store. The popular flag highlights one pack as
          &quot;best value&quot;. Bonus coins are added on top of the base amount.
        </p>

        <div className="space-y-2">
          {settings.coinPacks.length === 0 && (
            <p className="rounded-[12px] bg-cbg px-3 py-3 text-center text-[12.5px] text-cmut">
              No coin packs yet. Add one to open the Coin Store.
            </p>
          )}
          {settings.coinPacks.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-[14px] border border-cline px-3.5 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-[14px] font-bold text-cink">
                  {p.label}
                  {p.popular && (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[9.5px] font-bold text-[#B7791F]">
                      POPULAR
                    </span>
                  )}
                </p>
                <p className="text-[11px] text-cmut">
                  🪙 {p.coins.toLocaleString()} coins + {p.bonus.toLocaleString()} bonus
                </p>
              </div>
              <div className="rounded-[12px] bg-cbg px-3 py-1.5 text-right">
                <p className="text-[12.5px] font-extrabold text-[#D6336C]">${p.priceUsd.toFixed(2)}</p>
                <p className="text-[9.5px] text-cmut">
                  {p.priceUsd > 0 ? `${Math.round((p.coins + p.bonus) / p.priceUsd)} coins/$` : '—'}
                </p>
              </div>
              <button
                className="rounded-full bg-csoft px-3 py-1.5 text-[11px] font-bold text-cbrand"
                onClick={() => setEditingPack({ pack: p, open: true })}
              >
                Edit
              </button>
              <button
                className="rounded-full bg-red-50 px-3 py-1.5 text-[11px] font-bold text-cred"
                onClick={() => setDeletingPack(p)}
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ---- pack add / edit FormDialog ---- */}
      <FormDialog
        open={editingPack.open}
        onOpenChange={(o) => { if (!o) setEditingPack({ pack: null, open: false }) }}
        title={editingPack.pack ? `Edit pack — ${editingPack.pack.label}` : 'Add coin pack'}
        description="Coins are sold as packs. The popular flag highlights one pack as best value in the store."
        fields={[
          { key: 'label', label: 'Pack label', placeholder: 'Starter', defaultValue: editingPack.pack?.label ?? '', required: true },
          { key: 'coins', label: 'Coins (base amount)', placeholder: '100', defaultValue: editingPack.pack ? String(editingPack.pack.coins) : '100', type: 'number' as const, required: true },
          { key: 'priceUsd', label: 'Price in USD', placeholder: '0.99', defaultValue: editingPack.pack ? String(editingPack.pack.priceUsd) : '0.99', type: 'number' as const, required: true },
          { key: 'bonus', label: 'Bonus coins (added on top)', placeholder: '0', defaultValue: editingPack.pack ? String(editingPack.pack.bonus) : '0', type: 'number' as const, required: true },
          { key: 'popular', label: 'Mark as popular (best value)', type: 'checkbox' as const, defaultValue: editingPack.pack?.popular ? 'true' : 'false', hint: 'Only one pack should usually be popular — the store highlights it.' },
        ]}
        confirmLabel={editingPack.pack ? 'Save pack' : 'Add pack'}
        loading={packBusy || savingPacks}
        onConfirm={(v) => void submitPack(v)}
      />

      {/* ---- pack delete confirm ---- */}
      <ConfirmDialog
        open={!!deletingPack}
        onOpenChange={(o) => { if (!o) setDeletingPack(null) }}
        title={deletingPack ? `Delete ${deletingPack.label}?` : 'Delete pack?'}
        description="Removes the pack from the Coin Store. Existing coin purchases already made with this pack are preserved in the ledger."
        confirmLabel="Delete"
        cancelLabel="Keep"
        variant="destructive"
        loading={deletePackBusy || savingPacks}
        onConfirm={() => void submitDeletePack()}
      />
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
  // ---- reject modal (replaces prompt) ----
  const [rejecting, setRejecting] = useState<AdminWithdrawalRow | null>(null)
  const [rejectBusy, setRejectBusy] = useState(false)
  // ---- mark-paid modal (replaces prompt) ----
  const [paying, setPaying] = useState<AdminWithdrawalRow | null>(null)
  const [payBusy, setPayBusy] = useState(false)

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

  // Direct actions that don't need a prompt (under_review / approve).
  const act = async (w: AdminWithdrawalRow, action: 'under_review' | 'approve') => {
    try {
      await api.adminWithdrawalReview(w.id, action)
      toast.success(`Marked ${action.replace('_', ' ')}`)
      void load()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const submitReject = async (note: string) => {
    if (!rejecting) return
    setRejectBusy(true)
    try {
      await api.adminWithdrawalReview(rejecting.id, 'reject', note.trim() || 'Rejected by admin')
      toast.success('Withdrawal rejected — funds released')
      setRejecting(null)
      void load()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setRejectBusy(false)
    }
  }

  const submitPaid = async (ref: string) => {
    if (!paying) return
    if (!ref.trim()) {
      toast.error('Transfer reference is required')
      return
    }
    setPayBusy(true)
    try {
      await api.adminWithdrawalReview(paying.id, 'paid', undefined, ref.trim())
      toast.success('Marked paid')
      setPaying(null)
      void load()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setPayBusy(false)
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
                <button className="rounded-full bg-brand-grad px-3.5 py-1.5 text-[11px] font-bold text-white" onClick={() => setPaying(w)}>
                  Mark paid
                </button>
              )}
              {!['paid', 'rejected'].includes(w.status) && (
                <button className="rounded-full bg-red-50 px-3.5 py-1.5 text-[11px] font-bold text-cred" onClick={() => setRejecting(w)}>
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

      {/* reject withdrawal — InputDialog (replaces prompt) */}
      <InputDialog
        open={!!rejecting}
        onOpenChange={(o) => { if (!o) setRejecting(null) }}
        title={rejecting ? `Reject withdrawal — ${rejecting.user.name}` : 'Reject withdrawal'}
        description={rejecting ? `$${rejecting.amount.toFixed(2)} via ${rejecting.method.toUpperCase()}. The reserved amount is released back to the creator.` : undefined}
        label="Rejection note"
        placeholder="Optional reason — shown to the creator"
        confirmLabel="Reject & release"
        variant="destructive"
        loading={rejectBusy}
        onConfirm={(v) => void submitReject(v)}
      />

      {/* mark paid — InputDialog (replaces prompt) */}
      <InputDialog
        open={!!paying}
        onOpenChange={(o) => { if (!o) setPaying(null) }}
        title={paying ? `Mark paid — ${paying.user.name}` : 'Mark paid'}
        description={paying ? `Confirm the bank transfer of $${paying.amount.toFixed(2)} was completed.` : undefined}
        label="Bank transfer reference"
        placeholder="Bank slip / transaction id"
        confirmLabel="Confirm paid"
        loading={payBusy}
        validate={(v) => (v.trim() ? null : 'Transfer reference is required')}
        onConfirm={(v) => void submitPaid(v)}
      />
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
  const activeRaw = String(cfg.activeProvider ?? '')
  const activeProvider = AI_PROVIDERS.some((p) => p.id === activeRaw) ? activeRaw : ''
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
        Active provider: <b>{activeProvider || 'not connected'}</b> · API keys are stored server-side and never exposed to users.
        When a provider is rate-limited or not connected, users see a friendly “We are Facing High Traffic” notice.
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
      toast.success('Conference settings saved')
    } catch (e) {
      toast.error((e as Error).message || 'Failed to save settings')
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

  // ---- reject ad modal (replaces prompt) ----
  const [rejectingAd, setRejectingAd] = useState<{ id: string; title: string } | null>(null)
  const [rejectAdBusy, setRejectAdBusy] = useState(false)
  // ---- create house-ad modal (replaces 3 prompts) ----
  const [houseAdOpen, setHouseAdOpen] = useState(false)
  const [houseAdBusy, setHouseAdBusy] = useState(false)
  // ---- create ad package modal (replaces 4 prompts) ----
  const [pkgOpen, setPkgOpen] = useState(false)
  const [pkgBusy, setPkgBusy] = useState(false)
  // ---- delete confirm (replaces confirm()) ----
  const [deletingAd, setDeletingAd] = useState<{ id: string; title: string } | null>(null)
  const [deletingPkg, setDeletingPkg] = useState<{ id: string; name: string } | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

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

  // Direct actions that don't need a prompt (approve / activate / pause / complete).
  const act = async (id: string, action: 'approve' | 'activate' | 'pause' | 'complete') => {
    try {
      await api.adminAdAction(id, action)
      toast.success(`Campaign ${action}d`)
      void load()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const submitRejectAd = async (reason: string) => {
    if (!rejectingAd) return
    setRejectAdBusy(true)
    try {
      await api.adminAdAction(rejectingAd.id, 'reject', reason.trim() || 'Does not meet content guidelines')
      toast.success('Campaign rejected')
      setRejectingAd(null)
      void load()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setRejectAdBusy(false)
    }
  }

  const submitHouseAd = async (values: Record<string, string>) => {
    const title = (values.title || '').trim()
    if (!title) {
      toast.error('Ad title is required')
      return
    }
    setHouseAdBusy(true)
    try {
      await api.adminAdCreate({
        title,
        body: (values.body || '').trim(),
        linkUrl: (values.linkUrl || '').trim() || undefined,
        placements: ['chats', 'rooms'],
      })
      toast.success('House ad created')
      setHouseAdOpen(false)
      void load()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setHouseAdBusy(false)
    }
  }

  const submitPackage = async (values: Record<string, string>) => {
    const name = (values.name || '').trim()
    if (!name) {
      toast.error('Package name is required')
      return
    }
    const priceUsd = Number(values.priceUsd)
    const durationDays = Number(values.durationDays)
    const minBudget = Number(values.minBudget)
    if (!priceUsd || priceUsd <= 0) {
      toast.error('Invalid price')
      return
    }
    if (!durationDays || durationDays <= 0) {
      toast.error('Invalid duration')
      return
    }
    setPkgBusy(true)
    try {
      await api.adminAdPackageCreate({
        name,
        priceUsd,
        durationDays,
        minBudget: isNaN(minBudget) ? 0 : Math.max(0, minBudget),
        placements: 'chats,rooms,profile',
      })
      toast.success('Ad package created')
      setPkgOpen(false)
      void load()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setPkgBusy(false)
    }
  }

  const submitDelete = async () => {
    if (deletingAd) {
      setDeleteBusy(true)
      try {
        await api.adminAdDelete(deletingAd.id)
        toast.success('Ad deleted')
        setDeletingAd(null)
        void load()
      } catch (e) {
        toast.error((e as Error).message)
      } finally {
        setDeleteBusy(false)
      }
      return
    }
    if (deletingPkg) {
      setDeleteBusy(true)
      try {
        await api.adminAdPackageDelete(deletingPkg.id)
        toast.success(`Package ${deletingPkg.name} deleted`)
        setDeletingPkg(null)
        void load()
      } catch (e) {
        toast.error((e as Error).message)
      } finally {
        setDeleteBusy(false)
      }
    }
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
          <button className="flex items-center gap-1.5 rounded-full bg-cbrand px-3.5 py-2 text-[12px] font-bold text-white" onClick={() => setHouseAdOpen(true)}>
            <Plus size={14} /> New house ad
          </button>
        ) : (
          <button className="flex items-center gap-1.5 rounded-full bg-cbrand px-3.5 py-2 text-[12px] font-bold text-white" onClick={() => setPkgOpen(true)}>
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
                    <button className="rounded-full bg-red-50 px-3.5 py-1.5 text-[11px] font-bold text-cred" onClick={() => setRejectingAd({ id: a.id, title: a.title })}>
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
                    onClick={() => setDeletingAd({ id: a.id, title: a.title })}
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
                onClick={() => setDeletingPkg({ id: p.id, name: p.name })}
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* reject ad — InputDialog (replaces prompt) */}
      <InputDialog
        open={!!rejectingAd}
        onOpenChange={(o) => { if (!o) setRejectingAd(null) }}
        title={rejectingAd ? `Reject ad — ${rejectingAd.title}` : 'Reject ad'}
        description="The advertiser sees this reason. A default is used if left blank."
        label="Rejection reason"
        placeholder="Does not meet content guidelines"
        confirmLabel="Reject campaign"
        variant="destructive"
        loading={rejectAdBusy}
        onConfirm={(v) => void submitRejectAd(v)}
      />

      {/* create house-ad — FormDialog (replaces 3 prompts) */}
      <FormDialog
        open={houseAdOpen}
        onOpenChange={setHouseAdOpen}
        title="New house ad"
        description="House ads run in chat & room placements. The link URL is optional."
        fields={[
          { key: 'title', label: 'Ad title', placeholder: 'Try CALL Premium!', required: true },
          { key: 'body', label: 'Ad body', placeholder: 'Unlock unlimited calls and no ads.' },
          { key: 'linkUrl', label: 'Link URL (optional)', placeholder: 'https://example.com' },
        ]}
        confirmLabel="Create ad"
        loading={houseAdBusy}
        onConfirm={(v) => void submitHouseAd(v)}
      />

      {/* create ad package — FormDialog (replaces 4 prompts) */}
      <FormDialog
        open={pkgOpen}
        onOpenChange={setPkgOpen}
        title="New ad package"
        description="Users pick a package when buying a campaign. Placements default to chats, rooms and profile."
        fields={[
          { key: 'name', label: 'Package name', placeholder: 'Promoted Post', required: true },
          { key: 'priceUsd', label: 'Price (USD)', placeholder: '15', defaultValue: '15', type: 'number' as const, required: true },
          { key: 'durationDays', label: 'Duration (days)', placeholder: '7', defaultValue: '7', type: 'number' as const, required: true },
          { key: 'minBudget', label: 'Minimum budget USD (0 = none)', placeholder: '0', defaultValue: '0', type: 'number' as const },
        ]}
        confirmLabel="Create package"
        loading={pkgBusy}
        onConfirm={(v) => void submitPackage(v)}
      />

      {/* delete confirm — ConfirmDialog (replaces confirm()) */}
      <ConfirmDialog
        open={!!deletingAd || !!deletingPkg}
        onOpenChange={(o) => { if (!o) { setDeletingAd(null); setDeletingPkg(null) } }}
        title={deletingAd ? `Delete ad “${deletingAd.title}”?` : deletingPkg ? `Delete package “${deletingPkg.name}”?` : 'Delete?'}
        description={deletingPkg ? 'Campaigns already using this package keep running; new campaigns cannot pick it.' : 'This permanently removes the ad. Existing impression/click stats are retained.'}
        confirmLabel="Delete"
        cancelLabel="Keep"
        variant="destructive"
        loading={deleteBusy}
        onConfirm={() => void submitDelete()}
      />
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
  // ---- reset-password modal (replaces prompt) ----
  const [pwdMember, setPwdMember] = useState<StaffMember | null>(null)
  const [pwdBusy, setPwdBusy] = useState(false)

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

  const resetPassword = (m: StaffMember) => {
    setPwdMember(m)
  }

  const submitPassword = async (password: string) => {
    if (!pwdMember) return
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    setPwdBusy(true)
    try {
      await api.adminTeamUpdate(pwdMember.id, { password })
      toast.success(`Password updated for ${pwdMember.name}`)
      setPwdMember(null)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setPwdBusy(false)
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
                    onClick={() => resetPassword(m)}
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

      {/* reset password — InputDialog (replaces prompt) */}
      <InputDialog
        open={!!pwdMember}
        onOpenChange={(o) => { if (!o) setPwdMember(null) }}
        title={pwdMember ? `Reset password — ${pwdMember.name}` : 'Reset password'}
        description="Choose a new password (min 8 characters). The staff member can sign in with it immediately."
        label="New password"
        placeholder="At least 8 characters"
        confirmLabel="Update password"
        loading={pwdBusy}
        validate={(v) => (v.length >= 8 ? null : 'Password must be at least 8 characters')}
        onConfirm={(v) => void submitPassword(v)}
      />
    </div>
  )
}

/* ================= Authentication ================= */

interface AuthPolicyForm {
  requirePhoneVerification: boolean
  requireEmailVerification: boolean
  allowEmailOnlyRegistration: boolean
  allowPhoneOnlyRegistration: boolean
  googleClientId: string
}

const AUTH_POLICY_DEFAULT: AuthPolicyForm = {
  requirePhoneVerification: true,
  requireEmailVerification: true,
  allowEmailOnlyRegistration: false,
  allowPhoneOnlyRegistration: true,
  googleClientId: '',
}

interface OtpConfigForm {
  smsProvider: 'none' | 'twilio' | 'vonage'
  twilioAccountSid: string
  twilioAuthToken: string
  twilioFromNumber: string
  vonageApiKey: string
  vonageApiSecret: string
  vonageFromNumber: string
  whatsappApiKey: string
  whatsappPhoneNumberId: string
  whatsappFromNumber: string
}

const OTP_CONFIG_DEFAULT: OtpConfigForm = {
  smsProvider: 'none',
  twilioAccountSid: '',
  twilioAuthToken: '',
  twilioFromNumber: '',
  vonageApiKey: '',
  vonageApiSecret: '',
  vonageFromNumber: '',
  whatsappApiKey: '',
  whatsappPhoneNumberId: '',
  whatsappFromNumber: '',
}

function AuthSection() {
  const [policy, setPolicy] = useState<AuthPolicyForm | null>(null)
  const [otp, setOtp] = useState<OtpConfigForm | null>(null)
  const [savingPolicy, setSavingPolicy] = useState(false)
  const [savingOtp, setSavingOtp] = useState(false)

  useEffect(() => {
    void (async () => {
      try {
        const res = await api.adminSettings()
        const a = (res.settings.auth ?? {}) as Partial<AuthPolicyForm>
        const o = (res.settings.otp ?? {}) as Partial<OtpConfigForm>
        setPolicy({
          requirePhoneVerification: a.requirePhoneVerification ?? true,
          requireEmailVerification: a.requireEmailVerification ?? true,
          allowEmailOnlyRegistration: a.allowEmailOnlyRegistration ?? false,
          allowPhoneOnlyRegistration: a.allowPhoneOnlyRegistration ?? true,
          googleClientId: a.googleClientId ?? '',
        })
        setOtp({
          smsProvider: (o.smsProvider as 'none' | 'twilio' | 'vonage') || 'none',
          twilioAccountSid: o.twilioAccountSid ?? '',
          twilioAuthToken: o.twilioAuthToken ?? '',
          twilioFromNumber: o.twilioFromNumber ?? '',
          vonageApiKey: o.vonageApiKey ?? '',
          vonageApiSecret: o.vonageApiSecret ?? '',
          vonageFromNumber: o.vonageFromNumber ?? '',
          whatsappApiKey: o.whatsappApiKey ?? '',
          whatsappPhoneNumberId: o.whatsappPhoneNumberId ?? '',
          whatsappFromNumber: o.whatsappFromNumber ?? '',
        })
      } catch {
        setPolicy(AUTH_POLICY_DEFAULT)
        setOtp(OTP_CONFIG_DEFAULT)
      }
    })()
  }, [])

  if (!policy || !otp) return <Loader2 className="mx-auto animate-spin text-cbrand" size={22} />

  const setP = <K extends keyof AuthPolicyForm>(k: K, v: AuthPolicyForm[K]) =>
    setPolicy({ ...policy, [k]: v })
  const setO = <K extends keyof OtpConfigForm>(k: K, v: OtpConfigForm[K]) =>
    setOtp({ ...otp, [k]: v })

  const savePolicy = async () => {
    setSavingPolicy(true)
    try {
      await api.adminSaveSettings('auth', policy)
      toast.success('Auth policy saved')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSavingPolicy(false)
    }
  }

  const saveOtp = async () => {
    setSavingOtp(true)
    try {
      await api.adminSaveSettings('otp', otp)
      toast.success('OTP delivery settings saved')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSavingOtp(false)
    }
  }

  // Whether each provider looks fully configured (so the admin can see at a glance).
  const twilioReady = !!(otp.twilioAccountSid && otp.twilioAuthToken && otp.twilioFromNumber)
  const vonageReady = !!(otp.vonageApiKey && otp.vonageApiSecret && otp.vonageFromNumber)
  const whatsappReady = !!(otp.whatsappApiKey && otp.whatsappPhoneNumberId)
  const smsReady = otp.smsProvider === 'twilio' ? twilioReady : otp.smsProvider === 'vonage' ? vonageReady : false

  return (
    <div className="max-w-2xl">
      <h3 className="text-[15px] font-extrabold text-cink">Authentication &amp; Verification</h3>
      <p className="pb-4 pt-1 text-[12px] leading-5 text-cmut">
        Control what the sign-up form requires, and how one-time codes are delivered. CALL never fakes
        SMS — when no SMS provider is configured, codes are surfaced in the app in <b>sandbox mode</b>
        with a clear banner so the flow still works.
      </p>

      {/* ---- Verification policy ---- */}
      <div className="rounded-[16px] border border-cline p-4">
        <h4 className="text-[13.5px] font-extrabold text-cink">Registration policy</h4>
        <p className="pb-3 pt-1 text-[11.5px] text-cmut">
          Set which verifications the sign-up form requires. The server always re-checks consumed OTP
          records before creating an account — a malicious client cannot bypass these.
        </p>
        <div className="space-y-2">
          <AuthToggle
            label="Require phone verification on registration"
            hint="Send a 6-digit code by SMS / WhatsApp / sandbox."
            checked={policy.requirePhoneVerification}
            onChange={(v) => setP('requirePhoneVerification', v)}
          />
          <AuthToggle
            label="Require email verification on registration"
            hint="Send a 6-digit code by email (when an email is provided)."
            checked={policy.requireEmailVerification}
            onChange={(v) => setP('requireEmailVerification', v)}
          />
          <AuthToggle
            label="Allow phone-only registration"
            hint="Users can sign up with phone + password (no email)."
            checked={policy.allowPhoneOnlyRegistration}
            onChange={(v) => setP('allowPhoneOnlyRegistration', v)}
          />
          <AuthToggle
            label="Allow email-only registration"
            hint="Skip phone entirely (NOT recommended — phone is the primary identity on CALL)."
            checked={policy.allowEmailOnlyRegistration}
            onChange={(v) => setP('allowEmailOnlyRegistration', v)}
          />
        </div>
        <div className="mt-3">
          <AuthField
            label="Google OAuth Client ID (optional)"
            value={policy.googleClientId}
            onChange={(v) => setP('googleClientId', v)}
            placeholder="xxxxxxxx.apps.googleusercontent.com"
          />
          <p className="pt-1 text-[11px] text-cmut">
            Configure Google Identity Services to enable “Continue with Google” on the login screen.
          </p>
        </div>
        <button
          className="mt-3 h-11 rounded-[14px] bg-brand-grad px-6 text-[13.5px] font-bold text-white disabled:opacity-50"
          disabled={savingPolicy}
          onClick={() => void savePolicy()}
        >
          {savingPolicy ? <Loader2 className="mx-auto animate-spin" size={17} /> : 'Save policy'}
        </button>
      </div>

      {/* ---- Status banner: which delivery channels are live ---- */}
      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-[14px] bg-cbg p-3 text-[12px] text-cmut">
        <Smartphone size={15} className="flex-none text-cbrand" />
        <span className="flex-1">
          <b>Live channels:</b>{' '}
          <StatusPill ok={smsReady} label={`SMS (${otp.smsProvider})`} />
          <StatusPill ok={whatsappReady} label="WhatsApp" />
          <StatusPill ok={false} label="Email (SMTP — see Email/SMTP tab)" />
          {!smsReady && !whatsappReady && (
            <span className="ml-1 text-[#B7791F]">
              Phone OTP will run in sandbox mode (codes shown in-app) until you configure an SMS provider.
            </span>
          )}
        </span>
      </div>

      {/* ---- OTP delivery config ---- */}
      <div className="mt-4 rounded-[16px] border border-cline p-4">
        <h4 className="text-[13.5px] font-extrabold text-cink">OTP delivery (phone codes)</h4>
        <p className="pb-3 pt-1 text-[11.5px] text-cmut">
          Choose an SMS provider, or fall back to WhatsApp. Secrets are stored server-side only and
          never returned to the browser (the masked values you see here are placeholders).
        </p>

        <div className="mb-3">
          <span className="mb-1.5 block text-[12.5px] font-semibold text-[#4A5568]">SMS provider</span>
          <div className="grid grid-cols-3 gap-1.5 rounded-[12px] bg-[#F0F3FA] p-1.5">
            {(['none', 'twilio', 'vonage'] as const).map((p) => (
              <button
                key={p}
                className={`h-10 rounded-[10px] text-[12.5px] font-bold transition ${
                  otp.smsProvider === p ? 'bg-white text-cink shadow-sm' : 'text-cmut hover:text-cink'
                }`}
                onClick={() => setO('smsProvider', p)}
              >
                {p === 'none' ? 'None (sandbox)' : p === 'twilio' ? 'Twilio' : 'Vonage'}
              </button>
            ))}
          </div>
        </div>

        {otp.smsProvider === 'twilio' && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <AuthField label="Twilio Account SID" value={otp.twilioAccountSid} onChange={(v) => setO('twilioAccountSid', v)} placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" />
            <AuthField label="Twilio Auth Token" value={otp.twilioAuthToken} onChange={(v) => setO('twilioAuthToken', v)} placeholder="hidden" type="password" />
            <AuthField label="Twilio From Number" value={otp.twilioFromNumber} onChange={(v) => setO('twilioFromNumber', v)} placeholder="+1XXXXXXXXXX" />
            <div className="flex items-end">
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${twilioReady ? 'bg-[#EDFAF3] text-[#067647]' : 'bg-cbg text-cmut'}`}>
                {twilioReady ? 'Twilio ready' : 'Incomplete'}
              </span>
            </div>
          </div>
        )}

        {otp.smsProvider === 'vonage' && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <AuthField label="Vonage API Key" value={otp.vonageApiKey} onChange={(v) => setO('vonageApiKey', v)} placeholder="abcdef12" />
            <AuthField label="Vonage API Secret" value={otp.vonageApiSecret} onChange={(v) => setO('vonageApiSecret', v)} placeholder="hidden" type="password" />
            <AuthField label="Vonage From Name" value={otp.vonageFromNumber} onChange={(v) => setO('vonageFromNumber', v)} placeholder="CALL" />
            <div className="flex items-end">
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${vonageReady ? 'bg-[#EDFAF3] text-[#067647]' : 'bg-cbg text-cmut'}`}>
                {vonageReady ? 'Vonage ready' : 'Incomplete'}
              </span>
            </div>
          </div>
        )}

        <div className="mt-4 border-t border-cline pt-3">
          <p className="text-[12.5px] font-semibold text-[#4A5568]">WhatsApp Cloud API (Meta Business)</p>
          <p className="pb-2 pt-0.5 text-[11px] leading-5 text-cmut">
            Falls back to WhatsApp when no SMS provider is configured. Free for the first 1,000
            conversations/month; requires Meta Business verification (not auto-configured).
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <AuthField label="WhatsApp Access Token" value={otp.whatsappApiKey} onChange={(v) => setO('whatsappApiKey', v)} placeholder="EAAG…" type="password" />
            <AuthField label="WhatsApp Phone Number ID" value={otp.whatsappPhoneNumberId} onChange={(v) => setO('whatsappPhoneNumberId', v)} placeholder="103xxxxxx" />
            <AuthField label="WhatsApp From Number (display only)" value={otp.whatsappFromNumber} onChange={(v) => setO('whatsappFromNumber', v)} placeholder="+1XXXXXXXXXX" />
            <div className="flex items-end">
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${whatsappReady ? 'bg-[#EDFAF3] text-[#067647]' : 'bg-cbg text-cmut'}`}>
                {whatsappReady ? 'WhatsApp ready' : 'Incomplete'}
              </span>
            </div>
          </div>
        </div>

        <button
          className="mt-4 h-11 rounded-[14px] bg-brand-grad px-6 text-[13.5px] font-bold text-white disabled:opacity-50"
          disabled={savingOtp}
          onClick={() => void saveOtp()}
        >
          {savingOtp ? <Loader2 className="mx-auto animate-spin" size={17} /> : 'Save OTP delivery settings'}
        </button>
      </div>

      {/* ---- Honest SMS limitation notice ---- */}
      <div className="mt-4 flex items-start gap-2 rounded-2xl bg-[#FFF8EB] p-4 text-[12px] leading-5 text-[#7A5B16]">
        <MessageSquare size={15} className="mt-0.5 flex-none text-[#B45309]" />
        <div>
          <b>Why does sandbox mode exist?</b> A genuinely free, production-grade SMS OTP service does
          not exist — Twilio, Vonage and MessageBird are all paid, and carrier email-to-SMS gateways
          are unreliable and blocked by most carriers. CALL surfaces this honestly: when no provider
          is configured, codes appear in-app (development/preview only) with a yellow banner so
          testers can complete the flow. Configure an SMS provider here before going live.
        </div>
      </div>
    </div>
  )
}

function AuthToggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint?: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-start gap-2.5 rounded-[12px] bg-[#F0F3FA] px-4 py-2.5 text-[13px] text-cink">
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 flex-none accent-[#2f5bea]"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        <span className="font-semibold">{label}</span>
        {hint && <span className="mt-0.5 block text-[11.5px] text-cmut">{hint}</span>}
      </span>
    </label>
  )
}

function AuthField({
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

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`mr-1.5 inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10.5px] font-bold ${
        ok ? 'bg-[#EDFAF3] text-[#067647]' : 'bg-cbg text-cmut'
      }`}
    >
      {ok ? <Check size={10} /> : <Flag size={9} />} {label}
    </span>
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

/* =========================================================================
 *  Push Notifications section
 *  - Firebase config card: admin pastes the service-account JSON (or fills
 *    fields individually) and saves it. Status badge reflects readiness.
 *    A "test" button sends a real push to the admin's own device(s).
 *  - Custom push card: title/body/optional userId/optional imageUrl →
 *    /api/admin/push, with the success toast showing how many devices
 *    received the message.
 * ======================================================================= */

interface FirebaseConfigForm {
  projectId: string
  clientEmail: string
  privateKey: string
  apiKey: string
  authDomain: string
  messagingSenderId: string
  appId: string
}

const FIREBASE_EMPTY: FirebaseConfigForm = {
  projectId: '',
  clientEmail: '',
  privateKey: '',
  apiKey: '',
  authDomain: '',
  messagingSenderId: '',
  appId: '',
}

function PushSection() {
  const me = useApp((s) => s.me)
  const [form, setForm] = useState<FirebaseConfigForm | null>(null)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [configured, setConfigured] = useState(false)
  const [jsonPaste, setJsonPaste] = useState('')
  const [jsonOpen, setJsonOpen] = useState(false)

  // ---- custom push ----
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [userId, setUserId] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    queueMicrotask(async () => {
      try {
        const res = await api.adminSettings()
        const f = (res.settings.firebase ?? {}) as Partial<FirebaseConfigForm>
        const next: FirebaseConfigForm = {
          projectId: String(f.projectId ?? ''),
          clientEmail: String(f.clientEmail ?? ''),
          privateKey: String(f.privateKey ?? ''),
          apiKey: String(f.apiKey ?? ''),
          authDomain: String(f.authDomain ?? ''),
          messagingSenderId: String(f.messagingSenderId ?? ''),
          appId: String(f.appId ?? ''),
        }
        setForm(next)
        setConfigured(
          Boolean(next.projectId && next.clientEmail && next.privateKey && next.apiKey && next.appId)
        )
      } catch {
        setForm(FIREBASE_EMPTY)
      }
    })
  }, [])

  if (!form) return <Loader2 className="mx-auto animate-spin text-cbrand" size={22} />

  const set = <K extends keyof FirebaseConfigForm>(k: K, v: FirebaseConfigForm[K]) =>
    setForm({ ...form, [k]: v })

  // Parse a pasted Firebase service-account JSON (downloaded from the
  // Firebase console → Project settings → Service accounts → Generate new
  // private key) and fill the server-side fields. The web SDK fields still
  // need to be entered manually from "Your apps → Web app config".
  const applyServiceAccountJson = () => {
    const raw = jsonPaste.trim()
    if (!raw) {
      toast.error('Paste the service account JSON first')
      return
    }
    try {
      const obj = JSON.parse(raw) as Record<string, unknown>
      const projectId = String(obj.project_id || '')
      const clientEmail = String(obj.client_email || '')
      const privateKey = String(obj.private_key || '')
      if (!projectId || !clientEmail || !privateKey) {
        toast.error('JSON missing project_id / client_email / private_key')
        return
      }
      setForm({
        ...form,
        projectId,
        clientEmail,
        privateKey,
        // Auto-derive authDomain if the admin hasn't set it yet.
        authDomain: form.authDomain || (projectId ? `${projectId}.firebaseapp.com` : ''),
      })
      setJsonOpen(false)
      setJsonPaste('')
      toast.success('Service account fields filled. Verify the web config below and Save.')
    } catch {
      toast.error('Invalid JSON — paste the file you downloaded from Firebase Console')
    }
  }

  const save = async () => {
    setSaving(true)
    try {
      await api.adminSaveSettings('firebase', { ...form })
      setConfigured(
        Boolean(form.projectId && form.clientEmail && form.privateKey && form.apiKey && form.appId)
      )
      toast.success('Firebase settings saved')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  // Send a test push to the admin's own registered device(s).
  const runTest = async () => {
    if (!me?.id) {
      toast.error('Could not resolve your user id')
      return
    }
    setTesting(true)
    try {
      const res = await api.adminPush({
        title: 'CALL test push',
        body: 'If you can read this, Firebase Cloud Messaging is working.',
        userId: me.id,
      })
      if (res.sent > 0) toast.success(`Test push sent to ${res.sent} device(s).`)
      else toast.warning('Push returned 0 devices — register your browser first (log in & allow notifications).')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setTesting(false)
    }
  }

  const sendPush = async () => {
    if (!title.trim() || !body.trim()) {
      toast.error('Title and body are required')
      return
    }
    setSending(true)
    try {
      const res = await api.adminPush({
        title: title.trim(),
        body: body.trim(),
        userId: userId.trim() || undefined,
        imageUrl: imageUrl.trim() || undefined,
      })
      toast.success(`Sent to ${res.sent} device(s)`)
      setTitle('')
      setBody('')
      setUserId('')
      setImageUrl('')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="flex flex-wrap items-center gap-2 pb-1">
        <h3 className="text-[15px] font-extrabold text-cink">Push notifications</h3>
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
            configured ? 'bg-[#EDFAF3] text-[#067647]' : 'bg-cbg text-cmut'
          }`}
        >
          {configured ? 'Configured' : 'Not configured'}
        </span>
      </div>
      <p className="pb-4 text-[12px] leading-5 text-cmut">
        Firebase Cloud Messaging delivers push notifications to web, Android and iOS clients. The
        service-account <b>private key</b> stays server-side and is never sent to the browser.
      </p>

      {/* ---- Firebase config card ---- */}
      <div className="rounded-[16px] border border-cline p-4">
        <div className="mb-3 flex items-center gap-2">
          <Settings size={16} className="text-cbrand" />
          <h4 className="text-[13.5px] font-extrabold text-cink">Firebase configuration</h4>
        </div>

        <div className="mb-4 rounded-[12px] bg-cbg p-3 text-[12px] leading-5 text-cmut">
          <p className="font-semibold text-cink">Quick start</p>
          <ol className="mt-1.5 list-decimal space-y-1 pl-4">
            <li>Open the Firebase console → Project settings → Service accounts → <b>Generate new private key</b>.</li>
            <li>Paste that JSON below to auto-fill the server-side fields.</li>
            <li>From Project settings → General → Your apps → Web app, copy the <code>apiKey</code>, <code>messagingSenderId</code> and <code>appId</code> into the form below.</li>
            <li>Save, then hit <b>Test push</b> — your own browser will receive a notification.</li>
          </ol>
          <button
            className="mt-2.5 rounded-full bg-white px-3 py-1.5 text-[11.5px] font-bold text-cbrand shadow-sm"
            onClick={() => setJsonOpen((v) => !v)}
          >
            {jsonOpen ? 'Hide JSON paste' : 'Paste service account JSON'}
          </button>
          {jsonOpen && (
            <div className="mt-2.5">
              <textarea
                className="app-input min-h-[110px] w-full font-mono text-[11.5px]"
                placeholder='{ "type": "service_account", "project_id": "…", "private_key": "-----BEGIN PRIVATE KEY-----\n…", "client_email": "…@….iam.gserviceaccount.com", … }'
                value={jsonPaste}
                onChange={(e) => setJsonPaste(e.target.value)}
              />
              <button
                className="mt-2 rounded-full bg-cbrand px-3 py-1.5 text-[11.5px] font-bold text-white"
                onClick={applyServiceAccountJson}
              >
                Fill fields from JSON
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <PushField label="Project ID" value={form.projectId} onChange={(v) => set('projectId', v)} placeholder="my-call-app" />
          <PushField label="Client email" value={form.clientEmail} onChange={(v) => set('clientEmail', v)} placeholder="firebase-adminsdk-xxx@my-call-app.iam.gserviceaccount.com" />
          <PushField label="Private key" value={form.privateKey} onChange={(v) => set('privateKey', v)} placeholder="-----BEGIN PRIVATE KEY-----\n…" type="password" />
          <PushField label="API key (web)" value={form.apiKey} onChange={(v) => set('apiKey', v)} placeholder="AIzaSy…" />
          <PushField label="Auth domain" value={form.authDomain} onChange={(v) => set('authDomain', v)} placeholder="my-call-app.firebaseapp.com" />
          <PushField label="Messaging sender ID" value={form.messagingSenderId} onChange={(v) => set('messagingSenderId', v)} placeholder="1234567890" />
          <div className="sm:col-span-2">
            <PushField label="App ID" value={form.appId} onChange={(v) => set('appId', v)} placeholder="1:1234567890:web:abcdef" />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          <button
            className="h-11 rounded-[14px] bg-brand-grad px-6 text-[13.5px] font-bold text-white disabled:opacity-50"
            disabled={saving}
            onClick={() => void save()}
          >
            {saving ? <Loader2 className="mx-auto animate-spin" size={17} /> : 'Save settings'}
          </button>
          <button
            className="flex h-11 items-center justify-center gap-2 rounded-[14px] border border-cline bg-white px-5 text-[13.5px] font-bold text-cink shadow-sm disabled:opacity-50"
            disabled={testing || !configured}
            onClick={() => void runTest()}
          >
            {testing ? <Loader2 className="animate-spin" size={16} /> : <Send size={15} className="text-cbrand" />}
            Test push (send to my device)
          </button>
        </div>
      </div>

      {/* ---- Custom push card ---- */}
      <div className="mt-5 rounded-[16px] border border-cline p-4">
        <div className="mb-3 flex items-center gap-2">
          <Bell size={16} className="text-cbrand" />
          <h4 className="text-[13.5px] font-extrabold text-cink">Send a custom push</h4>
        </div>
        <p className="pb-3 text-[12px] leading-5 text-cmut">
          Leave <b>User ID</b> empty to broadcast to every registered device on the platform.
          Sending to a single user only delivers to devices they have logged in on.
        </p>

        <div className="space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-[12.5px] font-semibold text-[#4A5568]">Title</span>
            <input
              className="app-input w-full"
              placeholder="Push title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[12.5px] font-semibold text-[#4A5568]">Body</span>
            <textarea
              className="app-input min-h-[88px] w-full"
              placeholder="Push body text"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={500}
            />
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-[12.5px] font-semibold text-[#4A5568]">User ID (optional)</span>
              <input
                className="app-input w-full"
                placeholder="Leave empty for broadcast"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[12.5px] font-semibold text-[#4A5568]">Image URL (optional)</span>
              <input
                className="app-input w-full"
                placeholder="https://…/banner.png"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
              />
            </label>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              className="flex h-11 items-center justify-center gap-2 rounded-[14px] bg-brand-grad px-6 text-[13.5px] font-bold text-white disabled:opacity-50"
              disabled={sending || !title.trim() || !body.trim()}
              onClick={() => void sendPush()}
            >
              {sending ? <Loader2 className="animate-spin" size={16} /> : <Send size={15} />}
              Send push
            </button>
            <span className="text-[12px] text-cmut">
              {userId.trim() ? 'Targets one user' : 'Broadcasts to all devices'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function PushField({
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
