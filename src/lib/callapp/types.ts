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
  createdAt?: string | null
}

export interface Message {
  id: string
  type: 'text' | 'voice' | 'call' | 'image'
  content: string
  duration?: number | null
  createdAt: string
  readAt?: string | null
  mine: boolean
  mediaUrl?: string | null
}

export interface ChatSummary {
  conversationId: string
  peer: Me
  lastMessage: {
    id: string
    type: 'text' | 'voice' | 'call'
    content: string
    duration?: number | null
    createdAt: string
    mine: boolean
    senderName: string
  } | null
  unread: number
  lastActivity: string
}

export interface ContactItem {
  id: string
  name: string
  phone: string
  user: Me | null
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

export interface CallState {
  callId: string
  phase: CallPhase
  type: 'voice' | 'video'
  peerId: string
  peerName: string
  peerAvatarKey: number
  muted: boolean
  cameraOn: boolean
  remoteCameraOn: boolean
  durationSec: number
  endReason?: string
  localStream?: MediaStream
  remoteStream?: MediaStream
}

/* ================= wallet ================= */

export interface WalletInfo {
  coins: number
  earnings: number
  totalTopUp: number
  totalSpent: number
  totalEarned: number
}

export interface WalletTx {
  id: string
  kind: string
  coins: number
  earnings: number
  note: string
  createdAt: string
}

export interface CoinPackage {
  id: string
  name: string
  coins: number
  bonus: number
  priceUsd: number
  active: boolean
  order: number
}

export interface Withdrawal {
  id: string
  userId: string
  amount: number
  method: string
  destination: string
  status: 'pending' | 'approved' | 'rejected'
  adminNote: string
  createdAt: string
}

/* ================= gifts ================= */

export interface GiftItem {
  id: string
  name: string
  emoji: string
  animKind: string
  sound: string
  category: string
  priceCoins: number
  earnValue: number
  durationMs: number
}

export interface GiftSendResult {
  ok: boolean
  sendId: string
  wallet: { coins: number; earnings: number }
  gift: GiftItem
  from: { id: string; name: string; avatarKey: number; avatarUrl: string | null }
  to: { id: string; name: string; avatarKey: number; avatarUrl: string | null }
  battle: { battleId: string; side: number; added: number; total: number | null } | null
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
