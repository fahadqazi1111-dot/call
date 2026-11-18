'use client'

import { useEffect, useState } from 'react'
import {
  X, Megaphone, Plus, Loader2, ImageIcon, Link2, Wallet,
  Eye, MousePointerClick, Clock, BadgeCheck, XCircle, FlaskConical, RefreshCw,
} from 'lucide-react'
import { api } from '@/lib/callapp/api'
import { useApp } from '@/lib/callapp/store'
import { toast } from 'sonner'
import { PaymentModal, waitForPayment, type PendingPayment } from './PaymentModal'
import { uploadFile } from '@/lib/callapp/api'
import type { AdCampaignItem, AdCampaignStatus, AdPackageItem } from '@/lib/callapp/types'

const STATUS_META: Record<AdCampaignStatus, { label: string; cls: string }> = {
  draft: { label: 'Draft', cls: 'bg-cbg text-cmut' },
  pending_payment: { label: 'Pending payment', cls: 'bg-[#EEF2FF] text-[#4338CA]' },
  payment_completed: { label: 'Paid — awaiting approval', cls: 'bg-[#EEF2FF] text-[#4338CA]' },
  pending_approval: { label: 'Pending approval', cls: 'bg-[#FFF7E6] text-[#B7791F]' },
  approved: { label: 'Approved', cls: 'bg-[#E7F7EF] text-[#0E9F5B]' },
  active: { label: 'Active', cls: 'bg-[#E7F7EF] text-[#0E9F5B]' },
  paused: { label: 'Paused', cls: 'bg-[#FFF7E6] text-[#B7791F]' },
  rejected: { label: 'Rejected', cls: 'bg-[#FEF1F0] text-cred' },
  completed: { label: 'Completed', cls: 'bg-cbg text-cmut' },
}

/** USER ADVERTISING — create campaigns, pay for them, track status + analytics. */
export function AdsScreen({ onClose }: { onClose: () => void }) {
  const [campaigns, setCampaigns] = useState<AdCampaignItem[]>([])
  const [packages, setPackages] = useState<AdPackageItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [checkout, setCheckout] = useState<PendingPayment | null>(null)
  const [isTest, setIsTest] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const [c, p] = await Promise.all([api.adCampaigns(), api.adPackages()])
      setCampaigns(c.campaigns)
      setPackages(p.packages)
    } catch {}
    setLoading(false)
  }

  useEffect(() => {
    queueMicrotask(() => void load())
  }, [])

  return (
    <div className="fixed inset-0 z-[85] overflow-y-auto bg-white" role="dialog" aria-label="My advertisements">
      <div className="mx-auto min-h-full w-full max-w-[640px] pb-24">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-cline bg-white/95 px-5 py-4 backdrop-blur">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              aria-label="Close ads"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-csoft text-cink transition hover:bg-[#E4E9F5]"
            >
              <X size={19} />
            </button>
            <div>
              <h1 className="text-[19px] font-extrabold tracking-tight text-cink">My advertisements</h1>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cmut">Promote on CALL</p>
            </div>
          </div>
          <button
            className="flex h-10 items-center gap-1.5 rounded-full bg-cbrand px-4 text-[12.5px] font-bold text-white"
            onClick={() => setShowCreate(true)}
            disabled={packages.length === 0}
            title={packages.length === 0 ? 'No ad packages configured yet' : 'Create a campaign'}
          >
            <Plus size={15} /> New campaign
          </button>
        </header>

        <main className="px-5 pt-4">
          {loading ? (
            <div className="flex justify-center pt-16">
              <Loader2 className="animate-spin text-cbrand" size={24} />
            </div>
          ) : campaigns.length === 0 ? (
            <div className="flex flex-col items-center rounded-[22px] border border-cline px-6 py-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#FFF0F3] text-[#D6336C]">
                <Megaphone size={28} />
              </div>
              <p className="mt-4 text-[16px] font-extrabold text-cink">No campaigns yet</p>
              <p className="mt-1 max-w-[340px] text-[13px] leading-[19px] text-cmut">
                Create your own advertisement, pick a package and placement, pay for it, and after admin approval it
                runs across CALL. You get impressions and clicks analytics for every campaign.
              </p>
              <button
                className="btn-p mt-5 h-12"
                onClick={() => setShowCreate(true)}
                disabled={packages.length === 0}
              >
                Create your first campaign
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {campaigns.map((c) => {
                const meta = STATUS_META[c.status] ?? STATUS_META.draft
                return (
                  <div key={c.id} className="overflow-hidden rounded-[20px] border border-cline bg-white">
                    <div className="flex items-center gap-3 px-4 pt-3.5">
                      {c.imageUrl ? (
                        <img src={c.imageUrl} alt="" className="h-12 w-12 flex-none rounded-[12px] object-cover" />
                      ) : (
                        <span className="flex h-12 w-12 flex-none items-center justify-center rounded-[12px] bg-[#FFF0F3] text-[#D6336C]">
                          <ImageIcon size={20} />
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-extrabold text-cink">{c.title}</p>
                        <p className="truncate text-[11.5px] text-cmut">
                          {c.pkg ? `${c.pkg.name} · ${c.pkg.durationDays} days · $${c.pkg.priceUsd.toFixed(2)}` : 'Custom'} ·{' '}
                          {c.placements.join(', ')}
                        </p>
                      </div>
                      <span className={`flex-none rounded-full px-2.5 py-1 text-[10.5px] font-bold ${meta.cls}`}>{meta.label}</span>
                    </div>
                    {c.body && <p className="px-4 pt-2 text-[12.5px] leading-[18px] text-cmut">{c.body}</p>}
                    {c.status === 'rejected' && c.rejectionReason && (
                      <p className="mx-4 mt-2 rounded-xl bg-[#FEF1F0] px-3 py-2 text-[11.5px] font-semibold text-cred">
                        Rejected: {c.rejectionReason}
                      </p>
                    )}
                    <div className="mt-3 grid grid-cols-4 divide-x divide-cline border-t border-cline text-center">
                      <div className="px-2 py-2.5">
                        <p className="text-[14px] font-extrabold text-cink">{c.impressions}</p>
                        <p className="flex items-center justify-center gap-1 text-[9.5px] text-cmut"><Eye size={10} /> impressions</p>
                      </div>
                      <div className="px-2 py-2.5">
                        <p className="text-[14px] font-extrabold text-cink">{c.clicks}</p>
                        <p className="flex items-center justify-center gap-1 text-[9.5px] text-cmut"><MousePointerClick size={10} /> clicks</p>
                      </div>
                      <div className="px-2 py-2.5">
                        <p className="text-[14px] font-extrabold text-cink">${c.totalCost.toFixed(2)}</p>
                        <p className="flex items-center justify-center gap-1 text-[9.5px] text-cmut"><Wallet size={10} /> paid</p>
                      </div>
                      <div className="px-2 py-2.5">
                        <p className="text-[12px] font-extrabold text-cink">{c.startsAt ? new Date(c.startsAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}</p>
                        <p className="flex items-center justify-center gap-1 text-[9.5px] text-cmut"><Clock size={10} /> start</p>
                      </div>
                    </div>
                  </div>
                )
              })}
              <button className="mt-1 flex w-full items-center justify-center gap-2 rounded-[16px] border border-cline py-3 text-[12.5px] font-bold text-cmut transition hover:bg-cbg" onClick={() => void load()}>
                <RefreshCw size={14} /> Refresh status
              </button>
            </div>
          )}
        </main>
      </div>

      {showCreate && (
        <CreateCampaignSheet
          packages={packages}
          onClose={() => setShowCreate(false)}
          onCheckout={(payment, test) => {
            setShowCreate(false)
            setIsTest(test)
            setCheckout(payment)
          }}
        />
      )}
      {checkout && (
        <PaymentModal
          payment={checkout}
          onPaid={async () => {
            const pid = checkout.id
            setCheckout(null)
            const final = await waitForPayment(pid, 8000)
            if (final?.status === 'successful') {
              toast.success('Payment verified — your campaign is pending admin approval')
            }
            void load()
          }}
          onClose={() => {
            setCheckout(null)
            void load()
          }}
        />
      )}
    </div>
  )
}

/* ---------------- create campaign sheet ---------------- */

function CreateCampaignSheet({
  packages,
  onClose,
  onCheckout,
}: {
  packages: AdPackageItem[]
  onClose: () => void
  onCheckout: (payment: PendingPayment, isTest: boolean) => void
}) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [pkgId, setPkgId] = useState(packages[0]?.id ?? '')
  const [budget, setBudget] = useState('')
  const [placements, setPlacements] = useState<string[]>(['chats'])
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const pkg = packages.find((p) => p.id === pkgId)
  const total = pkg?.priceUsd ?? 0

  const pickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Choose an image file for the ad creative')
      return
    }
    if (file.size > 12 * 1024 * 1024) {
      toast.error('Image too large (max 12MB)')
      return
    }
    setUploading(true)
    try {
      const res = await uploadFile(file, file.name || 'ad.jpg', 'media')
      setImageUrl(`/api/media/${res.id}`)
    } catch {
      toast.error('Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const submit = async () => {
    if (!title.trim()) {
      setError('Title is required')
      return
    }
    if (!pkg) {
      setError('Pick a package')
      return
    }
    if (placements.length === 0) {
      setError('Pick at least one placement')
      return
    }
    setBusy(true)
    setError('')
    try {
      const res = await api.adCampaignCreate({
        title: title.trim(),
        body: body.trim(),
        imageUrl: imageUrl ?? undefined,
        linkUrl: linkUrl.trim() || undefined,
        placements,
        packageId: pkg.id,
        budget: Number(budget) || pkg.minBudget,
        clientKey: `ad:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
      })
      if (res.provider === 'stripe' && res.checkoutUrl) {
        window.location.assign(res.checkoutUrl)
        return
      }
      onCheckout(
        {
          id: res.paymentId,
          amount: res.amount,
          currency: 'USD',
          isTest: res.isTest,
          provider: res.provider,
          description: `Ad campaign — ${title.trim().slice(0, 40)}`,
          emoji: '📣',
        },
        res.isTest
      )
    } catch (e) {
      setError((e as Error).message || 'Could not create the campaign')
    } finally {
      setBusy(false)
    }
  }

  const ALL_PLACEMENTS = ['chats', 'rooms', 'profile']
  const allowed = pkg?.placements ?? []

  return (
    <div className="fixed inset-0 z-[92] flex items-end justify-center bg-black/55 sm:items-center sm:p-6" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full max-w-[520px] overflow-y-auto app-scroll rounded-t-[24px] bg-white p-5 pb-8 shadow-2xl sm:rounded-[24px]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Create advertisement"
      >
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-cink">
            <Megaphone size={19} className="text-[#D6336C]" /> Create advertisement
          </h2>
          <button onClick={onClose} aria-label="Close" className="text-cmut hover:text-cink">✕</button>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wide text-cmut">Title *</label>
            <input className="app-input mt-1 h-12" value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} placeholder="Headline of your ad" />
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wide text-cmut">Description</label>
            <textarea className="mt-1 h-20 w-full resize-none rounded-[16px] border-[1.5px] border-[#DDE3EE] px-4 py-3 text-[14px] outline-none focus:border-cbrand" value={body} maxLength={200} onChange={(e) => setBody(e.target.value)} placeholder="Short ad copy shown under the title" />
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wide text-cmut">Destination URL</label>
            <div className="relative mt-1">
              <Link2 size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-cmut" />
              <input className="app-input h-12 pl-10" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://your-site.com" />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wide text-cmut">Creative image</label>
            <div className="mt-1 flex items-center gap-3">
              {imageUrl ? (
                  <img src={imageUrl} alt="Ad creative" className="h-16 w-16 rounded-[12px] object-cover ring-1 ring-cline" />
              ) : (
                <span className="flex h-16 w-16 items-center justify-center rounded-[12px] bg-csoft text-cmut"><ImageIcon size={20} /></span>
              )}
              <label className="flex h-11 cursor-pointer items-center gap-2 rounded-full bg-csoft px-4 text-[12.5px] font-bold text-cbrand">
                {uploading ? <Loader2 size={15} className="animate-spin" /> : <ImageIcon size={15} />}
                {uploading ? 'Uploading…' : imageUrl ? 'Replace image' : 'Upload image'}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => void pickImage(e)} />
              </label>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-wide text-cmut">Package *</label>
            <div className="mt-1.5 grid gap-2">
              {packages.map((p) => (
                <button
                  key={p.id}
                  className={`flex items-center gap-3 rounded-[14px] border px-3.5 py-3 text-left transition ${
                    pkgId === p.id ? 'border-cbrand bg-[#EEF3FF]' : 'border-cline hover:bg-cbg'
                  }`}
                  onClick={() => setPkgId(p.id)}
                >
                  <span className={`flex h-5 w-5 flex-none items-center justify-center rounded-full border-2 ${pkgId === p.id ? 'border-cbrand bg-cbrand text-white' : 'border-[#C9D2E4]'}`}>
                    {pkgId === p.id && <BadgeCheck size={13} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-bold text-cink">{p.name} — ${p.priceUsd.toFixed(2)} · {p.durationDays} days</span>
                    <span className="block truncate text-[11px] text-cmut">{p.description}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-wide text-cmut">Placements</label>
            <div className="mt-1.5 flex gap-2">
              {ALL_PLACEMENTS.map((pl) => {
                const enabled = allowed.includes(pl)
                const on = placements.includes(pl)
                return (
                  <button
                    key={pl}
                    disabled={!enabled}
                    className={`h-10 flex-1 rounded-full text-[12px] font-bold capitalize transition ${
                      on ? 'bg-cink text-white' : enabled ? 'bg-csoft text-cmut' : 'bg-cbg text-[#B9C2D8] line-through'
                    }`}
                    onClick={() => setPlacements((cur) => (on ? cur.filter((x) => x !== pl) : [...cur, pl]))}
                  >
                    {pl}
                  </button>
                )
              })}
            </div>
          </div>

          {pkg && pkg.minBudget > 0 && (
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wide text-cmut">Campaign budget (USD, min ${pkg.minBudget})</label>
              <input type="number" min={pkg.minBudget} className="app-input mt-1 h-12" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder={String(pkg.minBudget)} />
            </div>
          )}

          <div className="rounded-[16px] bg-csoft px-4 py-3">
            <div className="flex items-center justify-between text-[13px]">
              <span className="font-semibold text-cmut">Total campaign price</span>
              <span className="text-[17px] font-extrabold text-cink">${total.toFixed(2)}</span>
            </div>
            <p className="mt-1 text-[11px] leading-[16px] text-cmut">
              Pay once — after admin approval the campaign runs for {pkg?.durationDays ?? 7} days. Unpaid campaigns are
              never activated.
            </p>
          </div>

          {error && (
            <p className="flex items-center gap-1.5 rounded-xl bg-[#FEF1F0] px-3.5 py-2.5 text-[12.5px] font-semibold text-cred">
              <XCircle size={14} /> {error}
            </p>
          )}

          <button className="btn-p w-full" disabled={busy || !title.trim()} onClick={() => void submit()}>
            {busy ? <Loader2 size={17} className="mx-auto animate-spin" /> : `Pay $${total.toFixed(2)} & submit for approval`}
          </button>
          <p className="flex items-center justify-center gap-1.5 text-[11px] text-cmut">
            <FlaskConical size={12} /> Sandbox test checkout is used until Stripe keys are configured by the admin.
          </p>
        </div>
      </div>
    </div>
  )
}
