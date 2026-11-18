'use client'

import { useEffect, useState } from 'react'
import { Plus, Radio, Users, Lock, Mic, Loader2, Trophy } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/callapp/api'
import { useApp } from '@/lib/callapp/store'
import { Avatar } from './Avatar'
import { AdBanner } from './GiftsUI'
import { RoomScreen } from './RoomScreen'
import { BattleHistorySheet } from './BattleHistorySheet'
import { PaymentModal, waitForPayment, type PendingPayment } from './PaymentModal'
import type { VoiceRoomItem } from '@/lib/callapp/types'

export function RoomsTab({ variant = 'mobile' }: { variant?: 'mobile' | 'desktop' }) {
  const me = useApp((s) => s.me)
  const [rooms, setRooms] = useState<VoiceRoomItem[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [activeRoom, setActiveRoom] = useState<{ id: string; title: string; entryPaid: boolean } | null>(null)
  const [pendingPayment, setPendingPayment] = useState<PendingPayment | null>(null)
  const [pendingRoomId, setPendingRoomId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const desk = variant === 'desktop'

  const load = async () => {
    try {
      const res = await api.rooms()
      setRooms(res.rooms)
    } catch {}
    setLoading(false)
  }

  useEffect(() => {
    queueMicrotask(() => void load())
    const t = window.setInterval(() => void load(), 15_000)
    return () => window.clearInterval(t)
  }, [])

  const openRoom = async (room: VoiceRoomItem) => {
    if (!me) return
    try {
      // roomEntry POST: free rooms join instantly; paid rooms create a direct
      // payment checkout (money, never coins) — joining only after verified payment.
      const res = await api.roomEntry(room.id)
      if (res.needsPayment && res.paymentId) {
        setPendingRoomId(room.id)
        if (res.provider === 'stripe' && res.checkoutUrl) {
          window.location.assign(res.checkoutUrl)
          return
        }
        setPendingPayment({
          id: res.paymentId,
          amount: res.amount ?? 0,
          currency: res.currency ?? 'USD',
          isTest: !!res.isTest,
          provider: res.provider ?? 'sandbox',
          description: `Entry — ${room.title}`,
          emoji: '🎙️',
        })
        return
      }
      setActiveRoom({ id: room.id, title: room.title, entryPaid: true })
    } catch (e) {
      alert((e as Error).message || 'Could not join the room')
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className={`flex items-center gap-2.5 ${desk ? 'border-b border-cline px-5 pb-3 pt-5' : 'px-6 pt-14'}`}>
        <h1 className={`flex-1 font-extrabold tracking-tight text-cink ${desk ? 'text-[26px]' : 'text-[32px]'}`}>Voice Rooms</h1>
        <button
          className="flex h-10 items-center gap-1.5 rounded-full bg-cbg px-3 text-[12px] font-bold text-cmut hover:text-cbrand"
          onClick={() => setShowHistory(true)}
          title="My battle history"
        >
          <Trophy size={15} /> History
        </button>
        <button
          className="flex h-11 w-11 items-center justify-center rounded-full bg-cbrand text-white"
          aria-label="Create room"
          onClick={() => setShowCreate(true)}
        >
          <Plus size={21} />
        </button>
      </header>

      <div className={`app-scroll flex-1 overflow-y-auto ${desk ? 'desk-scroll' : 'pb-[96px]'}`}>
        <AdBanner placement="rooms" />
        {loading ? (
          <div className="flex justify-center pt-16">
            <Loader2 className="animate-spin text-cbrand" size={26} />
          </div>
        ) : rooms.length === 0 ? (
          <div className="flex flex-col items-center pt-20 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-csoft text-cbrand">
              <Radio size={34} />
            </div>
            <p className="mt-5 text-lg font-bold text-cink">No live rooms</p>
            <p className="mt-1 px-10 text-sm text-cmut">
              Create a free room and talk with friends, or host a paid room and earn real money from entries.
            </p>
            <button className="mt-5 rounded-full bg-brand-grad px-6 py-3 text-sm font-semibold text-white" onClick={() => setShowCreate(true)}>
              Create a room
            </button>
          </div>
        ) : (
          <div className={`grid gap-3 ${desk ? 'grid-cols-1 px-4 pt-3' : 'grid-cols-1 px-5 pt-2'}`}>
            {rooms.map((r) => (
              <button
                key={r.id}
                className="flex items-center gap-3.5 rounded-[18px] border border-cline bg-white p-3.5 text-left transition hover:border-cbrand hover:shadow-md"
                onClick={() => void openRoom(r)}
              >
                <Avatar name={r.host.name} avatarKey={r.host.avatarKey} size={46} src={r.host.avatarUrl} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[15px] font-bold text-cink">{r.title}</span>
                    {r.isPaid && (
                      <span className="flex flex-none items-center gap-0.5 rounded-full bg-[#FFF3D6] px-2 py-0.5 text-[10px] font-bold text-[#B7791F]">
                        <Lock size={10} /> ${r.entryFee.toFixed(2)}
                      </span>
                    )}
                  </div>
                  <div className="truncate text-[12px] text-cmut">by {r.host.name}</div>
                  <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-cbrand">
                    <Users size={12} /> {r.participants} in room
                  </div>
                </div>
                <span className="flex h-9 items-center gap-1 rounded-full bg-cbrand px-3 text-[12px] font-bold text-white">
                  <Mic size={14} /> Join
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <CreateRoomSheet
          onClose={() => setShowCreate(false)}
          onCreated={(room) => {
            setShowCreate(false)
            setActiveRoom({ id: room.id, title: room.title, entryPaid: true })
          }}
        />
      )}
      {pendingPayment && pendingRoomId && (
        <PaymentModal
          payment={pendingPayment}
          onPaid={async () => {
            const pid = pendingPayment.id
            setPendingPayment(null)
            const final = await waitForPayment(pid, 8000)
            if (final?.status === 'successful') {
              const room = rooms.find((r) => r.id === pendingRoomId)
              if (room) void openRoom(room)
            } else {
              toast.error('Payment still processing — you can join once it completes')
            }
            setPendingRoomId(null)
          }}
          onClose={() => {
            setPendingPayment(null)
            setPendingRoomId(null)
          }}
          onCancel={() => {
            setPendingPayment(null)
            setPendingRoomId(null)
          }}
        />
      )}
      {activeRoom && (
        <RoomScreen
          roomId={activeRoom.id}
          title={activeRoom.title}
          entryPaid={activeRoom.entryPaid}
          onClose={() => {
            setActiveRoom(null)
            void load()
          }}
        />
      )}
      {showHistory && <BattleHistorySheet onClose={() => setShowHistory(false)} />}
    </div>
  )
}

function CreateRoomSheet({ onClose, onCreated }: { onClose: () => void; onCreated: (room: { id: string; title: string }) => void }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [isPaid, setIsPaid] = useState(false)
  const [entryFee, setEntryFee] = useState('2.50')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [maxFee, setMaxFee] = useState(50)
  const [allowPaid, setAllowPaid] = useState(true)

  useEffect(() => {
    void api
      .rooms()
      .then((res) => {
        setMaxFee(res.settings.maxEntryFee)
        setAllowPaid(res.settings.allowPaidRooms)
      })
      .catch(() => {})
  }, [])

  const create = async () => {
    setBusy(true)
    setError('')
    try {
      const res = await api.createRoom({
        title,
        description,
        isPaid,
        entryFee: isPaid ? Number(entryFee) || 0 : 0,
      })
      onCreated(res.room)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="absolute inset-0 z-50 flex flex-col justify-end bg-black/40" onClick={onClose}>
      <div className="rounded-t-[24px] border-t border-cline bg-white p-5 pb-10" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Create a voice room">
        <h3 className="text-lg font-extrabold text-cink">Create a Voice Room</h3>
        <input
          className="mt-4 h-12 w-full rounded-[14px] bg-[#F0F3FA] px-4 text-[15px] outline-none placeholder:text-[#7A8499]"
          placeholder="Room name"
          value={title}
          maxLength={60}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          className="mt-3 h-20 w-full resize-none rounded-[14px] bg-[#F0F3FA] px-4 py-3 text-[14px] outline-none placeholder:text-[#7A8499]"
          placeholder="Description (optional)"
          value={description}
          maxLength={200}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div className="mt-4 flex gap-2">
          <button
            className={`flex-1 rounded-[14px] py-3 text-sm font-bold transition ${!isPaid ? 'bg-cbrand text-white' : 'bg-[#F0F3FA] text-[#4A5568]'}`}
            onClick={() => setIsPaid(false)}
          >
            🆓 Free room
          </button>
          <button
            className={`flex-1 rounded-[14px] py-3 text-sm font-bold transition ${isPaid ? 'bg-[#B7791F] text-white' : 'bg-[#F0F3FA] text-[#4A5568]'}`}
            onClick={() => allowPaid && setIsPaid(true)}
            disabled={!allowPaid}
            title={allowPaid ? 'Paid room' : 'Paid rooms are disabled by the admin'}
          >
            💰 Paid room
          </button>
        </div>
        {isPaid && (
          <div className="mt-3 flex items-center gap-3">
            <label className="text-sm font-semibold text-cmut">Entry fee (USD, max ${maxFee}) — paid by joiners via card</label>
            <input
              type="number"
              min={0.5}
              max={maxFee}
              step="0.5"
              className="h-11 w-28 rounded-[12px] bg-[#F0F3FA] px-3 text-[15px] font-bold outline-none"
              value={entryFee}
              onChange={(e) => setEntryFee(e.target.value)}
            />
          </div>
        )}
        {error && <p className="mt-3 text-[13px] font-semibold text-cred">{error}</p>}
        <button
          className="mt-5 h-[52px] w-full rounded-[16px] bg-brand-grad text-[15px] font-bold text-white disabled:opacity-40"
          disabled={!title.trim() || busy}
          onClick={() => void create()}
        >
          {busy ? <Loader2 className="mx-auto animate-spin" size={20} /> : 'Create room'}
        </button>
      </div>
    </div>
  )
}
