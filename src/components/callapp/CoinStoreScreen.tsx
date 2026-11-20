'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  X,
  Coins,
  ArrowLeftRight,
  ShoppingBag,
  Loader2,
  Sparkles,
  TrendingUp,
  Info,
  Wand2,
  Gift,
  ReceiptText,
  FlaskConical,
} from 'lucide-react'
import { useApp } from '@/lib/callapp/store'
import { api } from '@/lib/callapp/api'
import { toast } from 'sonner'
import { PaymentModal, type PendingPayment } from './PaymentModal'
import type { CoinPack } from '@/lib/callapp/types'

function money(n: number) {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0)
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

const LEDGER_ICON: Record<string, typeof Coins> = {
  purchase: ShoppingBag,
  convert_in: ArrowLeftRight,
  gift_spend: Gift,
  admin_adjustment: Sparkles,
  refund: TrendingUp,
}

/** Full-screen Coin Store — buy coins with USD or convert USD earnings.
 *  Mirrors the WalletScreen layout (fixed inset-0 z-[85] bg-white). */
export function CoinStoreScreen({ onClose }: { onClose: () => void }) {
  const {
    coinWallet,
    coinLedger,
    coinSettings,
    wallet,
    walletCurrency,
    loadWallet,
    buyCoins,
    convertUsdToCoins,
  } = useApp()

  const [busyPack, setBusyPack] = useState<string | null>(null)
  const [customUsd, setCustomUsd] = useState('')
  const [convertAmt, setConvertAmt] = useState('')
  const [convertBusy, setConvertBusy] = useState(false)
  const [sandbox, setSandbox] = useState<PendingPayment | null>(null)
  const [provider, setProvider] = useState<{ id: string; isTest: boolean }>({ id: 'sandbox', isTest: true })

  useEffect(() => {
    void loadWallet()
    void (async () => {
      try {
        const res = await api.wallet()
        setProvider(res.provider)
      } catch {}
    })()
  }, [loadWallet])

  const coinsPerUsd = coinSettings?.coinsPerUsd ?? 100
  const convertBonus = coinSettings?.convertBonusPercent ?? 10
  const effectiveConvertRate = coinsPerUsd * (1 + convertBonus / 100)

  const customAmount = Number(customUsd) || 0
  const customCoins = Math.floor(customAmount * coinsPerUsd)
  const convertAmount = Number(convertAmt) || 0
  const convertCoinsEstimate = Math.floor(convertAmount * effectiveConvertRate)

  const packs = useMemo<CoinPack[]>(() => {
    if (coinSettings?.coinPacks?.length) return coinSettings.coinPacks
    // Sensible fallback so the screen renders before the wallet API responds.
    return [
      { id: 'pack_500', coins: 500, priceUsd: 4.99, bonus: 0, label: 'Starter' },
      { id: 'pack_1200', coins: 1200, priceUsd: 9.99, bonus: 100, label: 'Popular', popular: true },
      { id: 'pack_3000', coins: 3000, priceUsd: 24.99, bonus: 400, label: 'Best value' },
      { id: 'pack_6500', coins: 6500, priceUsd: 49.99, bonus: 1000, label: 'Whale' },
    ]
  }, [coinSettings])

  const handleBuyPack = async (pack: CoinPack) => {
    if (busyPack) return
    setBusyPack(pack.id)
    try {
      const res = await buyCoins(pack.id, 0)
      if (!res) {
        setBusyPack(null)
        return
      }
      // Stripe redirect already fired inside buyCoins.
      if (res.provider === 'stripe' && res.checkoutUrl) return
      // Sandbox path — open the PaymentModal so the user confirms the test
      // charge. Coins are credited server-side on confirmation, then the
      // wallet refresh (fired from the modal's onPaid) picks them up.
      if (res.isTest) {
        setSandbox({
          id: res.paymentId,
          amount: res.amountUsd,
          currency: 'USD',
          isTest: true,
          provider: res.provider,
          description: `${pack.coins.toLocaleString()} coins · ${pack.label}`,
          emoji: '🪙',
        })
      }
    } finally {
      setBusyPack(null)
    }
  }

  const handleBuyCustom = async () => {
    if (busyPack) return
    if (customAmount <= 0) {
      toast.error('Enter a USD amount')
      return
    }
    setBusyPack('custom')
    try {
      const res = await buyCoins(null, customAmount)
      if (!res) return
      if (res.provider === 'stripe' && res.checkoutUrl) return
      if (res.isTest) {
        setSandbox({
          id: res.paymentId,
          amount: res.amountUsd,
          currency: 'USD',
          isTest: true,
          provider: res.provider,
          description: `${res.coins.toLocaleString()} coins (custom)`,
          emoji: '🪙',
        })
      }
      setCustomUsd('')
    } finally {
      setBusyPack(null)
    }
  }

  const handleConvert = async () => {
    if (convertBusy) return
    if (convertAmount <= 0) {
      toast.error('Enter a USD amount to convert')
      return
    }
    setConvertBusy(true)
    const coins = await convertUsdToCoins(convertAmount)
    setConvertBusy(false)
    if (coins !== null) setConvertAmt('')
  }

  const onSandboxPaid = async () => {
    // The server credits coins on sandbox confirmation — refresh to surface
    // the updated balance + ledger entry.
    setSandbox(null)
    await loadWallet()
    toast.success('Coins added to your balance')
  }

  const balance = coinWallet?.coins ?? 0

  return (
    <div className="fixed inset-0 z-[85] overflow-y-auto bg-white" role="dialog" aria-label="Coin Store">
      <div className="mx-auto min-h-full w-full max-w-[640px] pb-24">
        {/* header */}
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-cline bg-white/95 px-5 py-4 backdrop-blur">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              aria-label="Close coin store"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-csoft text-cink transition hover:bg-[#E4E9F5]"
            >
              <X size={19} />
            </button>
            <div>
              <h1 className="text-[19px] font-extrabold tracking-tight text-cink">Coin Store</h1>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cmut">
                Buy coins · send gifts
              </p>
            </div>
          </div>
          {provider.isTest && (
            <span className="flex items-center gap-1.5 rounded-full bg-[#FFF7E6] px-3 py-1.5 text-[11px] font-bold text-[#B7791F] ring-1 ring-[#F5A524]/40">
              <FlaskConical size={13} /> Test mode
            </span>
          )}
        </header>

        {/* balance hero — gold/amber accent for coins */}
        <section className="px-5 pt-5">
          <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-[#F59E0B] via-[#F97316] to-[#EAB308] p-5 text-white shadow-[0_16px_36px_rgba(245,158,11,0.32)]">
            <div className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-white/20 blur-2xl" />
            <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-white/80">
              <Coins size={14} /> Your coin balance
            </div>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="text-[40px] font-extrabold leading-none tracking-tight">
                {balance.toLocaleString()}
              </span>
              <span className="text-[14px] font-bold text-white/75">coins</span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl bg-white/15 px-2 py-2.5 ring-1 ring-white/20">
                <ShoppingBag size={13} className="mx-auto text-white/80" />
                <div className="mt-1 text-[14px] font-bold">{(coinWallet?.totalPurchased ?? 0).toLocaleString()}</div>
                <div className="text-[10px] font-semibold text-white/75">Purchased</div>
              </div>
              <div className="rounded-2xl bg-white/15 px-2 py-2.5 ring-1 ring-white/20">
                <ArrowLeftRight size={13} className="mx-auto text-white/80" />
                <div className="mt-1 text-[14px] font-bold">{(coinWallet?.totalConverted ?? 0).toLocaleString()}</div>
                <div className="text-[10px] font-semibold text-white/75">Converted</div>
              </div>
              <div className="rounded-2xl bg-white/15 px-2 py-2.5 ring-1 ring-white/20">
                <Gift size={13} className="mx-auto text-white/80" />
                <div className="mt-1 text-[14px] font-bold">{(coinWallet?.totalSpent ?? 0).toLocaleString()}</div>
                <div className="text-[10px] font-semibold text-white/75">Spent</div>
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-start gap-2 rounded-2xl bg-amber-50 px-3.5 py-3 text-[11.5px] leading-[17px] text-[#7c5a12] ring-1 ring-amber-200">
            <Info size={14} className="mt-0.5 flex-none text-amber-600" />
            Coins are virtual currency used to send gifts. They cannot be withdrawn back to cash. Each
            gift shows both its USD and coin prices — pick whichever you prefer.
          </div>
        </section>

        {/* coin packs grid */}
        <section className="px-5 pt-5">
          <div className="mb-2.5 flex items-center gap-2">
            <ShoppingBag size={16} className="text-amber-600" />
            <h2 className="text-[14px] font-extrabold tracking-tight text-cink">Buy coins</h2>
            <span className="ml-auto text-[11.5px] font-semibold text-cmut">
              Base rate: 1 USD = {coinsPerUsd.toLocaleString()} coins
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {packs.map((p) => {
              const total = p.coins + (p.bonus ?? 0)
              const perCoin = total > 0 ? p.priceUsd / total : 0
              const isBusy = busyPack === p.id
              return (
                <button
                  key={p.id}
                  onClick={() => void handleBuyPack(p)}
                  disabled={!!busyPack}
                  className={`relative flex flex-col items-stretch overflow-hidden rounded-[18px] border p-3 text-left transition ${
                    p.popular
                      ? 'border-amber-400 bg-amber-50 ring-2 ring-amber-300/40'
                      : 'border-cline bg-white hover:border-amber-300 hover:bg-amber-50/50'
                  } ${busyPack ? 'opacity-60' : ''}`}
                >
                  {p.popular && (
                    <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-white shadow">
                      <Sparkles size={9} /> Popular
                    </span>
                  )}
                  <div className="flex items-center gap-1.5">
                    <Coins size={16} className="text-amber-500" />
                    <span className="text-[18px] font-extrabold tracking-tight text-cink">
                      {total.toLocaleString()}
                    </span>
                  </div>
                  {p.bonus > 0 && (
                    <span className="mt-0.5 text-[10.5px] font-bold text-amber-600">
                      +{p.bonus.toLocaleString()} bonus
                    </span>
                  )}
                  <div className="mt-1.5 text-[10.5px] text-cmut">
                    {p.coins.toLocaleString()} coins · ${perCoin.toFixed(3)}/coin
                  </div>
                  <div className="mt-2.5 flex h-9 items-center justify-center gap-1.5 rounded-[12px] bg-cink text-[12.5px] font-bold text-white">
                    {isBusy ? <Loader2 size={14} className="animate-spin" /> : <ShoppingBag size={13} />}
                    {money(p.priceUsd)}
                  </div>
                </button>
              )
            })}
          </div>

          {/* custom amount */}
          <div className="mt-3 rounded-[18px] border border-cline bg-white p-3.5">
            <div className="flex items-center gap-2">
              <Wand2 size={15} className="text-amber-600" />
              <span className="text-[13px] font-extrabold text-cink">Custom amount</span>
            </div>
            <div className="mt-2.5 flex items-stretch gap-2">
              <div className="relative flex-1">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[14px] font-bold text-cmut">
                  $
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={customUsd}
                  onChange={(e) => setCustomUsd(e.target.value)}
                  placeholder="10.00"
                  className="app-input h-12 w-full pl-7"
                  aria-label="Custom USD amount"
                />
              </div>
              <button
                onClick={() => void handleBuyCustom()}
                disabled={!!busyPack || customAmount <= 0}
                className="flex h-12 items-center justify-center gap-1.5 rounded-[14px] bg-amber-500 px-4 text-[13.5px] font-bold text-white transition hover:bg-amber-600 disabled:opacity-50"
              >
                {busyPack === 'custom' ? <Loader2 size={15} className="animate-spin" /> : <Coins size={15} />}
                Buy {customCoins > 0 ? `${customCoins.toLocaleString()}` : ''}
              </button>
            </div>
            {customAmount > 0 && (
              <p className="mt-1.5 text-[11.5px] text-cmut">
                You&apos;ll get <b className="text-cink">{customCoins.toLocaleString()} coins</b> at the base rate
                ({money(customAmount)} × {coinsPerUsd.toLocaleString()}).
              </p>
            )}
          </div>
        </section>

        {/* convert USD → coins */}
        <section className="px-5 pt-5">
          <div className="rounded-[22px] border border-cline bg-white p-4">
            <div className="flex items-center gap-2">
              <ArrowLeftRight size={16} className="text-amber-600" />
              <h2 className="text-[14px] font-extrabold tracking-tight text-cink">Convert USD earnings to coins</h2>
            </div>
            <p className="mt-1 text-[12px] leading-[17px] text-cmut">
              Turn your creator earnings into coins at <b className="text-amber-600">{convertBonus}% bonus</b> — you get
              more coins than the cash is worth. Coins can&apos;t be withdrawn, but they let you send gifts to your
              favorite hosts without spending new money.
            </p>

            <div className="mt-3 rounded-[14px] bg-csoft px-3.5 py-2.5">
              <div className="flex items-center justify-between text-[11.5px]">
                <span className="font-semibold text-cmut">Available USD balance</span>
                <span className="font-extrabold text-cink">{money(wallet?.available ?? 0)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[11.5px]">
                <span className="font-semibold text-cmut">Conversion rate</span>
                <span className="font-extrabold text-amber-600">
                  1 USD = {effectiveConvertRate.toLocaleString()} coins
                </span>
              </div>
            </div>

            <div className="mt-3 flex items-stretch gap-2">
              <div className="relative flex-1">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[14px] font-bold text-cmut">
                  $
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={convertAmt}
                  onChange={(e) => setConvertAmt(e.target.value)}
                  placeholder="5.00"
                  className="app-input h-12 w-full pl-7"
                  aria-label="USD amount to convert"
                />
              </div>
              <button
                onClick={() => void handleConvert()}
                disabled={convertBusy || convertAmount <= 0}
                className="flex h-12 items-center justify-center gap-1.5 rounded-[14px] bg-cink px-4 text-[13.5px] font-bold text-white transition hover:bg-black/80 disabled:opacity-50"
              >
                {convertBusy ? <Loader2 size={15} className="animate-spin" /> : <ArrowLeftRight size={15} />}
                Convert
              </button>
            </div>
            {convertAmount > 0 && (
              <p className="mt-1.5 text-[11.5px] text-cmut">
                You&apos;ll receive <b className="text-amber-600">{convertCoinsEstimate.toLocaleString()} coins</b>{' '}
                ({money(convertAmount)} × {effectiveConvertRate.toLocaleString()}).
              </p>
            )}
          </div>
        </section>

        {/* recent coin transactions */}
        <section className="px-5 pt-5">
          <div className="mb-2.5 flex items-center gap-2">
            <ReceiptText size={16} className="text-amber-600" />
            <h2 className="text-[14px] font-extrabold tracking-tight text-cink">Coin transactions</h2>
          </div>
          <div className="overflow-hidden rounded-[22px] border border-cline bg-white">
            {coinLedger.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
                <Coins size={28} className="text-cmut" />
                <p className="mt-2 text-[14px] font-bold text-cink">No coin transactions yet</p>
                <p className="mt-1 max-w-[300px] text-[12px] leading-[17px] text-cmut">
                  Purchases, conversions, and gifts sent with coins will all appear here.
                </p>
              </div>
            ) : (
              <ul className="max-h-80 divide-y divide-cline overflow-y-auto app-scroll">
                {coinLedger.map((l) => {
                  const Icon = LEDGER_ICON[l.kind] ?? ReceiptText
                  const credit = l.direction === 'credit'
                  return (
                    <li key={l.id} className="flex items-center gap-3 px-4 py-3">
                      <span
                        className={`flex h-9 w-9 flex-none items-center justify-center rounded-full ${
                          credit ? 'bg-amber-50 text-amber-600' : 'bg-[#FEF1F0] text-cred'
                        }`}
                      >
                        <Icon size={16} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13.5px] font-bold text-cink">{l.note || l.kind}</div>
                        <div className="text-[11.5px] text-cmut">
                          {timeAgo(l.createdAt)} · balance {l.coinsAfter.toLocaleString()} coins
                        </div>
                      </div>
                      <div className={`text-[14px] font-extrabold ${credit ? 'text-amber-600' : 'text-cred'}`}>
                        {credit ? '+' : '−'}
                        {l.amount.toLocaleString()}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </section>

        <p className="px-5 pt-4 text-center text-[10.5px] leading-[15px] text-cmut">
          Coin purchases use the same secure checkout as gifts. Production: Stripe Checkout with verified
          webhooks. Mobile builds: Google Play Billing / Apple InAP. Test mode is clearly labeled and never
          charges real money.
        </p>
      </div>

      {sandbox && (
        <PaymentModal
          payment={sandbox}
          onPaid={() => void onSandboxPaid()}
          onClose={() => setSandbox(null)}
        />
      )}
    </div>
  )
}
