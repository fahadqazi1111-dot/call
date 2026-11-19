'use client'

import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { toast } from 'sonner'
import { Ban, Flag, ShieldBan, Trash2 } from 'lucide-react'
import { useApp } from '@/lib/callapp/store'
import { api } from '@/lib/callapp/api'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import type { ChatSummary, Me, ReportReason } from '@/lib/callapp/types'

/* ============================================================
 * Shared chat-management + safety plumbing used by both the
 * ChatsTab row menu and the ChatScreen header menu:
 *  - direct action helpers (API + optimistic store + toast)
 *  - confirmation dialogs (block / restrict / report / delete)
 *  - generic overflow menu shell + menu item building blocks
 * ============================================================ */

export type PendingAction = 'block' | 'restrict' | 'report' | 'delete' | null

function errText(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback
}

function patchChat(peerId: string, patch: Partial<ChatSummary>) {
  useApp.setState((st) => ({
    chats: st.chats.map((c) => (c.peer.id === peerId ? { ...c, ...patch } : c)),
  }))
}

/* ---------------- direct actions (no dialog; fire + toast) ---------------- */

export async function setChatMuted(peerId: string, muted: boolean): Promise<boolean> {
  try {
    await api.chatState(peerId, muted ? 'mute' : 'unmute')
    patchChat(peerId, { muted })
    toast.success(muted ? 'Notifications muted' : 'Notifications unmuted')
    return true
  } catch (e) {
    toast.error(errText(e, 'Could not update notification settings'))
    return false
  }
}

export async function setChatArchived(peerId: string, archived: boolean): Promise<boolean> {
  try {
    await api.chatState(peerId, archived ? 'archive' : 'unarchive')
    patchChat(peerId, { archived })
    // resync the main list: the server excludes archived chats from GET
    // /api/chats and re-includes unarchived ones
    void useApp.getState().loadChats()
    if (archived) {
      toast.success('Chat archived', {
        action: { label: 'Undo', onClick: () => void setChatArchived(peerId, false) },
      })
    } else {
      toast.success('Chat unarchived')
    }
    return true
  } catch (e) {
    toast.error(errText(e, 'Could not update chat'))
    return false
  }
}

export async function blockUserAction(peer: Me): Promise<boolean> {
  try {
    await api.safetyBlock(peer.id)
    useApp.setState((st) => ({
      blockedIds: { ...st.blockedIds, [peer.id]: true },
      chats: st.chats.map((c) => (c.peer.id === peer.id ? { ...c, blocked: true } : c)),
    }))
    toast.success(`${peer.name} blocked`)
    return true
  } catch (e) {
    toast.error(errText(e, 'Could not block user'))
    return false
  }
}

export async function unblockUserAction(peerId: string, peerName?: string): Promise<boolean> {
  try {
    await api.safetyUnblock(peerId)
    useApp.setState((st) => {
      const blockedIds = { ...st.blockedIds }
      delete blockedIds[peerId]
      return {
        blockedIds,
        chats: st.chats.map((c) => (c.peer.id === peerId ? { ...c, blocked: false } : c)),
      }
    })
    toast.success(peerName ? `${peerName} unblocked` : 'User unblocked')
    return true
  } catch (e) {
    toast.error(errText(e, 'Could not unblock user'))
    return false
  }
}

export async function restrictUserAction(peer: Me): Promise<boolean> {
  try {
    // the server also flips muted=true on my conversation state
    await api.safetyRestrict(peer.id)
    useApp.setState((st) => ({
      chats: st.chats.map((c) => (c.peer.id === peer.id ? { ...c, restricted: true, muted: true } : c)),
    }))
    toast.success(`${peer.name} restricted`)
    return true
  } catch (e) {
    toast.error(errText(e, 'Could not restrict user'))
    return false
  }
}

export async function unrestrictUserAction(peerId: string, peerName?: string): Promise<boolean> {
  try {
    await api.safetyUnrestrict(peerId)
    patchChat(peerId, { restricted: false })
    toast.success(peerName ? `${peerName} unrestricted` : 'User unrestricted')
    return true
  } catch (e) {
    toast.error(errText(e, 'Could not unrestrict user'))
    return false
  }
}

export async function deleteChatAction(peerId: string): Promise<boolean> {
  try {
    await api.deleteChat(peerId)
    useApp.setState((st) => {
      const messages = { ...st.messages }
      delete messages[peerId]
      return {
        chats: st.chats.filter((c) => c.peer.id !== peerId),
        messages,
        // if the deleted chat is currently open, close the screen too
        openPeerId: st.openPeerId === peerId ? null : st.openPeerId,
      }
    })
    toast.success('Chat deleted')
    return true
  } catch (e) {
    toast.error(errText(e, 'Could not delete chat'))
    return false
  }
}

/* ---------------- confirmation / report dialogs ---------------- */

const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'spam', label: 'Spam' },
  { value: 'harassment', label: 'Harassment or bullying' },
  { value: 'inappropriate', label: 'Inappropriate content' },
  { value: 'scam', label: 'Scam or fraud' },
  { value: 'other', label: 'Something else' },
]

/**
 * All confirmation dialogs for one pending action. Controlled by the parent:
 * `pending` selects which dialog is open, `onClose` clears it. `onDone` fires
 * after a successful action (e.g. so ChatsTab can sync its archived list).
 * `zClass` lets callers raise the dialogs above overlays like PeerProfileSheet.
 */
export function ChatActionDialogs({
  peer,
  pending,
  onClose,
  onDone,
  zClass = '',
}: {
  peer: Me
  pending: PendingAction
  onClose: () => void
  onDone?: () => void
  zClass?: string
}) {
  const [reason, setReason] = useState<ReportReason>('spam')
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)

  const finish = () => {
    onDone?.()
    onClose()
  }

  const runAction = async (fn: () => Promise<boolean>) => {
    setBusy(true)
    const ok = await fn()
    setBusy(false)
    if (ok) finish()
  }

  const submitReport = async () => {
    setBusy(true)
    try {
      await api.safetyReport({ userId: peer.id, reason, details: details.trim() || undefined })
      toast.success('Report sent to our moderation team')
      setDetails('')
      setReason('spam')
      finish()
    } catch (e) {
      toast.error(errText(e, 'Could not send report'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {/* Block — confirm */}
      <AlertDialog open={pending === 'block'} onOpenChange={(o) => { if (!o) onClose() }}>
        <AlertDialogContent className={`max-w-[350px] rounded-2xl ${zClass}`}>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-cink">Block {peer.name}?</AlertDialogTitle>
            <AlertDialogDescription>They won&apos;t be able to message or call you.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-cred text-white hover:bg-cred/90 focus-visible:ring-cred/40"
              disabled={busy}
              onClick={(e) => {
                e.preventDefault()
                void runAction(() => blockUserAction(peer))
              }}
            >
              Block
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Restrict — info dialog */}
      <AlertDialog open={pending === 'restrict'} onOpenChange={(o) => { if (!o) onClose() }}>
        <AlertDialogContent className={`max-w-[350px] rounded-2xl ${zClass}`}>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-cink">
              <ShieldBan size={18} className="flex-none text-cbrand" />
              Restrict {peer.name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {peer.name} can still message you but you won&apos;t be notified and they can&apos;t call you.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault()
                void runAction(() => restrictUserAction(peer))
              }}
            >
              Restrict
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete chat — confirm */}
      <AlertDialog open={pending === 'delete'} onOpenChange={(o) => { if (!o) onClose() }}>
        <AlertDialogContent className={`max-w-[350px] rounded-2xl ${zClass}`}>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-cink">Delete this chat?</AlertDialogTitle>
            <AlertDialogDescription>Messages will be cleared for you. This can&apos;t be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-cred text-white hover:bg-cred/90 focus-visible:ring-cred/40"
              disabled={busy}
              onClick={(e) => {
                e.preventDefault()
                void runAction(() => deleteChatAction(peer.id))
              }}
            >
              <span className="flex items-center gap-1.5">
                <Trash2 size={15} />
                Delete
              </span>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Report — reason chips + optional details */}
      <Dialog open={pending === 'report'} onOpenChange={(o) => { if (!o) onClose() }}>
        <DialogContent className={`max-w-[400px] rounded-2xl ${zClass}`}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-cink">
              <Flag size={17} className="flex-none text-cred" />
              Report {peer.name}
            </DialogTitle>
            <DialogDescription>Tell us what&apos;s happening — our moderation team will review this report.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Report reason">
            {REPORT_REASONS.map((r) => (
              <button
                key={r.value}
                type="button"
                role="radio"
                aria-checked={reason === r.value}
                className={`rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors ${
                  reason === r.value
                    ? 'border-cred bg-[#FEF0EF] text-cred'
                    : 'border-cline bg-white text-cink hover:bg-cbg'
                }`}
                onClick={() => setReason(r.value)}
              >
                {r.label}
              </button>
            ))}
          </div>
          <Textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Add details (optional)"
            aria-label="Report details"
            maxLength={500}
            className="min-h-[88px] rounded-xl border-cline text-[14px]"
          />
          <DialogFooter>
            <button
              type="button"
              className="rounded-full border border-cline px-5 py-2 text-[13.5px] font-semibold text-cmut transition hover:bg-cbg disabled:opacity-60"
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-full bg-cred px-5 py-2 text-[13.5px] font-bold text-white transition hover:bg-cred/90 disabled:opacity-60"
              onClick={() => void submitReport()}
              disabled={busy}
            >
              Send report
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

/* ---------------- overflow menu building blocks ---------------- */

/**
 * Generic dropdown panel for list rows / headers. Position it inside a
 * `relative` wrapper that also contains the trigger button (wrapRef) so
 * clicks on the trigger toggle instead of double-firing. Closes on outside
 * click, Escape, blur and any scroll (capture) — per spec.
 */
export function MenuShell({
  open,
  onClose,
  wrapRef,
  up = false,
  children,
}: {
  open: boolean
  onClose: () => void
  wrapRef: RefObject<HTMLDivElement | null>
  up?: boolean
  children: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (wrapRef.current?.contains(e.target as Node)) return
      onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const close = () => onClose()
    document.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('keydown', onKey)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    window.addEventListener('blur', close)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
      window.removeEventListener('blur', close)
    }
  }, [open, onClose, wrapRef])

  if (!open) return null
  return (
    <div
      role="menu"
      aria-label="Chat options"
      onClick={(e) => e.stopPropagation()}
      className={`absolute right-0 z-[70] w-56 overflow-hidden rounded-2xl border border-cline bg-white py-1.5 shadow-[0_18px_44px_rgba(16,32,72,0.18)] ${
        up ? 'bottom-full mb-2' : 'top-full mt-2'
      }`}
    >
      {children}
    </div>
  )
}

export function ChatMenuItem({
  icon,
  label,
  danger = false,
  onClick,
}: {
  icon: ReactNode
  label: string
  danger?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-[14px] font-medium transition-colors hover:bg-cbg ${
        danger ? 'text-cred' : 'text-cink'
      }`}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
    >
      <span className={`flex-none ${danger ? 'text-cred' : 'text-cmut'}`}>{icon}</span>
      <span className="flex-1 truncate">{label}</span>
    </button>
  )
}

export function MenuDivider() {
  return <div className="my-1 border-t border-cline" role="separator" />
}
