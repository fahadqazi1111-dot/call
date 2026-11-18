'use client'

import { useEffect, useState } from 'react'
import { X, Coins, Gem, ArrowDownToLine, Loader2, CheckCircle2, XCircle, Clock, ShieldCheck } from 'lucide-react'
import { api } from '@/lib/callapp/api'
import { useApp } from '@/lib/callapp/store'
import type { WalletTx, Withdrawal } from '@/lib/callapp/types'

/** Wallet: coin balance, packages (sandbox purchase), history, withdrawals. */
export function WalletScreen({ onClose }: { onClose: () => void }) {
  const wallet = useApp((s) => s.wallet)
  const txs = useApp((s) => s.walletTxs)
  const packages = useApp((s) => s.packages)
  const withdrawals = useApp((s) => s.withdrawals)
  const loadWallet = useApp((s) => s.loadWallet)
  const [busy, setBusy] = useState<string | null>(null)
  const [tab, setTab] = useState<'coins' | 'earnings' | 'withdraw'>('coins')
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [method, setMethod] = useState('jazzcash')
  const [destination, setDestination] = useState('')
  const [minWithdrawal, setMinWithdrawal] = useState(5000)
  const [methods, setMethods] = useState<string[]>(['jazzcash'])
  const [msg, setMsg] = useState('')

  useEffect(() => {
    void loadWallet()
    void api
      .wallet()
      .then(() => {})
      .catch(() => {})
  }, [loadWallet])

  useEffect(() => {
    // config comes with the wallet fetch; derive from last response
    void api
      .notifications()
      .catch(() => {})
    // pull withdrawal config
    fetch('/api/wallet/withdraw', { headers: { 'x-auth-token': localStorage.getItem('call.auth.token') ?? '' } })
      .then((r) => r.json())
      .then((d: { minWithdrawal?: number; methods?: string[] }) => {
        if (d.minWithdrawal) setMinWithdrawal(d.minWithdrawal)
        if (d.methods) setMethods(d.methods)
      })
      .catch(() => {})
  }, [])

  const purchase = async (pkgId: string, name: string) => {
    if (!confirm(`Sandbox purchase: ${name} — no real money is charged. Continue?`)) return
    setBusy(pkgId)
    try {
      const res = await api.purchaseCoins(pkgId)
      await loadWallet()
      setMsg(`+${res.credited} coins added 🪙`)
      window.setTimeout(() => setMsg(''), 2500)
    } catch (e) {
      setMsg((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const requestWithdraw = async () => {
    const amount = Number(withdrawAmount)
    if (!amount) return
    setBusy('wd')
    try {
      await api.requestWithdrawal(amount, method, destination)
      await loadWallet()
      setWithdrawAmount('')
      setDestination('')
      setMsg('Withdrawal request submitted — admin will review it')
    } catch (e) {
      setMsg((e as Error).message)
    } finally {
      setBusy(null)
      window.setTimeout(() => setMsg(''), 3500)
    }
  }

  return (
    <div className="fixed inset-0 z-[85] flex flex-col bg-white">
      <header className="flex items-center gap-3 border-b border-cline px-4 py-3.5">
        <button className="rounded-full bg-cbg p-2 text-cmut hover:text-cbrand" onClick={onClose} aria-label="Close wallet">
          <X size={20} />
        </button>
        <h2 className="flex-1 text-[16px] font-extrabold text-cink">Wallet</h2>
        <span className="rounded-full bg-csoft px-3 py-1.5 text-[11px] font-bold text-cbrand">One World. One Call.</span>
      </header>

      {/* balance card */}
      <div className="mx-4 mt-4 rounded-[22px] bg-brand-grad p-5 text-white shadow-lg">
        <div className="flex gap-6">
          <div className="flex-1">
            <p className="flex items-center gap-1.5 text-[12px] text-white/80">
              <Coins size={14} /> Coins (spendable)
            </p>
            <p className="pt-1 text-[28px] font-extrabold tabular-nums">{wallet?.coins ?? 0}</p>
          </div>
          <div className="flex-1">
            <p className="flex items-center gap-1.5 text-[12px] text-white/80">
              <Gem size={14} /> Diamonds (earnings)
            </p>
            <p className="pt-1 text-[28px] font-extrabold tabular-nums">{wallet?.earnings ?? 0}</p>
          </div>
        </div>
        <p className="pt-2 text-[10px] text-white/60">
          Top-ups {wallet?.totalTopUp ?? 0} · Spent {wallet?.totalSpent ?? 0} · Earned {wallet?.totalEarned ?? 0}
        </p>
      </div>

      {/* tabs */}
      <div className="flex gap-2 px-4 pt-4">
        {(
          [
            { id: 'coins', label: 'Buy coins' },
            { id: 'earnings', label: 'History' },
            { id: 'withdraw', label: 'Withdraw' },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            className={`rounded-[14px] px-4 py-2 text-[13px] font-bold ${tab === t.id ? 'bg-cbrand text-white' : 'bg-[#F0F3FA] text-[#4A5568]'}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="app-scroll flex-1 overflow-y-auto px-4 pb-10 pt-3">
        {msg && <div className="mb-3 rounded-xl bg-csoft px-4 py-2.5 text-[13px] font-semibold text-cbrand">{msg}</div>}

        {tab === 'coins' && (
          <>
            <div className="mb-2 flex items-start gap-2 rounded-xl bg-[#FFF8E6] px-3.5 py-2.5 text-[11px] text-[#8a6417]">
              <ShieldCheck size={15} className="mt-0.5 flex-none" />
              Sandbox checkout — no real payment. On Google Play / App Store builds this flow
              switches to Google Play Billing / Apple In-App Purchase (policy requirement).
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {packages.map((p) => (
                <button
                  key={p.id}
                  className="flex flex-col items-center gap-1 rounded-[18px] border border-cline bg-white p-4 transition hover:border-cbrand hover:shadow-md disabled:opacity-50"
                  disabled={busy === p.id}
                  onClick={() => void purchase(p.id, p.name)}
                >
                  <Coins size={22} className="text-[#F59E0B]" />
                  <span className="text-[17px] font-extrabold text-cink">{p.coins}</span>
                  {p.bonus > 0 && <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">+{p.bonus} bonus</span>}
                  <span className="pt-1 text-[13px] font-bold text-cbrand">${p.priceUsd}</span>
                  {busy === p.id && <Loader2 size={15} className="animate-spin text-cbrand" />}
                </button>
              ))}
            </div>
          </>
        )}

        {tab === 'earnings' && (
          <div className="space-y-2">
            {txs.length === 0 && <p className="pt-8 text-center text-sm text-cmut">No transactions yet</p>}
            {txs.map((t) => (
              <TxRow key={t.id} tx={t} />
            ))}
          </div>
        )}

        {tab === 'withdraw' && (
          <>
            <div className="rounded-[18px] border border-cline bg-white p-4">
              <p className="text-[13px] font-bold text-cink">Withdraw creator earnings</p>
              <p className="pt-1 text-[11px] text-cmut">
                Minimum {minWithdrawal} diamonds · Available: {(wallet?.earnings ?? 0).toLocaleString()}
              </p>
              <div className="mt-3 flex gap-2">
                <input
                  type="number"
                  placeholder={`Amount (min ${minWithdrawal})`}
                  className="h-11 flex-1 rounded-[12px] bg-[#F0F3FA] px-3 text-[14px] outline-none"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                />
                <select
                  className="h-11 rounded-[12px] bg-[#F0F3FA] px-3 text-[13px] font-semibold outline-none"
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                >
                  {methods.map((m) => (
                    <option key={m} value={m}>
                      {m.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
              <input
                placeholder="Destination (account / IBAN / wallet id)"
                className="mt-2 h-11 w-full rounded-[12px] bg-[#F0F3FA] px-3 text-[14px] outline-none"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
              />
              <button
                className="mt-3 h-12 w-full rounded-[14px] bg-brand-grad text-[14px] font-bold text-white disabled:opacity-40"
                disabled={!withdrawAmount || !destination || busy === 'wd' || (wallet?.earnings ?? 0) < Number(withdrawAmount) || Number(withdrawAmount) < minWithdrawal}
                onClick={() => void requestWithdraw()}
              >
                {busy === 'wd' ? <Loader2 className="mx-auto animate-spin" size={18} /> : <ArrowDownToLine size={16} className="mr-1.5 inline" />}
                Request withdrawal
              </button>
            </div>

            <p className="pb-1 pt-4 text-[13px] font-bold text-cink">My requests</p>
            <div className="space-y-2">
              {withdrawals.length === 0 && <p className="pt-2 text-center text-[13px] text-cmut">No withdrawal requests yet</p>}
              {withdrawals.map((w) => (
                <WithdrawalRow key={w.id} w={w} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function TxRow({ tx }: { tx: WalletTx }) {
  const isSpend = tx.coins < 0
  return (
    <div className="flex items-center gap-3 rounded-[14px] border border-cline bg-white px-3.5 py-2.5">
      <span className={`flex h-9 w-9 items-center justify-center rounded-full text-[15px] ${isSpend ? 'bg-red-50 text-cred' : 'bg-green-50 text-green-600'}`}>
        {isSpend ? '↗' : '↘'}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-bold text-cink">{tx.note || tx.kind}</p>
        <p className="text-[10px] text-cmut">{new Date(tx.createdAt).toLocaleString()}</p>
      </div>
      <div className="text-right">
        {tx.coins !== 0 && <p className={`text-[13px] font-extrabold ${isSpend ? 'text-cred' : 'text-green-600'}`}>{tx.coins > 0 ? '+' : ''}{tx.coins} 🪙</p>}
        {tx.earnings !== 0 && <p className="text-[13px] font-extrabold text-[#B7791F]">{tx.earnings > 0 ? '+' : ''}{tx.earnings} 💎</p>}
      </div>
    </div>
  )
}

function WithdrawalRow({ w }: { w: Withdrawal }) {
  const Icon = w.status === 'approved' ? CheckCircle2 : w.status === 'rejected' ? XCircle : Clock
  const color = w.status === 'approved' ? 'text-green-600' : w.status === 'rejected' ? 'text-cred' : 'text-[#B7791F]'
  return (
    <div className="flex items-center gap-3 rounded-[14px] border border-cline bg-white px-3.5 py-2.5">
      <Icon size={18} className={color} />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-bold text-cink">
          {w.amount.toLocaleString()} 💎 · {w.method.toUpperCase()}
        </p>
        <p className="truncate text-[10px] text-cmut">{w.destination}</p>
        {w.adminNote && <p className="text-[10px] text-cmut">Note: {w.adminNote}</p>}
      </div>
      <span className={`text-[11px] font-bold capitalize ${color}`}>{w.status}</span>
    </div>
  )
}
