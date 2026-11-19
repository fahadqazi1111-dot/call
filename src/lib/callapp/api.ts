import type {
  AdCampaignItem,
  AdItem,
  AdPackageItem,
  AdminPaymentRow,
  AdminReportRow,
  AdminWithdrawalRow,
  AiConversationItem,
  AiMsg,
  AppNotification,
  BattleHistoryItem,
  BattleInfo,
  BankAccountItem,
  BroadcastRow,
  CallRecord,
  ChatSummary,
  CheckoutResult,
  ContactItem,
  FinanceSummary,
  GiftItem,
  GiftRecipient,
  GiftReceivedItem,
  GiftSendResult,
  GiftSessionStats,
  GroupItem,
  GroupMessageItem,
  LedgerEntryItem,
  LiveComment,
  LiveSessionItem,
  Me,
  Message,
  PaymentInfo,
  ReportReason,
  RoomChatMsg,
  SafetyBlockedUser,
  StoryGroup,
  StoryViewer,
  VoiceRoomItem,
  WalletInfo,
  WithdrawalItem,
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
  if (res.status === 401 && token) {
    // Session is no longer valid (revoked, wiped DB, expired). Tell the app so
    // it can log out cleanly instead of polling forever against a dead token.
    window.dispatchEvent(new CustomEvent('call:unauthorized'))
  }
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
  verifyOtp: (phone: string, code: string, name?: string, username?: string, email?: string) =>
    request<{ ok?: boolean; needName?: boolean; token?: string; user?: Me; error?: string }>('/api/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ phone, code, name, username, email }),
    }),
  usernameCheck: (username: string) =>
    request<{ ok: boolean; available: boolean; reason?: string; mine?: boolean }>(
      `/api/auth/username/check?u=${encodeURIComponent(username)}`
    ),
  authConfig: () => request<{ googleClientId: string | null; googleEnabled: boolean }>('/api/auth/config'),
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
  passwordRegister: (name: string, email: string, password: string, username: string) =>
    request<{ ok: boolean; token: string; needEmailVerification: boolean }>('/api/auth/password/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, username }),
    }),
  passwordLogin: (email: string, password: string) =>
    request<{ ok: boolean; token: string; user: Me }>('/api/auth/password/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  passwordForgot: (email: string) =>
    request<{ ok: boolean; delivered: boolean; devCode?: string }>('/api/auth/password/forgot', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  passwordReset: (email: string, code: string, newPassword: string) =>
    request<{ ok: boolean; token: string; user: Me }>('/api/auth/password/reset', {
      method: 'POST',
      body: JSON.stringify({ email, code, newPassword }),
    }),
  /** Change (or first-time set) the signed-in user's own password. */
  passwordChange: (currentPassword: string | null, newPassword: string) =>
    request<{ ok: boolean }>('/api/auth/password/change', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
  googleSignIn: (credential: string) =>
    request<{ ok: boolean; token: string; user: Me }>('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify({ credential }),
    }),

  /* ---------- team (admin panel staff management) ---------- */
  adminTeam: () =>
    request<{
      staff: Array<{ id: string; name: string; username: string; email: string; role: string; blocked: boolean; createdAt: string; lastSeen: string }>
      senders: {
        official: { id: string; name: string; username: string; role: string }
        staff: Array<{ id: string; name: string; username: string; role: string }>
      }
    }>('/api/admin/team'),
  adminTeamCreate: (payload: { name: string; email: string; password: string; role: 'admin' | 'team' }) =>
    request<{ ok: boolean }>('/api/admin/team', { method: 'POST', body: JSON.stringify(payload) }),
  adminTeamUpdate: (id: string, patch: { role?: string; password?: string }) =>
    request<{ ok: boolean }>('/api/admin/team', { method: 'PUT', body: JSON.stringify({ id, ...patch }) }),
  adminTeamRemove: (id: string) =>
    request<{ ok: boolean }>(`/api/admin/team?id=${id}`, { method: 'DELETE' }),

  /* ---------- me ---------- */
  me: () => request<{ user: Me; wallet?: { available: number; reserved: number; totalEarned: number } }>('/api/me'),
  updateMe: (patch: { name?: string; about?: string; avatarUrl?: string | null; username?: string; allowNonContacts?: boolean }) =>
    request<{ user: Me; nextChangeAt?: string }>('/api/me', { method: 'PUT', body: JSON.stringify(patch) }),

  /* ---------- chats ---------- */
  chats: () => request<{ chats: ChatSummary[] }>('/api/chats'),
  chatsArchived: () => request<{ chats: ChatSummary[] }>('/api/chats?archived=1'),
  messages: (peerId: string) => request<{ peer: Me; messages: Message[] }>(`/api/chats/${peerId}/messages`),
  deleteChat: (peerId: string) => request<{ ok: boolean }>(`/api/chats/${peerId}`, { method: 'DELETE' }),
  chatState: (peerId: string, action: 'archive' | 'unarchive' | 'mute' | 'unmute') =>
    request<{ ok: boolean }>(`/api/chats/${peerId}`, { method: 'PATCH', body: JSON.stringify({ action }) }),
  sendMessage: (payload: { to: string; type: 'text' | 'voice' | 'call' | 'image' | 'video'; content: string; duration?: number; forwarded?: boolean }) =>
    request<{ message: Message }>('/api/messages', { method: 'POST', body: JSON.stringify(payload) }),
  deleteMessage: (id: string, scope: 'everyone' | 'me') =>
    request<{ ok: boolean; scope: string; deletedAt?: string }>(`/api/messages/${id}?scope=${scope}`, { method: 'DELETE' }),
  markRead: (peerId: string) =>
    request<{ ok: boolean; updated: number }>('/api/messages/read', {
      method: 'POST',
      body: JSON.stringify({ peerId }),
    }),
  markDelivered: (ids: string[]) =>
    request<{ ok: boolean; updated: number }>('/api/messages/delivered', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    }),

  /* ---------- safety (block / restrict / report) ---------- */
  safetyBlock: (userId: string) =>
    request<{ ok: boolean }>('/api/safety/block', { method: 'POST', body: JSON.stringify({ userId }) }),
  safetyUnblock: (userId: string) =>
    request<{ ok: boolean }>('/api/safety/unblock', { method: 'POST', body: JSON.stringify({ userId }) }),
  safetyList: () => request<{ blocked: SafetyBlockedUser[] }>('/api/safety'),
  safetyRestrict: (userId: string) =>
    request<{ ok: boolean }>('/api/safety/restrict', { method: 'POST', body: JSON.stringify({ userId }) }),
  safetyUnrestrict: (userId: string) =>
    request<{ ok: boolean }>('/api/safety/unrestrict', { method: 'POST', body: JSON.stringify({ userId }) }),
  safetyReport: (payload: { userId: string; reason: ReportReason; details?: string; messageId?: string }) =>
    request<{ ok: boolean; reportId: string }>('/api/safety/report', { method: 'POST', body: JSON.stringify(payload) }),

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
  uploadImage: async (blob: Blob) => uploadFile(blob, 'photo.jpg', 'media'),
  uploadVideo: async (blob: Blob) => uploadFile(blob, 'video.webm', 'media'),
  uploadAvatar: async (blob: Blob, mime: string) => {
    const ext = mime === 'image/png' ? 'avatar.png' : mime === 'image/webp' ? 'avatar.webp' : 'avatar.jpg'
    return uploadFile(blob, ext, 'avatar')
  },
  uploadStoryMedia: async (blob: Blob, ext: string) => uploadFile(blob, `story.${ext}`, 'story'),

  /* ---------- wallet (REAL MONEY — direct payments, no coins) ---------- */
  wallet: () =>
    request<{
      wallet: WalletInfo
      currency: string
      minWithdrawal: number
      withdrawalMethods: string[]
      provider: { id: string; isTest: boolean }
      ledger: LedgerEntryItem[]
      gifts: GiftReceivedItem[]
      withdrawals: WithdrawalItem[]
      bankAccounts: BankAccountItem[]
    }>('/api/wallet'),
  bankAccounts: () => request<{ accounts: BankAccountItem[] }>('/api/wallet/bank'),
  addBankAccount: (payload: {
    holderName: string
    bankName: string
    accountNumber: string
    iban?: string
    swift?: string
    countryCode: string
    isDefault?: boolean
  }) => request<{ ok: boolean; account: BankAccountItem }>('/api/wallet/bank', { method: 'POST', body: JSON.stringify(payload) }),
  deleteBankAccount: (id: string) =>
    request<{ ok: boolean }>(`/api/wallet/bank?id=${id}`, { method: 'DELETE' }),
  requestWithdrawal: (amount: number, bankAccountId: string) =>
    request<{ ok: boolean; withdrawal: { id: string; amount: number; status: string } }>('/api/wallet/withdraw', {
      method: 'POST',
      body: JSON.stringify({ amount, bankAccountId }),
    }),
  paymentStatus: (paymentId: string) =>
    request<{ payment: PaymentInfo }>(`/api/payments/${paymentId}`),
  confirmSandboxPayment: (paymentId: string) =>
    request<{ ok: boolean; status: string }>(`/api/payments/${paymentId}/confirm`, { method: 'POST' }),

  /* ---------- gifts (direct money purchase flow) ---------- */
  gifts: (context: 'room' | 'live') =>
    request<{ gifts: GiftItem[]; platformCommission: number; currency: string }>(`/api/gifts?context=${context}`),
  giftRecipients: (query: { context: 'room' | 'live' | 'battle'; roomId?: string; liveId?: string; battleId?: string; battleSide?: number }) => {
    const qs = new URLSearchParams({ context: query.context })
    if (query.roomId) qs.set('roomId', query.roomId)
    if (query.liveId) qs.set('liveId', query.liveId)
    if (query.battleId) qs.set('battleId', query.battleId)
    if (typeof query.battleSide === 'number') qs.set('battleSide', String(query.battleSide))
    return request<{ recipients: GiftRecipient[] }>(`/api/gifts/recipients?${qs.toString()}`)
  },
  giftStats: (query: { roomId?: string; liveId?: string }) =>
    request<GiftSessionStats>(`/api/gifts/top?${query.roomId ? `roomId=${query.roomId}` : `liveId=${query.liveId}`}`),
  giftCheckout: (payload: {
    giftId: string
    toUserId: string
    context: 'room' | 'live' | 'battle'
    roomId?: string
    liveId?: string
    battleId?: string
    battleSide?: number
    clientKey?: string
  }) => request<CheckoutResult>('/api/gifts/checkout', { method: 'POST', body: JSON.stringify(payload) }),
  /** send a gift by spending wallet balance — instant, no card checkout */
  giftSendWallet: (payload: {
    giftId: string
    toUserId: string
    context: 'room' | 'live' | 'battle'
    roomId?: string
    liveId?: string
    battleId?: string
    battleSide?: number
    clientKey?: string
  }) =>
    request<{ ok: boolean; sendId: string | null; alreadyProcessed: boolean; wallet: { available: number } }>(
      '/api/gifts/send-wallet',
      { method: 'POST', body: JSON.stringify(payload) }
    ),

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
    request<{
      ok: boolean
      charged?: number
      alreadyPaid?: boolean
      host?: boolean
      needsPayment?: boolean
      amount?: number
      currency?: string
      paymentId?: string
      provider?: 'stripe' | 'sandbox'
      isTest?: boolean
      checkoutUrl?: string | null
      error?: string
    }>(`/api/rooms/${id}/entry`, { method: 'POST' }),
  roomEntryState: (id: string) =>
    request<{ entryPaid: boolean; entryFee?: number; isHost?: boolean }>(`/api/rooms/${id}/entry`),
  roomLeave: (id: string) => request<{ ok: boolean }>(`/api/rooms/${id}/leave`, { method: 'POST' }),
  roomEnd: (id: string) => request<{ ok: boolean }>(`/api/rooms/${id}`, { method: 'DELETE' }),
  roomMessages: (id: string) => request<{ messages: RoomChatMsg[] }>(`/api/rooms/${id}/messages?limit=50`),
  roomSendMsg: (id: string, text: string) =>
    request<{ message: RoomChatMsg }>(`/api/rooms/${id}/messages`, { method: 'POST', body: JSON.stringify({ text }) }),
  roomModerate: (id: string, action: string, targetId: string) =>
    request<{ ok: boolean }>(`/api/rooms/${id}/moderate`, { method: 'POST', body: JSON.stringify({ action, targetId }) }),
  roomStage: (id: string, action: string, extra?: Record<string, unknown>) =>
    request<{ ok: boolean }>(`/api/rooms/${id}/stage`, { method: 'POST', body: JSON.stringify({ action, ...extra }) }),

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
  battleTap: (battleId: string, side: number) =>
    request<{ ok: boolean; side: number; total: number }>('/api/battles/tap', {
      method: 'POST',
      body: JSON.stringify({ battleId, side }),
    }),
  liveViewers: (id: string) =>
    request<{ viewers: Array<{ userId: string; name: string; avatarKey: number; avatarUrl: string | null }> }>(
      `/api/live/${id}/viewers`
    ),
  searchUsers: (q: string) =>
    request<{ users: Array<{ id: string; name: string; username: string; avatarKey: number; avatarUrl: string | null; role?: string; isOfficial?: boolean }> }>(
      `/api/users/search?q=${encodeURIComponent(q)}`
    ),
  appConfig: () => request<{ splashEnabled: boolean }>('/api/config'),

  /* ---------- group chats ---------- */
  groups: () => request<{ groups: GroupItem[] }>('/api/groups'),
  createGroup: (name: string, memberIds: string[], avatarUrl?: string | null) =>
    request<{ group: GroupItem }>('/api/groups', { method: 'POST', body: JSON.stringify({ name, memberIds, avatarUrl }) }),
  groupUpdate: (id: string, patch: { name?: string; avatarUrl?: string | null }) =>
    request<{ ok: boolean; name: string; avatarUrl: string | null }>(`/api/groups/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  groupDetail: (id: string) => request<{ group: GroupItem & { myRole: string }; messages: GroupMessageItem[] }>(`/api/groups/${id}`),
  groupMessages: (id: string, before?: string) =>
    request<{ messages: GroupMessageItem[] }>(
      `/api/groups/${id}/messages${before ? `?before=${encodeURIComponent(before)}` : ''}`
    ),
  groupSend: (
    id: string,
    payload: { type: 'text' | 'voice' | 'image' | 'video'; content?: string; mediaId?: string; duration?: number }
  ) =>
    request<{ message: GroupMessageItem }>(`/api/groups/${id}/messages`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  groupAddMembers: (id: string, memberIds: string[]) =>
    request<{ ok: boolean; added: number }>(`/api/groups/${id}/members`, { method: 'POST', body: JSON.stringify({ memberIds }) }),
  groupSetRole: (id: string, userId: string, role: 'admin' | 'member') =>
    request<{ ok: boolean; role: string }>(`/api/groups/${id}/members`, { method: 'PATCH', body: JSON.stringify({ userId, role }) }),
  groupLeave: (id: string) =>
    request<{ ok: boolean; dissolved: boolean; newOwner?: string }>(`/api/groups/${id}`, { method: 'DELETE' }),

  /* ---------- notifications ---------- */
  notifications: (unreadOnly?: boolean) =>
    request<{ notifications: AppNotification[]; unread: number }>(`/api/notifications${unreadOnly ? '?unreadOnly=1' : ''}`),
  markNotifications: (payload: { ids?: string[]; all?: boolean }) =>
    request<{ ok: boolean; unread: number }>('/api/notifications', { method: 'POST', body: JSON.stringify(payload) }),

  /* ---------- ads (serving + USER CAMPAIGNS) ---------- */
  ads: (placement: string, exclude?: string[]) => {
    const q = new URLSearchParams({ placement })
    if (exclude?.length) q.set('exclude', exclude.join(','))
    return request<{ ads: AdItem[]; enabled: boolean; chatAd?: { firstAfter: number; interval: number } }>(
      `/api/ads?${q.toString()}`
    )
  },
  adEvent: (id: string, action: 'impression' | 'click', viewerKey?: string) =>
    request<{ ok: boolean; counted?: boolean }>(`/api/ads/${id}/${action}`, {
      method: 'POST',
      body: JSON.stringify({ viewerKey: viewerKey || undefined }),
    }),
  adAnalytics: () =>
    request<{
      totals: { impressions: number; clicks: number; ctr: number; spend: number; activeCampaigns: number; campaigns: number }
      campaigns: Array<{
        id: string
        title: string
        status: string
        placements: string
        budget: number
        totalCost: number
        impressions: number
        clicks: number
        ctr: number
        startsAt: string | null
        endsAt: string | null
        createdAt: string
        rejectionReason: string | null
        last14Days: { impressions: number; clicks: number }
      }>
      daily: Array<{ day: string; impressions: number; clicks: number }>
    }>('/api/ads/analytics'),
  adPackages: () => request<{ packages: AdPackageItem[] }>('/api/ads/packages'),
  adCampaigns: () =>
    request<{ campaigns: AdCampaignItem[]; payments: Array<{ id: string; status: string; amount: number; isTest: boolean; createdAt: string }> }>(
      '/api/ads/campaigns'
    ),
  adCampaignCreate: (payload: {
    title: string
    body?: string
    imageUrl?: string
    mediaKind?: 'image' | 'video'
    linkUrl?: string
    placements?: string[]
    packageId: string
    budget?: number
    clientKey?: string
  }) =>
    request<{
      ok: boolean
      campaign: { id: string; title: string; totalCost: number }
      paymentId: string
      amount: number
      provider: 'stripe' | 'sandbox'
      isTest: boolean
      checkoutUrl: string | null
    }>('/api/ads/campaigns', { method: 'POST', body: JSON.stringify(payload) }),

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
    request<{ ok: boolean; mediaId: string; url: string; prompt: string; conversationId?: string }>('/api/ai/image', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  aiSpeak: (text: string, init?: { signal?: AbortSignal }) =>
    request<{ ok: boolean; mediaId: string; url: string }>('/api/ai/speak', {
      method: 'POST',
      body: JSON.stringify({ text }),
      signal: init?.signal,
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
  adminSmtpTest: (config?: Record<string, unknown>, to?: string) =>
    request<{ ok: boolean; to?: string; message?: string }>('/api/admin/settings/smtp/test', {
      method: 'POST',
      body: JSON.stringify({ config, to }),
    }),
  adminUsers: (q?: string) =>
    request<{
      users: Array<{
        id: string
        name: string
        username: string
        phone: string
        email: string | null
        role: string
        blocked: boolean
        createdAt: string
        lastSeen: string
        available: number
        reserved: number
        totalEarned: number
        totalWithdrawn: number
      }>
    }>(`/api/admin/users?q=${encodeURIComponent(q || '')}`),
  adminUserAction: (targetId: string, action: string, value?: number, note?: string) =>
    request<{ ok: boolean }>('/api/admin/users', { method: 'POST', body: JSON.stringify({ targetId, action, value, note }) }),
  adminGifts: () => request<{ gifts: GiftItem[] }>('/api/admin/gifts'),
  adminGiftCreate: (payload: Partial<GiftItem> & { androidProduct?: string; iosProduct?: string; description?: string }) =>
    request<{ ok: boolean }>('/api/admin/gifts', { method: 'POST', body: JSON.stringify(payload) }),
  adminGiftUpdate: (id: string, patch: Partial<GiftItem> & { androidProduct?: string; iosProduct?: string }) =>
    request<{ ok: boolean }>('/api/admin/gifts', { method: 'PUT', body: JSON.stringify({ id, ...patch }) }),
  adminGiftDelete: (id: string) => request<{ ok: boolean }>(`/api/admin/gifts?id=${id}`, { method: 'DELETE' }),
  adminFinance: (filters?: { from?: string; to?: string; purpose?: string; provider?: string; status?: string; userId?: string }) => {
    const qs = new URLSearchParams()
    if (filters?.from) qs.set('from', filters.from)
    if (filters?.to) qs.set('to', filters.to)
    if (filters?.purpose) qs.set('purpose', filters.purpose)
    if (filters?.provider) qs.set('provider', filters.provider)
    if (filters?.status) qs.set('status', filters.status)
    if (filters?.userId) qs.set('userId', filters.userId)
    return request<{ summary: FinanceSummary; transactions: AdminPaymentRow[] }>(`/api/admin/finance?${qs.toString()}`)
  },
  adminBalanceAdjust: (userId: string, amount: number, note?: string) =>
    request<{ ok: boolean }>('/api/admin/finance', { method: 'POST', body: JSON.stringify({ userId, amount, note }) }),
  adminWithdrawals: (status?: string) =>
    request<{ withdrawals: AdminWithdrawalRow[] }>(`/api/admin/withdrawals${status ? `?status=${status}` : ''}`),
  adminWithdrawalReview: (id: string, action: 'under_review' | 'approve' | 'reject' | 'paid', note?: string, transferRef?: string) =>
    request<{ ok: boolean; status: string }>('/api/admin/withdrawals', {
      method: 'POST',
      body: JSON.stringify({ id, action, note, transferRef }),
    }),
  adminModeration: () =>
    request<{
      rooms: Array<{ id: string; title: string; host: string; participants: number; isPaid: boolean; entryFee: number }>,
      lives: Array<{ id: string; title: string; host: string; viewerCount: number; mode: string }>,
      stories: Array<{ id: string; kind: string; user: string; privacy: string }>,
      reports: AdminReportRow[]
    }>('/api/admin/moderation'),
  adminModerate: (type: 'room' | 'live' | 'story' | 'report', id: string, action?: 'resolve' | 'dismiss' | 'ban', note?: string) =>
    request<{ ok: boolean }>('/api/admin/moderation', {
      method: 'POST',
      body: JSON.stringify({ type, id, action, note }),
    }),
  adminBroadcasts: () => request<{ broadcasts: BroadcastRow[] }>('/api/admin/broadcast'),
  adminBroadcast: (title: string, body: string, senderId?: string) =>
    request<{ ok: boolean; broadcastId: string; delivered: number; failed: number; total: number; senderName: string }>('/api/admin/broadcast', {
      method: 'POST',
      body: JSON.stringify({ title, body, senderId }),
    }),
  adminBroadcastRetry: (broadcastId: string) =>
    request<{ ok: boolean; fixed: number; deliveredCount: number; failedCount: number }>('/api/admin/broadcast', {
      method: 'POST',
      body: JSON.stringify({ action: 'retry', broadcastId }),
    }),
  adminAi: () =>
    request<{
      config: Record<string, unknown>
      auth: { googleConfigured: boolean }
      usage: { totals: { text: number; image: number; voice: number }; conversations: number; messages: number }
    }>('/api/admin/ai'),
  adminAiSave: (config: Record<string, unknown>) =>
    request<{ ok: boolean }>('/api/admin/ai', { method: 'PUT', body: JSON.stringify({ config }) }),
  adminAds: () =>
    request<{
      ads: Array<{
        id: string
        title: string
        body: string
        imageUrl: string | null
        linkUrl: string | null
        mediaKind: string
        placements: string
        status: string
        isUserAd: boolean
        owner: { id: string; name: string; username: string; email: string | null } | null
        pkg: { id: string; name: string; durationDays: number; priceUsd: number } | null
        budget: number
        totalCost: number
        paymentId: string | null
        rejectionReason: string | null
        impressions: number
        clicks: number
        startsAt: string | null
        endsAt: string | null
        createdAt: string
      }>
    }>('/api/admin/ads'),
  adminAdCreate: (payload: { title: string; body?: string; linkUrl?: string; placements?: string[]; weight?: number }) =>
    request<{ ok: boolean }>('/api/admin/ads', { method: 'POST', body: JSON.stringify(payload) }),
  adminAdUpdate: (id: string, patch: Record<string, unknown>) =>
    request<{ ok: boolean }>('/api/admin/ads', { method: 'PUT', body: JSON.stringify({ id, ...patch }) }),
  adminAdAction: (id: string, action: 'approve' | 'reject' | 'activate' | 'pause' | 'complete', reason?: string) =>
    request<{ ok: boolean; status: string }>('/api/admin/ads', {
      method: 'PUT',
      body: JSON.stringify({ id, action, reason }),
    }),
  adminAdDelete: (id: string) => request<{ ok: boolean }>(`/api/admin/ads?id=${id}`, { method: 'DELETE' }),
  adminAdPackages: () => request<{ packages: Array<{ id: string; name: string; description: string; priceUsd: number; durationDays: number; placements: string; minBudget: number; order: number; active: boolean }> }>(
    '/api/admin/adpackages'
  ),
  adminAdPackageCreate: (payload: Record<string, unknown>) =>
    request<{ ok: boolean }>('/api/admin/adpackages', { method: 'POST', body: JSON.stringify(payload) }),
  adminAdPackageUpdate: (id: string, patch: Record<string, unknown>) =>
    request<{ ok: boolean }>('/api/admin/adpackages', { method: 'PUT', body: JSON.stringify({ id, ...patch }) }),
  adminAdPackageDelete: (id: string) =>
    request<{ ok: boolean }>(`/api/admin/adpackages?id=${id}`, { method: 'DELETE' }),
}
