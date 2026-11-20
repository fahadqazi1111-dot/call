/** Types shared by the conference mesh client (conferenceManager) and its UI. */

export interface ConfParticipant {
  userId: string
  name: string
  avatarKey: number
  avatarUrl: string | null
  muted: boolean
  cameraOn: boolean
  /** true while the WebRTC peer connection to this user is not yet connected */
  connecting: boolean
}

export interface ConfSession {
  id: string
  type: 'voice' | 'video'
  /** server-enforced capacity (admin-configurable, clamped 2..12) */
  max: number
  hostId: string
  createdAt: number
  participants: ConfParticipant[]
}

export interface ConfInviteUser {
  id: string
  name: string
  avatarKey: number
  avatarUrl: string | null
}

export interface ConfIncoming {
  confId: string
  from: ConfInviteUser
  inviterName: string
  type: 'voice' | 'video'
  memberCount: number
}

export interface ConferenceSnapshot {
  conf: ConfSession | null
  phase: 'idle' | 'invited' | 'active'
  /** remote MediaStreams keyed by userId */
  streams: Record<string, MediaStream>
  muted: boolean
  cameraOn: boolean
  /** incoming ring state (ConferenceInviteUI) */
  invite: ConfIncoming | null
  /** capacity default used by the composer before the first conf:state */
  maxParticipants: number
  /** invite sheet host: 'voice' | 'video' when open, null when closed */
  composerOpen: 'voice' | 'video' | null
}
