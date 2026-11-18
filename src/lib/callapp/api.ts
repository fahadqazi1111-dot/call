import type {
  AdItem,
  AiConversationItem,
  AiMsg,
  AppNotification,
  BattleHistoryItem,
  BattleInfo,
  CallRecord,
  ChatSummary,
  ContactItem,
  GiftItem,
  GiftSendResult,
  LiveComment,
  LiveSessionItem,
  Me,
  Message,
  RoomChatMsg,
  StoryGroup,
  StoryViewer,
  VoiceRoomItem,
  WalletInfo,
  WalletTx,
  Withdrawal,
  CoinPackage,
} from './types'

const TOKEN_KEY = 'call.auth.token'

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null) {
  if (typeof window === 'undefined') return
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string> | undefined),
  }
  if (!(init?.body instanceof FormData)) headers['Content-Type'] = 'application/json'
  if (token) headers['x-auth-token'] = token
  const res = await fetch(path, { ...init, headers, cache: 'no-store' })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string })?.error || `Request failed (${res.status})`)
  return data as T
}

export async function uploadFile(file: Blob, filename: string, kind: 'media' | 'avatar' | 'story' = 'media') {
  const form = new FormData()
  form.append('file', file, filename)
  form.append('kind', kind)
  return request<{ ok: boolean; id: string; mime: string }>('/api/upload', { method: 'POST', body: form })
}

export const api = {
  /* ---------- auth ---------- */
  requestOtp: (phone: string) =>
    request<{ ok: boolean; phone: string; devCode: string; expiresInSec: number }>('/api/auth/otp', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    }),
  verifyOtp: (phone: string, code: string, name?: string) =>
    request<{ ok?: boolean; needName?: boolean; token?: string; user?: Me; error?: string }>('/api/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ phone, code, name }),
    }),
  emailRequestCode: (email: string) =>
    request<{ ok: boolean; email: string; devCode: string; expiresInSec: number }>('/api/auth/email/request-code', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  emailVerify: (email: string, code: string, linkToken?: string) =>
    request<{ verified?: boolean; ok?: boolean; token?: string; user?: Me }>('/api/auth/email/verify', {
      method: 'POST',
      body: JSON.stringify({ email, code, linkToken }),
    }),
  passwordRegister: (name: string, email: string, password: string) =>
    request<{ ok: boolean; token: string; needEmailVerification: boolean }>('/api/auth/password/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    }),
  passwordLogin: (email: string, password: string) =>
    request<{ ok: boolean; token: string; user: Me }>('/api/auth/password/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  googleSignIn: (credential: string) =>
    request<{ ok: boolean; token: string; user: Me }>('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify({ credential }),
    }),
  adminBootstrap: (code: string) =>
    request<{ ok: boolean; role: string }>('/api/admin/bootstrap', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),

  /* ---------- me ---------- */
  me: () => request<{ user: Me; wallet?: { coins: number; earnings: number } }>('/api/me'),
  updateMe: (patch: { name?: string; about?: string; avatarUrl?: string | null }) =>
    request<{ user: Me }>('/api/me', { method: 'PUT', body: JSON.stringify(patch) }),

  /* ---------- chats ---------- */
  chats: () => request<{ chats: ChatSummary[] }>('/api/chats'),
  messages: (peerId: string) => request<{ peer: Me; messages: Message[] }>(`/api/chats/${peerId}/messages`),
  sendMessage: (payload: { to: string; type: 'text' | 'voice' | 'call' | 'image'; content: string; duration?: number }) =>
    request<{ message: Message }>('/api/messages', { method: 'POST', body: JSON.stringify(payload) }),
  markRead: (peerId: string) =>
    request<{ ok: boolean; updated: number }>('/api/messages/read', {
      method: 'POST',
      body: JSON.stringify({ peerId }),
    }),

  /* ---------- contacts ---------- */
  contacts: () => request<{ contacts: ContactItem[] }>('/api/contacts'),
  addContact: (name: string, phone: string) =>
    request<{ contact: ContactItem }>('/api/contacts', { method: 'POST', body: JSON.stringify({ name, phone }) }),
  deleteContact: (id: string) => request<{ ok: boolean }>(`/api/contacts?id=${id}`, { method: 'DELETE' }),
  syncContacts: (contacts: { name: string; phone: string }[]) =>
    request<{ ok: boolean; saved: number; matched: number }>('/api/contacts/sync', {
      method: 'POST',
      body: JSON.stringify({ contacts }),
    }),

  /* ---------- calls ---------- */
  calls: () => request<{ calls: CallRecord[] }>('/api/calls'),
  logCall: (payload: {
    peerId: string
    type: 'voice' | 'video'
    status: CallRecord['status']
    durationSec: number
    addMessage?: boolean
  }) =>
    request<{ ok: boolean; callId: string; message: Message | null }>('/api/calls', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  uploadVoice: async (blob: Blob) => uploadFile(blob, 'voice.webm', 'media'),
  uploadAvatar: async (blob: Blob, mime: string) => {
    const ext = mime === 'image/png' ? 'avatar.png' : mime === 'image/webp' ? 'avatar.webp' : 'avatar.jpg'
    return uploadFile(blob, ext, 'avatar')
  },
  uploadStoryMedia: async (blob: Blob, ext: string) => uploadFile(blob, `story.${ext}`, 'story'),

  /* ---------- wallet ---------- */
  wallet: () =>
    request<{ wallet: WalletInfo; txs: WalletTx[]; packages: CoinPackage[]; withdrawals: Withdrawal[] }>('/api/wallet'),
  purchaseCoins: (packageId: string) =>
    request<{ ok: boolean; wallet: { coins: number; earnings: number }; credited: number }>('/api/wallet/purchase', {
      method: 'POST',
      body: JSON.stringify({ packageId }),
    }),
  requestWithdrawal: (amount: number, method: string, destination: string) =>
    request<{ ok: boolean; withdrawal: Withdrawal }>('/api/wallet/withdraw', {
      method: 'POST',
      body: JSON.stringify({ amount, method, destination }),
    }),

  /* ---------- gifts ---------- */
  gifts: (context: 'room' | 'live') =>
    request<{ gifts: GiftItem[]; creatorEarnPercent: number }>(`/api/gifts?context=${context}`),
  sendGift: (payload: {
    giftId: string
    toUserId: string
    context: 'room' | 'live' | 'battle'
    roomId?: string
    liveId?: string
    battleId?: string
    battleSide?: number
    idempotencyKey?: string
  }) => request<GiftSendResult>('/api/gifts/send', { method: 'POST', body: JSON.stringify(payload) }),

  /* ---------- stories ---------- */
  stories: () => request<{ groups: StoryGroup[] }>('/api/stories'),
  publishStory: (payload: {
    clips: Array<{ kind: string; mediaId?: string; text?: string; overlayJson?: string; bgColor?: string; durationMs?: number }>
    privacy?: string
  }) => request<{ ok: boolean; groupId: string; clips: number }>('/api/stories', { method: 'POST', body: JSON.stringify(payload) }),
  storyView: (id: string) => request<{ ok: boolean }>(`/api/stories/${id}/view`, { method: 'POST' }),
  storyViews: (id: string) => request<{ count: number; viewers: StoryViewer[] }>(`/api/stories/${id}/views`),
  storyReact: (id: string, emoji: string) =>
    request<{ ok: boolean }>(`/api/stories/${id}/react`, { method: 'POST', body: JSON.stringify({ emoji }) }),
  deleteStory: (id: string) => request<{ ok: boolean }>(`/api/stories/${id}`, { method: 'DELETE' }),

  /* ---------- voice rooms ---------- */
  rooms: () =>
    request<{
      rooms: VoiceRoomItem[]
      settings: { maxSpeakers: number; maxEntryFee: number; allowPaidRooms: boolean }
    }>('/api/rooms'),
  createRoom: (payload: { title: string; description?: string; isPaid?: boolean; entryFee?: number }) =>
    request<{ ok: boolean; room: { id: string; title: string } }>('/api/rooms', { method: 'POST', body: JSON.stringify(payload) }),
  room: (id: string) =>
    request<{
      room: VoiceRoomItem & { status: string }
      membership: { role: string; blocked: boolean; entryPaid: boolean } | null
    }>(`/api/rooms/${id}`),
  roomEntry: (id: string) =>
    request<{ ok: boolean; charged: number; wallet?: { coins: number; earnings: number }; alreadyPaid?: boolean }>(
      `/api/rooms/${id}/entry`,
      { method: 'POST' }
    ),
  roomLeave: (id: string) => request<{ ok: boolean }>(`/api/rooms/${id}/leave`, { method: 'POST' }),
  roomEnd: (id: string) => request<{ ok: boolean }>(`/api/rooms/${id}`, { method: 'DELETE' }),
  roomMessages: (id: string) => request<{ messages: RoomChatMsg[] }>(`/api/rooms/${id}/messages?limit=50`),
  roomSendMsg: (id: string, text: string) =>
    request<{ message: RoomChatMsg }>(`/api/rooms/${id}/messages`, { method: 'POST', body: JSON.stringify({ text }) }),
  roomModerate: (id: string, action: string, targetId: string) =>
    request<{ ok: boolean }>(`/api/rooms/${id}/moderate`, { method: 'POST', body: JSON.stringify({ action, targetId }) }),

  /* ---------- live + battles ---------- */
  liveSessions: () =>
    request<{
      sessions: LiveSessionItem[]
      settings: { maxViewers: number; allowBattles: boolean; battleDurations: number[] }
    }>('/api/live'),
  createLive: (title: string, mode: string) =>
    request<{ ok: boolean; session: { id: string; mode: string } }>('/api/live', {
      method: 'POST',
      body: JSON.stringify({ title, mode }),
    }),
  liveSession: (id: string) => request<{ session: LiveSessionItem & { status: string; battleId?: string | null } }>(`/api/live/${id}`),
  liveHeartbeat: (id: string, viewerCount: number) =>
    request<{ ok: boolean }>(`/api/live/${id}`, { method: 'POST', body: JSON.stringify({ viewerCount }) }),
  liveEnd: (id: string) => request<{ ok: boolean }>(`/api/live/${id}`, { method: 'DELETE' }),
  liveComments: (id: string) => request<{ comments: LiveComment[] }>(`/api/live/${id}/comments?limit=60`),
  liveSendComment: (id: string, text: string) =>
    request<{ comment: LiveComment }>(`/api/live/${id}/comments`, { method: 'POST', body: JSON.stringify({ text }) }),
  battleInvite: (liveId: string, mode: '1v1' | '2v2', targetIds: string[], durationSec?: number) =>
    request<{ ok: boolean; battle: { id: string; mode: string; durationSec: number; status: string } }>('/api/battles/invite', {
      method: 'POST',
      body: JSON.stringify({ liveId, mode, targetIds, durationSec }),
    }),
  battleRespond: (battleId: string, accept: boolean) =>
    request<{ ok: boolean; status: string }>('/api/battles/respond', {
      method: 'POST',
      body: JSON.stringify({ battleId, accept }),
    }),
  battleFinish: (battleId: string) =>
    request<{ ok: boolean; winnerSide: number | null; sideScores: number[] }>('/api/battles/finish', {
      method: 'POST',
      body: JSON.stringify({ battleId }),
    }),
  battleHistory: () => request<{ battles: BattleHistoryItem[] }>('/api/battles'),
  battleDetail: (battleId: string) => request<{ battle: BattleInfo }>('/api/battles', { method: 'POST', body: JSON.stringify({ battleId }) }),

  /* ---------- notifications ---------- */
  notifications: (unreadOnly?: boolean) =>
    request<{ notifications: AppNotification[]; unread: number }>(`/api/notifications${unreadOnly ? '?unreadOnly=1' : ''}`),
  markNotifications: (payload: { ids?: string[]; all?: boolean }) =>
    request<{ ok: boolean; unread: number }>('/api/notifications', { method: 'POST', body: JSON.stringify(payload) }),

  /* ---------- ads ---------- */
  ads: (placement: string) => request<{ ads: AdItem[]; enabled: boolean }>(`/api/ads?placement=${placement}`),
  adEvent: (id: string, action: 'impression' | 'click') => request<{ ok: boolean }>(`/api/ads/${id}/${action}`, { method: 'POST' }),

  /* ---------- CALL AI ---------- */
  aiChat: (payload: { conversationId?: string; text: string }) =>
    request<{
      conversationId: string
      userMessage: AiMsg
      reply: AiMsg
      voiceReplies: boolean
      usageLeft: number
    }>('/api/ai/chat', { method: 'POST', body: JSON.stringify(payload) }),
  aiConversations: () => request<{ conversations: AiConversationItem[] }>('/api/ai/conversations'),
  aiConversation: (id: string) => request<{ conversation: { id: string; title: string; messages: AiMsg[] } }>(`/api/ai/conversations/${id}`),
  aiDeleteConversation: (id: string) => request<{ ok: boolean }>(`/api/ai/conversations/${id}`, { method: 'DELETE' }),
  aiImage: (payload: { prompt: string; conversationId?: string }) =>
    request<{ ok: boolean; mediaId: string; url: string; prompt: string }>('/api/ai/image', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  aiSpeak: (text: string) => request<{ ok: boolean; mediaId: string; url: string }>('/api/ai/speak', {
    method: 'POST',
    body: JSON.stringify({ text }),
  }),
  aiTranscribe: async (blob: Blob) => {
    const form = new FormData()
    form.append('file', blob, 'speech.webm')
    return request<{ ok: boolean; text: string }>('/api/ai/transcribe', { method: 'POST', body: form })
  },
  aiVision: (mediaId: string, question: string) =>
    request<{ ok: boolean; reply: string }>('/api/ai/vision', { method: 'POST', body: JSON.stringify({ mediaId, question }) }),
  aiUsage: () =>
    request<{
      usage: { text: number; image: number; voice: number }
      limits: { text: number; image: number; voice: number; voiceReplies: boolean; imageGen: boolean }
      provider: { name: string; model: string }
    }>('/api/ai/usage'),

  /* ---------- admin ---------- */
  adminSettings: () => request<{ settings: Record<string, unknown> }>('/api/admin/settings'),
  adminSaveSettings: (key: string, value: unknown) =>
    request<{ ok: boolean }>('/api/admin/settings', { method: 'PUT', body: JSON.stringify({ key, value }) }),
  adminUsers: (q?: string) => request<{ users: Array<Me & { role: string; blocked: boolean; coins: number; earnings: number }> }>(`/api/admin/users?q=${encodeURIComponent(q || '')}`),
  adminUserAction: (targetId: string, action: string, value?: number) =>
    request<{ ok: boolean }>('/api/admin/users', { method: 'POST', body: JSON.stringify({ targetId, action, value }) }),
  adminGifts: () => request<{ gifts: GiftItem[] }>('/api/admin/gifts'),
  adminGiftCreate: (payload: Partial<GiftItem>) =>
    request<{ ok: boolean }>('/api/admin/gifts', { method: 'POST', body: JSON.stringify(payload) }),
  adminGiftUpdate: (id: string, patch: Partial<GiftItem>) =>
    request<{ ok: boolean }>('/api/admin/gifts', { method: 'PUT', body: JSON.stringify({ id, ...patch }) }),
  adminGiftDelete: (id: string) => request<{ ok: boolean }>(`/api/admin/gifts?id=${id}`, { method: 'DELETE' }),
  adminPackages: () => request<{ packages: CoinPackage[] }>('/api/admin/packages'),
  adminPackageCreate: (payload: Partial<CoinPackage>) =>
    request<{ ok: boolean }>('/api/admin/packages', { method: 'POST', body: JSON.stringify(payload) }),
  adminPackageUpdate: (id: string, patch: Partial<CoinPackage>) =>
    request<{ ok: boolean }>('/api/admin/packages', { method: 'PUT', body: JSON.stringify({ id, ...patch }) }),
  adminPackageDelete: (id: string) => request<{ ok: boolean }>(`/api/admin/packages?id=${id}`, { method: 'DELETE' }),
  adminWithdrawals: (status?: string) =>
    request<{ withdrawals: Array<Withdrawal & { user: { id: string; name: string; phone: string } }> }>(
      `/api/admin/withdrawals${status ? `?status=${status}` : ''}`
    ),
  adminWithdrawalReview: (id: string, action: 'approve' | 'reject', note?: string) =>
    request<{ ok: boolean }>('/api/admin/withdrawals', { method: 'POST', body: JSON.stringify({ id, action, note }) }),
  adminModeration: () =>
    request<{
      rooms: Array<{ id: string; title: string; host: string; participants: number; isPaid: boolean; entryFee: number }>,
      lives: Array<{ id: string; title: string; host: string; viewerCount: number; mode: string }>,
      stories: Array<{ id: string; kind: string; user: string; privacy: string }>
    }>('/api/admin/moderation'),
  adminModerate: (type: 'room' | 'live' | 'story', id: string) =>
    request<{ ok: boolean }>('/api/admin/moderation', { method: 'POST', body: JSON.stringify({ type, id }) }),
  adminBroadcast: (title: string, body: string) =>
    request<{ ok: boolean; delivered: number }>('/api/admin/broadcast', { method: 'POST', body: JSON.stringify({ title, body }) }),
  adminAi: () =>
    request<{
      config: Record<string, unknown>
      auth: { googleConfigured: boolean }
      usage: { totals: { text: number; image: number; voice: number }; conversations: number; messages: number }
    }>('/api/admin/ai'),
  adminAiSave: (config: Record<string, unknown>) =>
    request<{ ok: boolean }>('/api/admin/ai', { method: 'PUT', body: JSON.stringify({ config }) }),
  adminAds: () => request<{ ads: Array<AdItem & { active: boolean; weight: number; placements: string; impressions: number; clicks: number }> }>('/api/admin/ads'),
  adminAdCreate: (payload: { title: string; body?: string; linkUrl?: string; placements?: string[]; weight?: number }) =>
    request<{ ok: boolean }>('/api/admin/ads', { method: 'POST', body: JSON.stringify(payload) }),
  adminAdUpdate: (id: string, patch: Record<string, unknown>) =>
    request<{ ok: boolean }>('/api/admin/ads', { method: 'PUT', body: JSON.stringify({ id, ...patch }) }),
  adminAdDelete: (id: string) => request<{ ok: boolean }>(`/api/admin/ads?id=${id}`, { method: 'DELETE' }),
}
