'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  X,
  Wallet as WalletIcon,
  Landmark,
  ArrowDownLeft,
  ArrowUpRight,
  Lock,
  TrendingUp,
  ReceiptText,
  Plus,
  Trash2,
  Loader2,
  Gift,
  Percent,
  BadgeCheck,
  FlaskConical,
  Building2,
  Clock,
} from 'lucide-react'
import { useApp } from '@/lib/callapp/store'
import { api } from '@/lib/callapp/api'
import { toast } from 'sonner'
import { Avatar } from './Avatar'
import type { BankAccountItem } from '@/lib/callapp/types'

type WalletTab = 'overview' | 'gifts' | 'ledger' | 'withdraw'

const STATUS_META: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Pending', cls: 'bg-[#FFF7E6] text-[#B7791F]' },
  under_review: { label: 'Under review', cls: 'bg-[#EEF2FF] text-[#4338CA]' },
  approved: { label: 'Approved', cls: 'bg-[#E7F7EF] text-[#0E9F5B]' },
  paid: { label: 'Paid', cls: 'bg-[#E7F7EF] text-[#0E9F5B]' },
  rejected: { label: 'Rejected', cls: 'bg-[#FEF1F0] text-cred' },
}

const KIND_ICON: Record<string, typeof Gift> = {
  gift_received: Gift,
  room_income: Landmark,
  withdrawal_hold: Lock,
  withdrawal_release: ArrowDownLeft,
  withdrawal_paid: ArrowUpRight,
  admin_adjustment: BadgeCheck,
}

function money(n: number, currency = 'USD') {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n || 0)
  } catch {
    return `$${(n || 0).toFixed(2)}`
  }
}

function timeAgo(iso: string) {
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

/** REAL-MONEY WALLET — creator earnings dashboard (no coins, no diamonds). */
export function WalletScreen({ onClose }: { onClose: () => void }) {
  const { wallet, walletCurrency, walletLedger, walletGifts, withdrawals, bankAccounts, loadWallet } = useApp()
  const [tab, setTab] = useState<WalletTab>('overview')
  const [provider, setProvider] = useState<{ id: string; isTest: boolean }>({ id: 'sandbox', isTest: true })
  const [minWithdrawal, setMinWithdrawal] = useState(25)

  // withdraw form
  const [amount, setAmount] = useState('')
  const [bankId, setBankId] = useState('')
  const [busy, setBusy] = useState(false)

  // add bank form
  const [showBankForm, setShowBankForm] = useState(false)
  const [bankForm, setBankForm] = useState({ holderName: '', bankName: '', accountNumber: '', iban: '', swift: '', countryCode: 'US' })
  const [bankBusy, setBankBusy] = useState(false)

  useEffect(() => {
    void loadWallet()
    void (async () => {
      try {
        const res = await api.wallet()
        setProvider(res.provider)
        setMinWithdrawal(res.minWithdrawal)
        if (res.bankAccounts.length) setBankId((b) => b || res.bankAccounts.find((x) => x.isDefault)?.id || res.bankAccounts[0].id)
      } catch {}
    })()
  }, [])

  // pick the default bank account once accounts load (added accounts included)
  useEffect(() => {
    if (!bankId && bankAccounts.length) {
      setBankId(bankAccounts.find((b) => b.isDefault)?.id ?? bankAccounts[0].id)
    }
  }, [bankAccounts, bankId])

  const totals = useMemo(() => {
    const gross = walletGifts.reduce((n, g) => n + g.grossAmount, 0)
    const commission = walletGifts.reduce((n, g) => n + g.commission, 0)
    return { gross, commission }
  }, [walletGifts])

  const requestWithdrawal = async () => {
    const amt = Number(amount)
    if (!amt || amt <= 0) return toast.error('Enter a valid amount')
    if (wallet && amt < minWithdrawal) return toast.error(`Minimum withdrawal is ${money(minWithdrawal, walletCurrency)}`)
    if (wallet && amt > wallet.available) return toast.error('Amount exceeds your available balance')
    if (!bankId) return toast.error('Add a bank account first')
    setBusy(true)
    const res = await useApp.getState().withdraw(amt, bankId)
    setBusy(false)
    if (res) {
      toast.success(`Withdrawal requested — ${money(amt, walletCurrency)} reserved for review`)
      setAmount('')
    } else {
      toast.error('Withdrawal request failed')
    }
  }

  const addBank = async () => {
    if (!bankForm.holderName.trim() || !bankForm.bankName.trim() || !bankForm.accountNumber.trim()) {
      return toast.error('Holder, bank name and account number are required')
    }
    setBankBusy(true)
    try {
      await api.addBankAccount({ ...bankForm })
      toast.success('Bank account saved')
      setShowBankForm(false)
      setBankForm({ holderName: '', bankName: '', accountNumber: '', iban: '', swift: '', countryCode: 'US' })
      await loadWallet()
    } catch (e) {
      toast.error((e as Error).message || 'Could not save account')
    } finally {
      setBankBusy(false)
    }
  }

  const removeBank = async (id: string) => {
    try {
      await api.deleteBankAccount(id)
      await loadWallet()
      toast.success('Bank account removed')
    } catch {
      toast.error('Could not remove account')
    }
  }

  return (
    <div className="fixed inset-0 z-[85] overflow-y-auto bg-white" role="dialog" aria-label="Wallet">
      <div className="mx-auto min-h-full w-full max-w-[640px] pb-24">
        {/* header */}
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-cline bg-white/95 px-5 py-4 backdrop-blur">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              aria-label="Close wallet"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-csoft text-cink transition hover:bg-[#E4E9F5]"
            >
              <X size={19} />
            </button>
            <div>
              <h1 className="text-[19px] font-extrabold tracking-tight text-cink">Wallet</h1>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cmut">Real money earnings</p>
            </div>
          </div>
          {provider.isTest && (
            <span className="flex items-center gap-1.5 rounded-full bg-[#FFF7E6] px-3 py-1.5 text-[11px] font-bold text-[#B7791F] ring-1 ring-[#F5A524]/40">
              <FlaskConical size={13} /> Test mode
            </span>
          )}
        </header>

        {/* balance card */}
        <section className="px-5 pt-5">
          <div className="bg-brand-grad relative overflow-hidden rounded-[24px] p-5 text-white shadow-[0_16px_36px_rgba(47,91,234,0.28)]">
            <div className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
            <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-white/75">
              <WalletIcon size={14} /> Available balance
            </div>
            <div className="mt-1.5 text-[38px] font-extrabold leading-none tracking-tight">
              {money(wallet?.available ?? 0, walletCurrency)}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl bg-white/12 px-2 py-2.5 ring-1 ring-white/15">
                <Lock size={13} className="mx-auto text-white/70" />
                <div className="mt-1 text-[15px] font-bold">{money(wallet?.reserved ?? 0, walletCurrency)}</div>
                <div className="text-[10px] font-semibold text-white/70">Reserved</div>
              </div>
              <div className="rounded-2xl bg-white/12 px-2 py-2.5 ring-1 ring-white/15">
                <TrendingUp size={13} className="mx-auto text-white/70" />
                <div className="mt-1 text-[15px] font-bold">{money(wallet?.totalEarned ?? 0, walletCurrency)}</div>
                <div className="text-[10px] font-semibold text-white/70">Lifetime earned</div>
              </div>
              <div className="rounded-2xl bg-white/12 px-2 py-2.5 ring-1 ring-white/15">
                <ArrowUpRight size={13} className="mx-auto text-white/70" />
                <div className="mt-1 text-[15px] font-bold">{money(wallet?.totalWithdrawn ?? 0, walletCurrency)}</div>
                <div className="text-[10px] font-semibold text-white/70">Withdrawn</div>
              </div>
            </div>
            <button
              className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-[16px] bg-white text-[14px] font-extrabold text-cbrand shadow-lg transition active:scale-[.98]"
              onClick={() => setTab('withdraw')}
            >
              <Landmark size={16} /> Withdraw via bank transfer
            </button>
          </div>
          <div className="mt-3 flex items-start gap-2 rounded-2xl bg-csoft px-3.5 py-3 text-[11.5px] leading-[17px] text-cmut">
            <Percent size={14} className="mt-0.5 flex-none text-cbrand" />
            Earnings are credited from verified gift payments after the platform commission and payment processing fee
            (tracked separately). Only verified earnings become withdrawable.
          </div>
        </section>

        {/* tabs */}
        <nav className="mt-5 flex gap-1.5 px-5" aria-label="Wallet sections">
          {(
            [
              ['overview', 'Overview'],
              ['gifts', 'Gifts received'],
              ['ledger', 'Transactions'],
              ['withdraw', 'Withdraw'],
            ] as [WalletTab, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`h-10 flex-1 rounded-full text-[12.5px] font-bold transition ${
                tab === id ? 'bg-cink text-white' : 'bg-csoft text-cmut hover:bg-[#E4E9F5]'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        <main className="px-5 pt-4">
          {/* ============ OVERVIEW ============ */}
          {tab === 'overview' && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2.5">
                <StatTile icon={Gift} label="Gifts received" value={String(walletGifts.length)} />
                <StatTile icon={TrendingUp} label="Gross gifts" value={money(totals.gross, walletCurrency)} />
                <StatTile icon={Percent} label="Commission paid" value={money(totals.commission, walletCurrency)} />
              </div>

              <div className="overflow-hidden rounded-[22px] border border-cline bg-white">
                <div className="border-b border-cline px-4 py-3 text-[13px] font-extrabold text-cink">Bank accounts</div>
                {bankAccounts.length === 0 && !showBankForm && (
                  <div className="px-4 py-6 text-center">
                    <Building2 size={26} className="mx-auto text-cmut" />
                    <p className="mt-2 text-[13px] font-semibold text-cink">No bank account yet</p>
                    <p className="mt-1 text-[12px] text-cmut">Bank transfer is the only payout method.</p>
                    <button className="mt-3 rounded-full bg-cink px-4 py-2 text-[12.5px] font-bold text-white" onClick={() => setShowBankForm(true)}>
                      <span className="flex items-center gap-1.5"><Plus size={14} /> Add bank account</span>
                    </button>
                  </div>
                )}
                {bankAccounts.length > 0 && (
                  <ul className="divide-y divide-cline">
                    {bankAccounts.map((b) => (
                      <BankRow key={b.id} account={b} onRemove={() => void removeBank(b.id)} />
                    ))}
                  </ul>
                )}
                {bankAccounts.length > 0 && (
                  <div className="px-4 pb-3 pt-1">
                    <button className="flex items-center gap-1.5 text-[12.5px] font-bold text-cbrand" onClick={() => setShowBankForm(true)}>
                      <Plus size={14} /> Add another account
                    </button>
                  </div>
                )}
                {showBankForm && (
                  <div className="space-y-2.5 border-t border-cline bg-cbg/60 px-4 py-4">
                    <Field label="Account holder" value={bankForm.holderName} onChange={(v) => setBankForm({ ...bankForm, holderName: v })} placeholder="Full name on the account" />
                    <Field label="Bank name" value={bankForm.bankName} onChange={(v) => setBankForm({ ...bankForm, bankName: v })} placeholder="e.g. Meezan Bank" />
                    <Field label="Account number / IBAN" value={bankForm.accountNumber} onChange={(v) => setBankForm({ ...bankForm, accountNumber: v })} placeholder="Digits only" />
                    <div className="grid grid-cols-2 gap-2.5">
                      <Field label="SWIFT / BIC (optional)" value={bankForm.swift} onChange={(v) => setBankForm({ ...bankForm, swift: v })} placeholder="e.g. MEZNUS33" />
                      <Field label="Country code" value={bankForm.countryCode} onChange={(v) => setBankForm({ ...bankForm, countryCode: v.toUpperCase().slice(0, 2) })} placeholder="US" />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button className="btn-p h-11 flex-1 text-[13.5px]" onClick={() => void addBank()} disabled={bankBusy}>
                        {bankBusy ? <Loader2 size={16} className="animate-spin" /> : 'Save account'}
                      </button>
                      <button className="h-11 rounded-[16px] px-4 text-[13px] font-bold text-cmut hover:bg-cbg" onClick={() => setShowBankForm(false)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ============ GIFTS RECEIVED ============ */}
          {tab === 'gifts' && (
            <div className="overflow-hidden rounded-[22px] border border-cline bg-white">
              {walletGifts.length === 0 ? (
                <EmptyState icon={Gift} title="No gifts yet" note="Gifts you receive in rooms and live streams appear here with the full money breakdown." />
              ) : (
                <ul className="max-h-[52vh] divide-y divide-cline overflow-y-auto app-scroll">
                  {walletGifts.map((g) => (
                    <li key={g.id} className="flex items-center gap-3 px-4 py-3">
                      <Avatar name={g.from.name} avatarKey={g.from.avatarKey} size={40} src={g.from.avatarUrl} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-[14px] font-bold text-cink">{g.from.name}</span>
                          <span className="text-[15px]">{g.gift.emoji}</span>
                          {g.isTest && (
                            <span className="rounded-full bg-[#FFF7E6] px-1.5 py-0.5 text-[9px] font-bold text-[#B7791F]">TEST</span>
                          )}
                        </div>
                        <div className="text-[11.5px] text-cmut">
                          {g.gift.name} · {g.context === 'room' ? 'Voice room' : 'Live'} · {timeAgo(g.createdAt)}
                        </div>
                        <div className="mt-0.5 text-[11px] text-cmut">
                          Gross {money(g.grossAmount)} · commission −{money(g.commission)} · fee −{money(g.feeAmount)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[14px] font-extrabold text-cgreen">+{money(g.netAmount)}</div>
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-cmut">you earned</div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* ============ LEDGER ============ */}
          {tab === 'ledger' && (
            <div className="overflow-hidden rounded-[22px] border border-cline bg-white">
              {walletLedger.length === 0 ? (
                <EmptyState icon={ReceiptText} title="No transactions yet" note="Every credit and debit on your balance is recorded in this ledger." />
              ) : (
                <ul className="max-h-[52vh] divide-y divide-cline overflow-y-auto app-scroll">
                  {walletLedger.map((l) => {
                    const Icon = KIND_ICON[l.kind] ?? ReceiptText
                    const credit = l.direction === 'credit'
                    return (
                      <li key={l.id} className="flex items-center gap-3 px-4 py-3">
                        <span className={`flex h-9 w-9 flex-none items-center justify-center rounded-full ${credit ? 'bg-[#E7F7EF] text-cgreen' : 'bg-[#FEF1F0] text-cred'}`}>
                          <Icon size={16} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13.5px] font-bold text-cink">{l.note || l.kind}</div>
                          <div className="text-[11.5px] text-cmut">
                            {timeAgo(l.createdAt)} · balance {money(l.availableAfter, walletCurrency)}
                            {l.reservedAfter > 0 ? ` (+${money(l.reservedAfter, walletCurrency)} reserved)` : ''}
                          </div>
                        </div>
                        <div className={`text-[14px] font-extrabold ${credit ? 'text-cgreen' : 'text-cred'}`}>
                          {credit ? '+' : '−'}
                          {money(l.amount, walletCurrency)}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}

          {/* ============ WITHDRAW ============ */}
          {tab === 'withdraw' && (
            <div className="space-y-3">
              <div className="rounded-[22px] border border-cline bg-white p-4">
                <div className="text-[13px] font-extrabold text-cink">Request a withdrawal</div>
                <p className="mt-0.5 text-[11.5px] text-cmut">
                  Bank transfer only · minimum {money(minWithdrawal, walletCurrency)} · funds are reserved until the
                  transfer completes.
                </p>
                <div className="mt-3 space-y-2.5">
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wide text-cmut" htmlFor="w-amount">Amount ({walletCurrency})</label>
                    <input
                      id="w-amount"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder={String(minWithdrawal)}
                      className="app-input mt-1 h-12 w-full"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wide text-cmut" htmlFor="w-bank">Bank account</label>
                    <select id="w-bank" value={bankId} onChange={(e) => setBankId(e.target.value)} className="app-input mt-1 h-12 w-full">
                      {bankAccounts.length === 0 && <option value="">No bank account — add one first</option>}
                      {bankAccounts.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.bankName} · ••••{b.accountNumber.slice(-4)} ({b.holderName})
                        </option>
                      ))}
                    </select>
                  </div>
                  <button className="btn-p flex w-full items-center justify-center gap-2" onClick={() => void requestWithdrawal()} disabled={busy}>
                    {busy && <Loader2 size={17} className="animate-spin" />}
                    Request withdrawal
                  </button>
                </div>
              </div>

              <div className="overflow-hidden rounded-[22px] border border-cline bg-white">
                <div className="border-b border-cline px-4 py-3 text-[13px] font-extrabold text-cink">My requests</div>
                {withdrawals.length === 0 ? (
                  <EmptyState icon={Clock} title="No withdrawals yet" note="Requests and their status will appear here." compact />
                ) : (
                  <ul className="divide-y divide-cline">
                    {withdrawals.map((w) => {
                      const meta = STATUS_META[w.status] ?? STATUS_META.pending
                      return (
                        <li key={w.id} className="flex items-center gap-3 px-4 py-3">
                          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-csoft text-cmut">
                            <Landmark size={15} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="text-[13.5px] font-bold text-cink">{money(w.amount, w.currency)} · Bank transfer</div>
                            <div className="truncate text-[11.5px] text-cmut">
                              {timeAgo(w.createdAt)}
                              {w.bankName ? ` · ${w.bankName}` : ''}
                              {w.transferRef ? ` · ref ${w.transferRef}` : ''}
                            </div>
                            {w.adminNote && w.status === 'rejected' && (
                              <div className="mt-0.5 truncate text-[11px] text-cred">{w.adminNote}</div>
                            )}
                          </div>
                          <span className={`rounded-full px-2.5 py-1 text-[10.5px] font-bold ${meta.cls}`}>{meta.label}</span>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

function StatTile({ icon: Icon, label, value }: { icon: typeof Gift; label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-cline bg-white px-3 py-3 text-center">
      <Icon size={16} className="mx-auto text-cbrand" />
      <div className="mt-1 truncate text-[13.5px] font-extrabold text-cink">{value}</div>
      <div className="text-[10px] font-semibold text-cmut">{label}</div>
    </div>
  )
}

function BankRow({ account, onRemove }: { account: BankAccountItem; onRemove: () => void }) {
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-csoft text-cbrand">
        <Landmark size={15} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[13.5px] font-bold text-cink">{account.bankName}</span>
          {account.isDefault && <span className="rounded-full bg-[#E7F7EF] px-1.5 py-0.5 text-[9px] font-bold text-cgreen">DEFAULT</span>}
        </div>
        <div className="truncate text-[11.5px] text-cmut">
          ••••{account.accountNumber.slice(-4)} · {account.holderName} · {account.countryCode}
        </div>
      </div>
      <button
        onClick={onRemove}
        aria-label="Remove bank account"
        className="flex h-8 w-8 items-center justify-center rounded-full text-cred transition hover:bg-[#FEF1F0]"
      >
        <Trash2 size={15} />
      </button>
    </li>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div>
      <label className="text-[11px] font-bold uppercase tracking-wide text-cmut">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="app-input mt-1 h-12 w-full" />
    </div>
  )
}

function EmptyState({
  icon: Icon,
  title,
  note,
  compact,
}: {
  icon: typeof Gift
  title: string
  note: string
  compact?: boolean
}) {
  return (
    <div className={`flex flex-col items-center justify-center px-6 text-center ${compact ? 'py-6' : 'py-10'}`}>
      <Icon size={compact ? 22 : 30} className="text-cmut" />
      <p className={`mt-2 font-bold text-cink ${compact ? 'text-[13px]' : 'text-[14px]'}`}>{title}</p>
      <p className="mt-1 max-w-[300px] text-[12px] leading-[17px] text-cmut">{note}</p>
    </div>
  )
}
