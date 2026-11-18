'use client'

import { create } from 'zustand'
import { api, setToken as persistToken } from './api'
import { socketClient } from './socket'
import { callManager } from './callManager'
import { roomManager } from './roomManager'
import { liveManager, battleManager } from './liveManager'
import { soundKit } from './sound'
import type {
  AppNotification,
  CallRecord,
  CallState,
  ChatSummary,
  ContactItem,
  Me,
  Message,
  WalletInfo,
  WalletTx,
  Withdrawal,
  CoinPackage,
} from './types'

export type AppPhase = 'splash' | 'onboarding' | 'auth' | 'main'
export type AppTab = 'chats' | 'calls' | 'rooms' | 'live' | 'contacts' | 'profile'
export type AppOverlay = 'ai' | 'admin' | 'notifications' | 'wallet' | 'story-composer' | null
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
  booted: boolean
  chatsLoaded: boolean

  wallet: WalletInfo | null
  walletTxs: WalletTx[]
  packages: CoinPackage[]
  withdrawals: Withdrawal[]
  notifications: AppNotification[]
  unreadNotifs: number

  setPhase: (p: AppPhase) => void
  setTab: (t: AppTab) => void
  setOverlay: (o: AppOverlay) => void
  setStaffView: (v: StaffView) => void
  bootstrap: () => Promise<void>
  loginSuccess: (token: string, user: Me) => void
  updateMe: (patch: { name?: string; about?: string; avatarUrl?: string | null; username?: string }) => Promise<void>
  updateAvatar: (blob: Blob, mime: string) => Promise<void>
  logout: () => void

  loadChats: () => Promise<void>
  openChat: (peerId: string | null) => void
  closeChat: () => void
  loadMessages: (peerId: string) => Promise<void>
  sendText: (peerId: string, text: string) => Promise<void>
  sendVoice: (peerId: string, blob: Blob, durationSec: number, effect?: string) => Promise<void>
  markReadIfOpen: (peerId: string) => Promise<void>
  handleIncomingMessage: (fromId: string | null, message: Message) => Promise<void>

  loadContacts: () => Promise<void>
  addContact: (name: string, phone: string) => Promise<boolean>
  syncDeviceContacts: (list: { name: string; phone: string }[]) => Promise<{ saved: number; matched: number } | null>
  deleteContact: (id: string) => Promise<void>

  loadCalls: () => Promise<void>
  startCall: (peer: { id: string; name: string; avatarKey: number }, type: 'voice' | 'video') => void
  acceptCall: () => void
  declineCall: () => void
  hangup: () => void

  loadWallet: () => Promise<void>
  purchase: (packageId: string) => Promise<{ ok: boolean; credited: number }>
  withdraw: (amount: number, method: string, destination: string) => Promise<Withdrawal | null>

  loadNotifications: () => Promise<void>
  markNotifs: (payload: { ids?: string[]; all?: boolean }) => Promise<void>
  pushNotification: (n: AppNotification) => void
}

export const useApp = create<AppState>((set, get) => ({
  phase: 'splash',
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
  booted: false,
  chatsLoaded: false,

  wallet: null,
  walletTxs: [],
  packages: [],
  withdrawals: [],
  notifications: [],
  unreadNotifs: 0,

  setPhase: (p) => set({ phase: p }),
  setTab: (t) => set({ tab: t }),
  setOverlay: (o) => set({ overlay: o }),
  setStaffView: (v) => set({ staffView: v, openPeerId: null }),

  bootstrap: async () => {
    const s = loadSession()
    if (!s) {
      set({ phase: 'onboarding', booted: true })
      return
    }
    try {
      persistToken(s.token)
      const { user, wallet } = await api.me()
      const staff = user.role === 'admin' || user.role === 'team'
      set({
        token: s.token,
        me: user,
        phase: 'main',
        booted: true,
        wallet: wallet ?? null,
        staffView: staff ? 'console' : 'app',
      })
      socketClient.connect(user.id, user.name)
      callManager.setMe({ id: user.id, name: user.name })
      void get().loadChats()
      void get().loadContacts()
      void get().loadCalls()
      void get().loadNotifications()
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
    void get().loadChats()
    void get().loadContacts()
    void get().loadCalls()
    void get().loadWallet()
    void get().loadNotifications()
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

  logout: () => {
    if (get().call) callManager.hangup()
    void roomManager.leave(true)
    void liveManager.leave(true)
    callManager.setMe(null)
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
      walletTxs: [],
      packages: [],
      withdrawals: [],
      notifications: [],
      unreadNotifs: 0,
      overlay: null,
      staffView: 'app',
    })
  },

  loadChats: async () => {
    try {
      const { chats } = await api.chats()
      set({ chats, chatsLoaded: true })
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
    soundKit.pop(false)
    const peer = st.chats.find((c) => c.peer.id === fromId)?.peer
    notifyDesktop(peer?.name ?? 'New message', message.type === 'text' ? message.content : message.type === 'voice' ? 'Voice message' : 'Call log')
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
      await api.addContact(name, phone)
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
      await api.deleteContact(id)
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

  loadWallet: async () => {
    try {
      const res = await api.wallet()
      set({
        wallet: res.wallet,
        walletTxs: res.txs,
        packages: res.packages,
        withdrawals: res.withdrawals,
      })
    } catch {}
  },

  purchase: async (packageId) => {
    try {
      const res = await api.purchaseCoins(packageId)
      await get().loadWallet()
      return { ok: true, credited: res.credited }
    } catch (e) {
      return { ok: false, credited: 0, error: (e as Error).message }
    }
  },

  withdraw: async (amount, method, destination) => {
    try {
      const res = await api.requestWithdrawal(amount, method, destination)
      await get().loadWallet()
      return res.withdrawal
    } catch {
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
  callManager.bindSocket()
  roomManager.bindSocket()
  liveManager.bindSocket()
  battleManager.bindSocket()
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
}
