'use client'

import { create } from 'zustand'
import { toast } from 'sonner'
import { api, setToken as persistToken } from './api'
import { socketClient } from './socket'
import { callManager } from './callManager'
import { roomManager } from './roomManager'
import { liveManager, battleManager } from './liveManager'
import { conferenceManager } from './conferenceManager'
import type { ConferenceSnapshot, ConfInviteUser } from './conferenceTypes'
import { soundKit } from './sound'
import type {
  AppNotification,
  BankAccountItem,
  CallRecord,
  CallState,
  ChatSummary,
  CoinLedgerItem,
  CoinSettings,
  CoinWalletSnapshot,
  ContactItem,
  GiftReceivedItem,
  LedgerEntryItem,
  Me,
  Message,
  WalletInfo,
  WithdrawalItem,
} from './types'

export type AppPhase = 'splash' | 'boot' | 'onboarding' | 'auth' | 'main'
export type AppTab = 'chats' | 'calls' | 'rooms' | 'live' | 'contacts' | 'profile'
export type AppOverlay = 'ai' | 'admin' | 'notifications' | 'wallet' | 'ads' | 'story-composer' | 'coin-store' | null
/** Staff members land in the console; they can switch to the normal user app. */
export type StaffView = 'console' | 'app'

const SESSION_KEY = 'call.session.v1'

interface SessionPersist {
  token: string
  user: Me
}

function loadSession(): SessionPersist | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as SessionPersist
    return s.token && s.user?.id ? s : null
  } catch {
    return null
  }
}

function saveSession(s: SessionPersist | null) {
  if (typeof window === 'undefined') return
  if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s))
  else localStorage.removeItem(SESSION_KEY)
}

function notifyDesktop(title: string, body: string) {
  if (typeof document === 'undefined') return
  if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, { body })
    } catch {}
  }
}

interface AppState {
  phase: AppPhase
  /** admin-controlled splash toggle (cached locally, refreshed at boot) */
  splashEnabled: boolean
  me: Me | null
  token: string | null
  tab: AppTab
  overlay: AppOverlay
  staffView: StaffView
  openPeerId: string | null
  chats: ChatSummary[]
  messages: Record<string, Message[]>
  contacts: ContactItem[]
  calls: CallRecord[]
  online: Record<string, boolean>
  typing: Record<string, boolean>
  call: CallState | null
  /** multi-party conference (mirrors conferenceManager state) */
  conference: ConferenceSnapshot
  booted: boolean
  chatsLoaded: boolean

  wallet: WalletInfo | null
  walletCurrency: string
  walletLedger: LedgerEntryItem[]
  walletGifts: GiftReceivedItem[]
  withdrawals: WithdrawalItem[]
  bankAccounts: BankAccountItem[]
  notifications: AppNotification[]
  unreadNotifs: number
  /** userIds I blocked (safety) — refreshed by loadBlockedIds */
  blockedIds: Record<string, boolean>

  /* coin system — virtual currency for sending gifts (parallel to USD wallet) */
  coinWallet: CoinWalletSnapshot | null
  coinLedger: CoinLedgerItem[]
  coinSettings: CoinSettings | null

  setPhase: (p: AppPhase) => void
  setTab: (t: AppTab) => void
  setOverlay: (o: AppOverlay) => void
  setStaffView: (v: StaffView) => void
  bootstrap: () => Promise<void>
  loginSuccess: (token: string, user: Me) => void
  updateMe: (patch: { name?: string; about?: string; avatarUrl?: string | null; username?: string; allowNonContacts?: boolean }) => Promise<void>
  updateAvatar: (blob: Blob, mime: string) => Promise<void>
  markPasswordSet: () => void
  /** Replace the signed-in user's phone after a successful OTP verification.
   *  Updates `me` in-memory and in the persisted session. */
  changePhone: (newPhone: string, code: string, clientKey: string) => Promise<void>
  /** Replace the signed-in user's email after a successful OTP verification.
   *  Updates `me` in-memory and in the persisted session. */
  changeEmail: (newEmail: string, code: string, clientKey: string) => Promise<void>
  logout: () => void
  /** Permanently delete the authenticated user's account + all personal data.
   *  App Store / Play Store compliance. Requires `confirm: true` and, when the
   *  user has a password set, the correct password. On success, clears all
   *  local state and bounces back to the auth screen. */
  deleteAccount: (password: string | null) => Promise<void>

  loadChats: () => Promise<void>
  openChat: (peerId: string | null) => void
  closeChat: () => void
  loadMessages: (peerId: string) => Promise<void>
  sendText: (peerId: string, text: string) => Promise<void>
  sendVoice: (peerId: string, blob: Blob, durationSec: number, effect?: string) => Promise<void>
  /** photo / video message — blob already cropped/trimmed by the MediaComposer */
  sendMedia: (peerId: string, kind: 'image' | 'video', blob: Blob, durationSec?: number) => Promise<void>
  markReadIfOpen: (peerId: string) => Promise<void>
  handleIncomingMessage: (fromId: string | null, message: Message) => Promise<void>
  /** unsend (everyone) or delete-for-me; relays `msg:deleted` for everyone-scope */
  deleteMessages: (peerId: string, ids: string[], scope: 'everyone' | 'me') => Promise<void>
  /** forward selected messages to one or more peers (Messenger-style) */
  forwardMessages: (toPeerIds: string[], msgs: Message[]) => Promise<void>

  loadContacts: () => Promise<void>
  addContact: (name: string, phone: string) => Promise<boolean>
  /** add a registered CALL user by @username (or userId); resolves their phone/name on the server. */
  addContactByUsername: (username: string) => Promise<boolean>
  syncDeviceContacts: (list: { name: string; phone: string }[]) => Promise<{ saved: number; matched: number } | null>
  deleteContact: (id: string) => Promise<void>

  loadCalls: () => Promise<void>
  startCall: (peer: { id: string; name: string; avatarKey: number }, type: 'voice' | 'video') => void
  acceptCall: () => void
  declineCall: () => void
  hangup: () => void

  /* conferences */
  startConference: (type: 'voice' | 'video') => Promise<void>
  conferenceInvite: (users: ConfInviteUser[]) => void
  confirmConferenceComposer: (users: ConfInviteUser[]) => Promise<void>
  acceptConferenceInvite: () => Promise<void>
  declineConferenceInvite: () => void
  conferenceToggleMute: () => void
  conferenceToggleCamera: () => Promise<void>
  conferenceLeave: () => void
  conferenceEnd: () => void
  openConferenceComposer: (type: 'voice' | 'video') => void
  closeConferenceComposer: () => void
  upgradeCallToConference: () => Promise<void>

  loadWallet: () => Promise<void>
  withdraw: (amount: number, bankAccountId: string) => Promise<{ id: string; amount: number; status: string } | null>

  /** Buy coins — either a pre-defined pack or a custom USD amount.
   *  Returns a Stripe checkoutUrl (redirect) or a sandbox paymentId
   *  (caller shows the PaymentModal). Returns null on failure. */
  buyCoins: (packId: string | null, amountUsd: number) => Promise<{
    paymentId: string
    checkoutUrl?: string
    coins: number
    amountUsd: number
    provider: string
    isTest: boolean
  } | null>
  /** Convert USD wallet earnings into coins at a bonus rate. Refreshes both
   *  wallets and returns the number of coins credited (null on failure). */
  convertUsdToCoins: (amountUsd: number) => Promise<number | null>
  /** Send a gift by spending coins. Returns the new coin balance (null on
   *  failure). Mirrors the existing giftSendWallet flow but debits coins. */
  sendGiftWithCoins: (args: {
    giftId: string
    toUserId: string
    context: 'room' | 'live' | 'battle'
    roomId?: string
    liveId?: string
    battleId?: string
    battleSide?: number
  }) => Promise<{ sendId: string; coins: number } | null>

  loadNotifications: () => Promise<void>
  markNotifs: (payload: { ids?: string[]; all?: boolean }) => Promise<void>
  pushNotification: (n: AppNotification) => void

  loadBlockedIds: () => Promise<void>
}

export const useApp = create<AppState>((set, get) => ({
  phase: 'splash',
  /** admin splash toggle — server renders `true`; the local cache is read
   * POST-hydration by SplashScreen so the first client render always matches */
  splashEnabled: true,
  me: null,
  token: null,
  tab: 'chats',
  overlay: null,
  staffView: 'app',
  openPeerId: null,
  chats: [],
  messages: {},
  contacts: [],
  calls: [],
  online: {},
  typing: {},
  call: null,
  conference: conferenceManager.snapshot(),
  booted: false,
  chatsLoaded: false,

  wallet: null,
  walletCurrency: 'USD',
  walletLedger: [],
  walletGifts: [],
  withdrawals: [],
  bankAccounts: [],
  notifications: [],
  unreadNotifs: 0,
  blockedIds: {},

  coinWallet: null,
  coinLedger: [],
  coinSettings: null,

  setPhase: (p) => set({ phase: p }),
  setTab: (t) => set({ tab: t }),
  setOverlay: (o) => set({ overlay: o }),
  setStaffView: (v) => set({ staffView: v, openPeerId: null }),

  bootstrap: async () => {
    // splash setting — cached locally, refreshed from the admin config
    try {
      const cfg = await api.appConfig()
      try {
        window.localStorage.setItem('call.splash', cfg.splashEnabled ? '1' : '0')
      } catch {}
      set({ splashEnabled: cfg.splashEnabled })
    } catch {}
    const s = loadSession()
    if (!s) {
      set({ phase: 'onboarding', booted: true })
      return
    }
    try {
      persistToken(s.token)
      const { user } = await api.me()
      const staff = user.role === 'admin' || user.role === 'team'
      set({
        token: s.token,
        me: user,
        phase: 'main',
        booted: true,
        staffView: staff ? 'console' : 'app',
      })
      void get().loadWallet()
      socketClient.connect(user.id, user.name)
      callManager.setMe({ id: user.id, name: user.name })
      conferenceManager.setMe({ id: user.id, name: user.name, avatarKey: user.avatarKey, avatarUrl: user.avatarUrl })
      void get().loadChats()
      void get().loadContacts()
      void get().loadCalls()
      void get().loadNotifications()
      void get().loadBlockedIds()
      if ('Notification' in window && Notification.permission === 'default') {
        void Notification.requestPermission()
      }
    } catch {
      persistToken(null)
      saveSession(null)
      set({ phase: 'onboarding', booted: true })
    }
  },

  loginSuccess: (token, user) => {
    persistToken(token)
    saveSession({ token, user })
    const staff = user.role === 'admin' || user.role === 'team'
    set({ token, me: user, phase: 'main', staffView: staff ? 'console' : 'app' })
    socketClient.connect(user.id, user.name)
    callManager.setMe({ id: user.id, name: user.name })
    conferenceManager.setMe({ id: user.id, name: user.name, avatarKey: user.avatarKey, avatarUrl: user.avatarUrl })
    void get().loadChats()
    void get().loadContacts()
    void get().loadCalls()
    void get().loadWallet()
    void get().loadNotifications()
    void get().loadBlockedIds()
    if ('Notification' in window && Notification.permission === 'default') {
      void Notification.requestPermission()
    }
  },

  updateMe: async (patch) => {
    const { user } = await api.updateMe(patch)
    set({ me: user })
    const s = loadSession()
    if (s) saveSession({ ...s, user })
  },

  updateAvatar: async (blob, mime) => {
    const up = await api.uploadAvatar(blob, mime)
    const { user } = await api.updateMe({ avatarUrl: `/api/media/${up.id}` })
    set({ me: user })
    const s = loadSession()
    if (s) saveSession({ ...s, user })
    // refresh chats so peers that mirror my profile pick up the new photo
    void get().loadChats()
  },

  /** after a successful password change/set, reflect hasPassword locally + in the stored session */
  markPasswordSet: () => {
    set((s) => (s.me ? { me: { ...s.me, hasPassword: true } } : s))
    const sess = loadSession()
    if (sess && sess.user) saveSession({ ...sess, user: { ...sess.user, hasPassword: true } })
  },

  changePhone: async (newPhone, code, clientKey) => {
    const { user } = await api.changePhone({ newPhone, code, clientKey })
    set({ me: user })
    const s = loadSession()
    if (s) saveSession({ ...s, user })
    // phone is used by chat peer-mirrors + contacts; refresh so the new
    // number is reflected everywhere.
    void get().loadChats()
    void get().loadContacts()
  },

  changeEmail: async (newEmail, code, clientKey) => {
    const { user } = await api.changeEmail({ newEmail, code, clientKey })
    set({ me: user })
    const s = loadSession()
    if (s) saveSession({ ...s, user })
  },

  logout: () => {
    if (get().call) callManager.hangup()
    conferenceManager.leave()
    void roomManager.leave(true)
    void liveManager.leave(true)
    callManager.setMe(null)
    conferenceManager.setMe(null)
    socketClient.disconnectAll()
    persistToken(null)
    saveSession(null)
    set({
      phase: 'auth',
      me: null,
      token: null,
      chats: [],
      messages: {},
      contacts: [],
      calls: [],
      openPeerId: null,
      chatsLoaded: false,
      wallet: null,
      walletCurrency: 'USD',
      walletLedger: [],
      walletGifts: [],
      withdrawals: [],
      bankAccounts: [],
      notifications: [],
      unreadNotifs: 0,
      blockedIds: {},
      overlay: null,
      staffView: 'app',
      coinWallet: null,
      coinLedger: [],
      coinSettings: null,
    })
  },

  deleteAccount: async (password) => {
    // Call the server first — if it fails, we keep the user logged in so they
    // can retry. Only when the server confirms deletion do we wipe local state.
    await api.deleteAccount({ password: password ?? undefined, confirm: true })
    // Mirror logout(): tear down every manager + clear state, then go to auth.
    if (get().call) callManager.hangup()
    conferenceManager.leave()
    void roomManager.leave(true)
    void liveManager.leave(true)
    callManager.setMe(null)
    conferenceManager.setMe(null)
    socketClient.disconnectAll()
    persistToken(null)
    saveSession(null)
    set({
      phase: 'auth',
      me: null,
      token: null,
      chats: [],
      messages: {},
      contacts: [],
      calls: [],
      openPeerId: null,
      chatsLoaded: false,
      wallet: null,
      walletCurrency: 'USD',
      walletLedger: [],
      walletGifts: [],
      withdrawals: [],
      bankAccounts: [],
      notifications: [],
      unreadNotifs: 0,
      blockedIds: {},
      overlay: null,
      staffView: 'app',
      coinWallet: null,
      coinLedger: [],
      coinSettings: null,
    })
    // Hard redirect to "/" so the whole app remounts on the login screen — no
    // stale socket listeners, no cached query data, no chance of the deleted
    // session being re-hydrated from a tab that was open elsewhere.
    if (typeof window !== 'undefined') {
      window.location.href = '/'
    }
  },

  loadChats: async () => {
    try {
      const { chats } = await api.chats()
      set({ chats, chatsLoaded: true })
    } catch {}
  },

  loadBlockedIds: async () => {
    try {
      const { blocked } = await api.safetyList()
      const map: Record<string, boolean> = {}
      for (const u of blocked) map[u.id] = true
      set({ blockedIds: map })
    } catch {}
  },

  openChat: (peerId) => {
    set({ openPeerId: peerId })
    if (peerId) {
      void get().loadMessages(peerId).then(() => get().markReadIfOpen(peerId))
    }
  },

  closeChat: () => set({ openPeerId: null }),

  loadMessages: async (peerId) => {
    try {
      const { messages } = await api.messages(peerId)
      set((st) => ({ messages: { ...st.messages, [peerId]: messages } }))
    } catch {}
  },

  sendText: async (peerId, text) => {
    const trimmed = text.trim()
    if (!trimmed) return
    try {
      const { message } = await api.sendMessage({ to: peerId, type: 'text', content: trimmed })
      set((st) => ({ messages: { ...st.messages, [peerId]: [...(st.messages[peerId] ?? []), message] } }))
      socketClient.emit('msg:new', { to: peerId, message })
      soundKit.pop(true)
      get().loadChats()
    } catch (e) {
      throw e
    }
  },

  sendVoice: async (peerId, blob, durationSec, effect) => {
    try {
      const up = await api.uploadVoice(blob)
      const { message } = await api.sendMessage({
        to: peerId,
        type: 'voice',
        content: up.id,
        duration: durationSec,
      })
      if (effect && effect !== 'original') {
        // annotate the message locally only (effect name is cosmetic info)
        message.duration = message.duration
      }
      set((st) => ({ messages: { ...st.messages, [peerId]: [...(st.messages[peerId] ?? []), message] } }))
      socketClient.emit('msg:new', { to: peerId, message })
      get().loadChats()
    } catch (e) {
      throw e
    }
  },

  sendMedia: async (peerId, kind, blob, durationSec) => {
    try {
      const up = kind === 'image' ? await api.uploadImage(blob) : await api.uploadVideo(blob)
      const { message } = await api.sendMessage({
        to: peerId,
        type: kind,
        content: up.id,
        duration: durationSec,
      })
      set((st) => ({ messages: { ...st.messages, [peerId]: [...(st.messages[peerId] ?? []), message] } }))
      socketClient.emit('msg:new', { to: peerId, message })
      soundKit.pop(true)
      get().loadChats()
    } catch (e) {
      throw e
    }
  },

  markReadIfOpen: async (peerId) => {
    try {
      await api.markRead(peerId)
      socketClient.emit('msg:read', { to: peerId, peerId: get().me?.id })
      set((st) => ({
        chats: st.chats.map((c) => (c.peer.id === peerId ? { ...c, unread: 0 } : c)),
        messages: {
          ...st.messages,
          [peerId]: (st.messages[peerId] ?? []).map((m) => (m.mine ? m : { ...m, readAt: m.readAt ?? new Date().toISOString() })),
        },
      }))
    } catch {}
  },

  deleteMessages: async (peerId, ids, scope) => {
    if (!ids.length) return
    const now = new Date().toISOString()
    let deletedAt: string | null = null
    try {
      for (const id of ids) {
        const res = await api.deleteMessage(id, scope)
        if (res.deletedAt) deletedAt = res.deletedAt
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not delete message')
      return
    }
    set((st) => {
      if (scope === 'me') {
        const msgs = { ...st.messages, [peerId]: (st.messages[peerId] ?? []).filter((m) => !ids.includes(m.id)) }
        return { messages: msgs }
      }
      const stamp = deletedAt ?? now
      const msgs = {
        ...st.messages,
        [peerId]: (st.messages[peerId] ?? []).map((m) => (ids.includes(m.id) ? { ...m, deletedAt: stamp, content: '' } : m)),
      }
      const chats = st.chats.map((c) =>
        c.peer.id === peerId && c.lastMessage && ids.includes(c.lastMessage.id)
          ? { ...c, lastMessage: { ...c.lastMessage, deletedAt: stamp, content: '' } }
          : c,
      )
      return { messages: msgs, chats }
    })
    if (scope === 'everyone') {
      socketClient.emit('msg:deleted', { to: peerId, ids })
    }
    void get().loadChats()
  },

  forwardMessages: async (toPeerIds, msgs) => {
    for (const to of toPeerIds) {
      for (const m of msgs) {
        // call-log bubbles are not forwardable content
        if (m.type === 'call' || m.deletedAt) continue
        try {
          const { message } = await api.sendMessage({
            to,
            type: m.type,
            content: m.content,
            duration: m.duration ?? undefined,
            forwarded: true,
          })
          socketClient.emit('msg:new', { to, message })
          useApp.setState((st) => ({ messages: { ...st.messages, [to]: [...(st.messages[to] ?? []), message] } }))
        } catch (e) {
          toast.error(e instanceof Error ? e.message : `Could not forward to one recipient`)
        }
      }
    }
    void get().loadChats()
  },

  handleIncomingMessage: async (fromId, message) => {
    if (!fromId) return
    const incoming: Message = { ...message, mine: false }
    const st = get()
    const isOpen = st.openPeerId === fromId
    set((s) => {
      const msgs = { ...s.messages, [fromId]: [...(s.messages[fromId] ?? []), incoming] }
      const chats = [...s.chats]
      const idx = chats.findIndex((c) => c.peer.id === fromId)
      const payload = {
        id: message.id,
        type: message.type,
        content: message.content,
        duration: message.duration,
        createdAt: message.createdAt,
        mine: false,
        senderName: '',
      }
      if (idx >= 0) {
        const c = chats[idx]
        chats[idx] = {
          ...c,
          lastMessage: { ...payload, senderName: c.peer.name },
          lastActivity: message.createdAt,
          unread: isOpen ? 0 : c.unread + 1,
        }
        chats.unshift(...chats.splice(idx, 1))
      }
      return { messages: msgs, chats }
    })
    if (!st.chats.some((c) => c.peer.id === fromId)) void get().loadChats()
    /* MUTED / BLOCKED SUPPRESSION — WhatsApp behavior: the unread badge above
     * still increments silently, but muted chats (and blocked contacts, which
     * the server rejects anyway — guarded here too) never play the received
     * sound and never bump a desktop notification. */
    const chatRow = st.chats.find((c) => c.peer.id === fromId)
    const silent = !!chatRow?.muted || !!chatRow?.blockedMe || !!st.blockedIds[fromId]
    if (!silent) {
      soundKit.pop(false)
      const peer = chatRow?.peer
      notifyDesktop(peer?.name ?? 'New message', message.type === 'text' ? message.content : message.type === 'voice' ? 'Voice message' : 'Call log')
    }
    // DELIVERY RECEIPT — acknowledge to the sender instantly + persist server-side
    socketClient.emit('msg:delivered', { to: fromId, ids: [message.id] })
    void api.markDelivered([message.id]).catch(() => {})
    if (isOpen) void get().markReadIfOpen(fromId)
  },

  loadContacts: async () => {
    try {
      const { contacts } = await api.contacts()
      set({ contacts })
    } catch {}
  },

  addContact: async (name, phone) => {
    try {
      await api.addContact({ name, phone })
      await get().loadContacts()
      return true
    } catch {
      return false
    }
  },

  addContactByUsername: async (username) => {
    try {
      await api.addContact({ username })
      await get().loadContacts()
      return true
    } catch {
      return false
    }
  },

  syncDeviceContacts: async (list) => {
    try {
      const res = await api.syncContacts(list)
      await get().loadContacts()
      return res
    } catch {
      return null
    }
  },

  deleteContact: async (id) => {
    try {
      await api.removeContact(id)
      await get().loadContacts()
    } catch {}
  },

  loadCalls: async () => {
    try {
      const { calls } = await api.calls()
      set({ calls })
    } catch {}
  },

  startCall: (peer, type) => void callManager.startCall(peer, type),
  acceptCall: () => void callManager.acceptCall(),
  declineCall: () => callManager.declineCall(),
  hangup: () => callManager.hangup(),

  /* conferences */
  startConference: (type) => conferenceManager.createConference(type),
  conferenceInvite: (users) => conferenceManager.invite(users),
  confirmConferenceComposer: async (users) => {
    const conf = conferenceManager.snapshot().conf
    if (conf) conferenceManager.invite(users)
    else await conferenceManager.createAndInvite(get().conference.composerOpen ?? 'voice', users)
  },
  acceptConferenceInvite: () => conferenceManager.acceptInvite(),
  declineConferenceInvite: () => conferenceManager.declineInvite(),
  conferenceToggleMute: () => conferenceManager.toggleMute(),
  conferenceToggleCamera: () => conferenceManager.toggleCamera(),
  conferenceLeave: () => conferenceManager.leave(),
  conferenceEnd: () => conferenceManager.endConf(),
  openConferenceComposer: (type) => conferenceManager.openComposer(type),
  closeConferenceComposer: () => conferenceManager.closeComposer(),
  upgradeCallToConference: () => conferenceManager.upgradeFromCall(),

  loadWallet: async () => {
    try {
      const res = await api.wallet()
      set({
        wallet: res.wallet,
        walletCurrency: res.currency,
        walletLedger: res.ledger,
        walletGifts: res.gifts,
        withdrawals: res.withdrawals,
        bankAccounts: res.bankAccounts,
        coinWallet: res.coinWallet ?? null,
        coinLedger: res.coinLedger ?? [],
        coinSettings: res.coinSettings ?? null,
      })
    } catch {}
  },

  withdraw: async (amount, bankAccountId) => {
    try {
      const res = await api.requestWithdrawal(amount, bankAccountId)
      await get().loadWallet()
      return res.withdrawal
    } catch {
      return null
    }
  },

  buyCoins: async (packId, amountUsd) => {
    if (!packId && (!amountUsd || amountUsd <= 0)) {
      toast.error('Pick a coin pack or enter a USD amount')
      return null
    }
    try {
      const res = await api.coinTopup({
        packId: packId ?? undefined,
        amountUsd: amountUsd > 0 ? amountUsd : undefined,
        clientKey: `coin:${packId ?? 'custom'}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
      })
      // Stripe: the caller redirects to res.checkoutUrl; coins are credited by
      // the webhook after verified payment. Sandbox: caller opens the
      // PaymentModal; coins are credited on confirmation.
      if (res.provider === 'stripe' && res.checkoutUrl) {
        toast.loading('Opening secure checkout…', { duration: 2500 })
        if (typeof window !== 'undefined') window.location.href = res.checkoutUrl
      } else {
        toast.success(res.isTest
          ? `Test purchase — ${res.coins.toLocaleString()} coins pending verification`
          : `Purchase started — ${res.coins.toLocaleString()} coins`)
      }
      return {
        paymentId: res.paymentId,
        checkoutUrl: res.checkoutUrl,
        coins: res.coins,
        amountUsd: res.amountUsd,
        provider: res.provider,
        isTest: res.isTest,
      }
    } catch (e) {
      toast.error((e as Error).message || 'Could not start coin purchase')
      return null
    }
  },

  convertUsdToCoins: async (amountUsd) => {
    if (!amountUsd || amountUsd <= 0) {
      toast.error('Enter a USD amount to convert')
      return null
    }
    const wallet = get().wallet
    if (wallet && amountUsd > wallet.available) {
      toast.error('Amount exceeds your available USD balance')
      return null
    }
    try {
      const res = await api.coinConvert({
        amountUsd,
        clientKey: `coinconvert:${amountUsd}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
      })
      // Server returns both snapshots — apply directly (no extra round-trip).
      const prev = get().wallet
      set({
        wallet: prev
          ? { ...prev, available: res.wallet.available, reserved: res.wallet.reserved }
          : { available: res.wallet.available, reserved: res.wallet.reserved, totalReceived: res.wallet.totalReceived, totalEarned: res.wallet.totalEarned, totalWithdrawn: res.wallet.totalWithdrawn },
        coinWallet: res.coinWallet,
      })
      // Refresh the ledger lists so the convert_in entry shows up immediately.
      void get().loadWallet()
      toast.success(`Converted $${amountUsd.toFixed(2)} → ${res.coins.toLocaleString()} coins`)
      return res.coins
    } catch (e) {
      toast.error((e as Error).message || 'Conversion failed')
      return null
    }
  },

  sendGiftWithCoins: async ({ giftId, toUserId, context, roomId, liveId, battleId, battleSide }) => {
    try {
      const res = await api.giftSendCoins({
        giftId,
        toUserId,
        context,
        roomId,
        liveId,
        battleId,
        battleSide,
        clientKey: `giftn:${giftId}:${toUserId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
      })
      set({ coinWallet: res.coinWallet })
      toast.success('Sent with coins!')
      // Refresh the coin ledger so the spend line shows up.
      void get().loadWallet()
      return { sendId: res.sendId, coins: res.coinWallet.coins }
    } catch (e) {
      const msg = (e as Error).message || 'Could not send the gift'
      toast.error(msg)
      return null
    }
  },

  loadNotifications: async () => {
    try {
      const res = await api.notifications()
      set({ notifications: res.notifications, unreadNotifs: res.unread })
    } catch {}
  },

  markNotifs: async (payload) => {
    try {
      const res = await api.markNotifications(payload)
      set((st) => ({
        notifications: st.notifications.map((n) =>
          payload.all || payload.ids?.includes(n.id) ? { ...n, read: true } : n
        ),
        unreadNotifs: res.unread,
      }))
    } catch {}
  },

  pushNotification: (n) => {
    set((st) => ({
      notifications: [n, ...st.notifications].slice(0, 100),
      unreadNotifs: n.read ? st.unreadNotifs : st.unreadNotifs + 1,
    }))
    notifyDesktop(n.title, n.body || 'CALL')
  },
}))

/** Global socket wiring: presence, incoming messages, read receipts, typing, call events. */
export function bindGlobalSocketHandlers() {
  /* Session death watch: any API 401 with a stored token means the session is
   * gone (revoked / wiped DB / expired). Log out cleanly once — guarded on
   * `me` so 401s from failed login attempts never wipe the auth form state. */
  window.addEventListener('call:unauthorized', () => {
    if (useApp.getState().me) useApp.getState().logout()
  })
  callManager.bindSocket()
  roomManager.bindSocket()
  liveManager.bindSocket()
  battleManager.bindSocket()
  conferenceManager.bindSocket()
  conferenceManager.setToast((msg, opts) => {
    const kind = opts?.kind ?? 'info'
    const description = opts?.description
    if (kind === 'error') toast.error(msg, { description })
    else if (kind === 'warning') toast.warning(msg, { description })
    else toast.info(msg, { description })
  })
  callManager.setCallMessageHandler((peerId, message) => {
    // Append the call summary to my own chat and push it to the peer in realtime.
    const msg = message as Message
    useApp.setState((st) => ({
      messages: { ...st.messages, [peerId]: [...(st.messages[peerId] ?? []), msg] },
    }))
    socketClient.emit('msg:new', { to: peerId, message: msg })
  })
  socketClient.on('presence', (p) => {
    const { userId, online } = p as { userId: string; online: boolean }
    useApp.setState((st) => ({ online: { ...st.online, [userId]: online } }))
  })
  socketClient.on('presence:list', (p) => {
    const ids = (p as { ids: string[] }).ids
    const map: Record<string, boolean> = {}
    ids.forEach((id) => (map[id] = true))
    useApp.setState((st) => ({ online: { ...st.online, ...map } }))
  })
  socketClient.on('msg:incoming', (p) => {
    const { message, from } = p as { message: Message; from: string | null }
    void useApp.getState().handleIncomingMessage(from, message)
  })
  socketClient.on('msg:read', (p) => {
    const { peerId, at } = p as { peerId: string; at: string }
    useApp.setState((st) => ({
      messages: {
        ...st.messages,
        [peerId]: (st.messages[peerId] ?? []).map((m) => (m.mine ? { ...m, readAt: m.readAt ?? at } : m)),
      },
    }))
  })
  // DELIVERY receipts: the recipient's device acknowledged my messages
  socketClient.on('msg:delivered', (p) => {
    const { ids } = p as { ids: string[] }
    if (!Array.isArray(ids) || ids.length === 0) return
    const mark = (list: Message[]) => list.map((m) => (ids.includes(m.id) && m.mine ? { ...m, deliveredAt: m.deliveredAt ?? new Date().toISOString() } : m))
    const messages = useApp.getState().messages
    const next: Record<string, Message[]> = {}
    for (const [peer, list] of Object.entries(messages)) {
      if (list.some((m) => ids.includes(m.id))) next[peer] = mark(list)
    }
    if (Object.keys(next).length) useApp.setState({ messages: { ...messages, ...next } })
  })
  // UNSEND: the sender removed these messages for everyone
  socketClient.on('msg:deleted', (p) => {
    const { ids } = p as { ids: string[] }
    if (!Array.isArray(ids) || ids.length === 0) return
    const stamp = new Date().toISOString()
    useApp.setState((st) => {
      const messages: Record<string, Message[]> = {}
      for (const [peer, list] of Object.entries(st.messages)) {
        if (list.some((m) => ids.includes(m.id))) {
          messages[peer] = list.map((m) => (ids.includes(m.id) ? { ...m, deletedAt: stamp, content: '' } : m))
        }
      }
      const chats = st.chats.map((c) =>
        c.lastMessage && ids.includes(c.lastMessage.id) ? { ...c, lastMessage: { ...c.lastMessage, deletedAt: stamp, content: '' } } : c,
      )
      return { messages: { ...st.messages, ...messages }, chats }
    })
  })
  socketClient.on('typing', (p) => {
    const { peerId, isTyping } = p as { peerId: string; isTyping: boolean }
    useApp.setState((st) => ({ typing: { ...st.typing, [peerId]: isTyping } }))
    if (isTyping) {
      window.setTimeout(() => {
        useApp.setState((st) => ({ typing: { ...st.typing, [peerId]: false } }))
      }, 3000)
    }
  })
  socketClient.on('notify:incoming', (p) => {
    const n = (p as { payload: AppNotification }).payload
    if (n) useApp.getState().pushNotification(n)
  })
  socketClient.on('connect', () => {
    const me = useApp.getState().me
    if (me) socketClient.emit('register', { userId: me.id, name: me.name })
  })
  callManager.subscribe((s) => useApp.setState({ call: s }))
  conferenceManager.subscribe((s) => useApp.setState({ conference: s }))
}
