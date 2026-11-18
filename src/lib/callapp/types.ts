export interface Me {
  id: string
  name: string
  phone: string
  about: string
  avatarKey: number
  avatarUrl: string | null
  lastSeen: string
}

export interface Message {
  id: string
  type: 'text' | 'voice' | 'call'
  content: string
  duration?: number | null
  createdAt: string
  readAt?: string | null
  mine: boolean
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
