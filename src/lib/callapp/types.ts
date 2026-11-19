export interface Me {
  id: string
  name: string
  username: string
  usernameChangedAt?: string | null
  phone: string
  about: string
  avatarKey: number
  avatarUrl: string | null
  lastSeen: string
  email?: string | null
  emailVerified?: boolean
  role?: string
  isOfficial?: boolean
  allowNonContacts?: boolean
  createdAt?: string | null
  hasPassword?: boolean
}

export interface Message {
  id: string
  type: 'text' | 'voice' | 'call' | 'image' | 'video'
  content: string
  duration?: number | null
  createdAt: string
  deliveredAt?: string | null
  readAt?: string | null
  deletedAt?: string | null
  forwarded?: boolean
  mine: boolean
  mediaUrl?: string | null
}

export interface ChatSummary {
  conversationId: string
  peer: Me
  lastMessage: {
    id: string
    type: 'text' | 'voice' | 'call' | 'image' | 'video'
    content: string
    duration?: number | null
    createdAt: string
    mine: boolean
    senderName: string
    deliveredAt?: string | null
    readAt?: string | null
    deletedAt?: string | null
    forwarded?: boolean
  } | null
  unread: number
  lastActivity: string
  /* per-user conversation state + safety flags (set by GET /api/chats) */
  archived?: boolean
  muted?: boolean
  restricted?: boolean
  blocked?: boolean
  blockedMe?: boolean
}

/* ================= safety (block / restrict / report) ================= */

export interface SafetyBlockedUser {
  id: string
  name: string
  username: string
  avatarKey: number
  avatarUrl: string | null
}

export type ReportReason = 'spam' | 'harassment' | 'inappropriate' | 'scam' | 'other'

export interface AdminReportRow {
  id: string
  reporter: { id: string; name: string; username: string; blocked: boolean }
  reported: { id: string; name: string; username: string; blocked: boolean }
  reason: ReportReason
  details: string | null
  messageId: string | null
  status: 'open' | 'resolved' | 'dismissed'
  createdAt: string
}

export interface ContactItem {
  id: string
  name: string
  phone: string
  user: (Pick<Me, 'id' | 'name' | 'username' | 'about' | 'avatarKey' | 'lastSeen'> & {
    avatarUrl?: string | null
    role?: string
    isOfficial?: boolean
    allowNonContacts?: boolean
  }) | null
}

export interface CallRecord {
  id: string
  type: 'voice' | 'video'
  status: 'answered' | 'declined' | 'missed' | 'no-answer'
  outgoing: boolean
  missed: boolean
  durationSec: number
  startedAt: string
  peer: { id: string; name: string; avatarKey: number; avatarUrl: string | null; phone: string }
}

export type CallPhase = 'idle' | 'outgoing' | 'incoming' | 'connecting' | 'active' | 'ended'

/** WhatsApp-style voice→video upgrade request state for the CURRENT call */
export type VideoRequestState = 'none' | 'sent' | 'incoming'

export interface CallState {
  callId: string
  phase: CallPhase
  type: 'voice' | 'video'
  peerId: string
  peerName: string
  peerAvatarKey: number
  /** true when I placed this call (controls like "Add people" are caller-only) */
  isCaller: boolean
  muted: boolean
  cameraOn: boolean
  remoteCameraOn: boolean
  durationSec: number
  endReason?: string
  localStream?: MediaStream
  remoteStream?: MediaStream
  /** 'incoming' → peer asked me to accept video · 'sent' → I asked, waiting */
  videoRequest?: VideoRequestState
}

/* ================= wallet (REAL MONEY — no coins anywhere) ================= */

export interface WalletInfo {
  available: number
  reserved: number
  totalReceived: number
  totalEarned: number
  totalWithdrawn: number
}

export interface LedgerEntryItem {
  id: string
  kind: string
  direction: 'credit' | 'debit'
  amount: number
  availableAfter: number
  reservedAfter: number
  note: string
  refType?: string | null
  refId?: string | null
  createdAt: string
}

export interface GiftReceivedItem {
  id: string
  gift: { name: string; emoji: string; imageUrl?: string | null }
  from: { id: string; name: string; avatarKey: number; avatarUrl: string | null }
  context: string
  grossAmount: number
  commission: number
  feeAmount: number
  netAmount: number
  currency: string
  isTest: boolean
  createdAt: string
}

export interface WithdrawalItem {
  id: string
  amount: number
  currency: string
  method: string
  status: 'pending' | 'under_review' | 'approved' | 'rejected' | 'paid'
  adminNote: string
  transferRef?: string | null
  bankName?: string | null
  maskedAccount?: string | null
  createdAt: string
  paidAt?: string | null
}

export interface BankAccountItem {
  id: string
  holderName: string
  bankName: string
  accountNumber: string
  iban: string | null
  swift: string | null
  countryCode: string
  isDefault: boolean
  createdAt: string
}

export interface PaymentInfo {
  id: string
  status: 'pending' | 'successful' | 'failed' | 'cancelled' | 'refunded'
  purpose: string
  provider: string
  amount: number
  currency: string
  isTest: boolean
  giftName?: string | null
  createdAt?: string
  completedAt?: string | null
}

/* ================= gifts (direct money prices) ================= */

export interface GiftItem {
  id: string
  name: string
  emoji: string
  imageUrl: string | null
  animKind: string
  sound: string
  category: string
  priceUsd: number
  durationMs: number
  description?: string
  active?: boolean
  sortOrder?: number
  currency?: string
}

export interface GiftRecipient {
  id: string
  name: string
  avatarKey: number
  avatarUrl: string | null
  role: string
  side: number | null
  score: number
}

export interface CheckoutResult {
  ok: boolean
  paymentId: string
  amount: number
  currency: string
  provider: 'stripe' | 'sandbox'
  isTest: boolean
  checkoutUrl: string | null
  alreadyPaid?: boolean
}

export interface GiftSendResult {
  ok: boolean
  sendId: string
  gift: GiftItem
  from: { id: string; name: string; avatarKey: number; avatarUrl: string | null }
  to: { id: string; name: string; avatarKey: number; avatarUrl: string | null }
  battle: { battleId: string; side: number; added: number; total: number | null } | null
}

export interface TopGifter {
  userId: string
  name: string
  avatarKey: number
  avatarUrl: string | null
  total: number
  count: number
}

export interface GiftSessionStats {
  totals: { gross: number; commission: number; net: number; count: number }
  topGifters: TopGifter[]
  recent: Array<{
    id: string
    gift: { name: string; emoji: string }
    from: { id: string; name: string; avatarKey: number; avatarUrl: string | null }
    amount: number
    isTest: boolean
    createdAt: string
  }>
}

/* ================= stories ================= */

export interface StoryItem {
  id: string
  kind: 'photo' | 'video' | 'text' | 'voice'
  mediaUrl: string | null
  text: string | null
  overlayJson: string | null
  bgColor: string
  durationMs: number
  createdAt: string
  clipIndex: number
  groupId: string
  seen: boolean
  viewCount: number
  mine: boolean
}

export interface StoryGroup {
  userId: string
  name: string
  avatarKey: number
  avatarUrl: string | null
  mine: boolean
  allSeen: boolean
  stories: StoryItem[]
}

export interface StoryViewer {
  id: string
  name: string
  avatarKey: number
  avatarUrl: string | null
  at: string
}

export interface StoryOverlay {
  type: 'text' | 'emoji'
  text: string
  x: number // 0..1
  y: number
  size: number
  color?: string
}

/* ================= voice rooms ================= */

export interface VoiceRoomItem {
  id: string
  title: string
  description: string
  coverUrl: string | null
  isPaid: boolean
  entryFee: number
  host: { id: string; name: string; avatarKey: number; avatarUrl: string | null }
  participants: number
  createdAt: string
}

export interface RoomUserState {
  userId: string
  name: string
  avatarKey: number
  avatarUrl: string | null
  role: 'host' | 'cohost' | 'speaker' | 'listener'
  muted: boolean
  handRaised: boolean
  stageInvite?: boolean
}

export interface RoomState {
  roomId: string
  participants: RoomUserState[]
}

export interface RoomChatMsg {
  id?: string
  roomId: string
  userId: string
  name: string
  text: string
  createdAt: string
}

/* ================= live + battles ================= */

export interface LiveSessionItem {
  id: string
  title: string
  mode: string
  viewerCount: number
  peakViewers: number
  startedAt: string
  host: { id: string; name: string; avatarKey: number; avatarUrl: string | null }
  isMine: boolean
}

export interface LiveComment {
  id: string
  liveId: string
  userId: string
  name: string
  text: string
  avatarKey: number
  avatarUrl: string | null
  createdAt: string
}

export interface BattleParticipantInfo {
  userId: string
  name: string
  avatarKey: number
  avatarUrl: string | null
  side: number
  slot: number
  accepted: boolean
  score: number
}

export interface BattleInfo {
  id: string
  mode: '1v1' | '2v2'
  status: string
  winnerSide: number | null
  sideScores: number[]
  startedAt: string | null
  endsAt: string | null
  participants: BattleParticipantInfo[]
}

export interface BattleHistoryItem {
  id: string
  mode: string
  status: string
  winnerSide: number | null
  mySide: number
  won: boolean
  sideScores: number[]
  startedAt: string | null
  endedAt: string | null
  participants: Array<{ userId: string; name: string; avatarKey: number; avatarUrl: string | null; side: number; score: number }>
}

/* ================= group chats ================= */

export interface GroupMemberItem {
  id: string
  name: string
  username: string
  avatarKey: number
  avatarUrl: string | null
  role: string // owner | admin | member
}

export interface GroupMessageItem {
  id: string
  type: string // text | system | voice | image | video
  content: string
  mediaId?: string | null
  duration?: number | null
  mine: boolean
  sender: { id: string; name: string; avatarKey: number; avatarUrl: string | null }
  createdAt: string
}

export interface GroupItem {
  id: string
  name: string
  avatarKey: number
  avatarUrl?: string | null
  ownerId: string
  myRole?: string
  members: GroupMemberItem[]
  lastMessage: {
    id: string
    type: string
    content: string
    senderName: string
    mine: boolean
    createdAt: string
  } | null
  unread: number
  updatedAt: string
}

/* ================= notifications ================= */

export interface AppNotification {
  id: string
  kind: string
  title: string
  body: string
  refType?: string | null
  refId?: string | null
  read: boolean
  createdAt: string
}

/* ================= CALL AI ================= */

export interface AiMsg {
  id: string
  role: 'user' | 'assistant'
  kind: 'text' | 'image' | 'voice'
  text: string
  mediaUrl?: string | null
  createdAt: string
}

export interface AiConversationItem {
  id: string
  title: string
  messages: number
  updatedAt: string
}

/* ================= ads ================= */

export interface AdItem {
  id: string
  title: string
  body: string
  imageUrl: string | null
  linkUrl: string | null
}

export interface AdPackageItem {
  id: string
  name: string
  description: string
  priceUsd: number
  durationDays: number
  placements: string[]
  minBudget: number
}

export type AdCampaignStatus =
  | 'draft'
  | 'pending_payment'
  | 'payment_completed'
  | 'pending_approval'
  | 'approved'
  | 'active'
  | 'paused'
  | 'rejected'
  | 'completed'

export interface AdCampaignItem {
  id: string
  title: string
  body: string
  imageUrl: string | null
  mediaKind: string
  linkUrl: string | null
  placements: string[]
  pkg: { name: string; durationDays: number; priceUsd: number } | null
  budget: number
  totalCost: number
  status: AdCampaignStatus
  rejectionReason: string | null
  impressions: number
  clicks: number
  startsAt: string | null
  endsAt: string | null
  createdAt: string
}

/* ================= admin finance ================= */

export interface FinanceSummary {
  currency: string
  giftRevenue: { gross: number; platformCommission: number; providerFees: number; creatorNet: number; count: number }
  adRevenue: { total: number; fees: number; count: number }
  payments: Record<'successful' | 'pending' | 'failed' | 'refunded' | 'cancelled', { amount: number; count: number }>
  testMode: { gross: number; commission: number; net: number; count: number }
  withdrawalTotals: Record<string, { amount: number; count: number }>
  config: {
    currency: string
    platformCommission: number
    roomHostPercent: number
    paymentFeePercent: number
    paymentFeeFixed: number
    minWithdrawal: number
    withdrawalMethods: string[]
  }
}

export interface AdminPaymentRow {
  id: string
  userId: string
  user: { id: string; name: string; username: string; email: string | null }
  purpose: string
  provider: string
  status: string
  amount: number
  currency: string
  feeAmount: number
  isTest: boolean
  description: string
  createdAt: string
  completedAt: string | null
}

export interface AdminWithdrawalRow {
  id: string
  amount: number
  currency: string
  method: string
  status: 'pending' | 'under_review' | 'approved' | 'rejected' | 'paid'
  adminNote: string
  transferRef: string | null
  reviewedAt: string | null
  paidAt: string | null
  createdAt: string
  user: { id: string; name: string; phone: string; email: string | null; username: string }
  bank: { holderName: string; bankName: string; accountNumber: string; iban: string; swift: string; countryCode: string }
}

export interface BroadcastRow {
  id: string
  title: string
  body: string
  sender: { id: string; name: string; username: string; role: string; isOfficial: boolean }
  totalTargets: number
  deliveredCount: number
  failedCount: number
  status: string
  createdAt: string
}
