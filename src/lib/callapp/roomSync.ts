import { db } from '@/lib/db'
import { relayToRoom, relayToUser, relayToLive, relaySend } from './relay'

/**
 * Authoritative room state sync: REST routes are the source of truth for
 * room roles/permissions. After every DB mutation these helpers push the
 * fresh participant list to the socket service (`internal:room_sync`), which
 * replaces its in-memory room map and re-broadcasts `room:state` to everyone.
 * This closes the loophole where clients could forge roles over the socket.
 */

export interface SyncParticipant {
  userId: string
  name: string
  avatarKey: number
  avatarUrl: string | null
  role: string
  muted: boolean
  handRaised: boolean
  stageInvite: boolean
}

/** Build the authoritative participant list for a room straight from the DB. */
export async function buildRoomSync(roomId: string): Promise<{ roomId: string; participants: SyncParticipant[] } | null> {
  const room = await db.voiceRoom.findUnique({ where: { id: roomId } })
  if (!room || room.status !== 'live') return null
  const parts = await db.roomParticipant.findMany({
    where: { roomId, leftAt: null },
    select: {
      userId: true,
      role: true,
      muted: true,
      handRaised: true,
      stageInvite: true,
    },
  })
  if (parts.length === 0) return { roomId, participants: [] }
  // RoomParticipant has no relation to User — resolve display info separately
  const users = await db.user.findMany({
    where: { id: { in: parts.map((p) => p.userId) } },
    select: { id: true, name: true, avatarKey: true, avatarUrl: true },
  })
  const byId = new Map(users.map((u) => [u.id, u]))
  const hostId = room.hostId
  const participants: SyncParticipant[] = parts.map((p) => ({
    userId: p.userId,
    name: byId.get(p.userId)?.name ?? '',
    avatarKey: byId.get(p.userId)?.avatarKey ?? 0,
    avatarUrl: byId.get(p.userId)?.avatarUrl ?? null,
    role: p.userId === hostId ? 'host' : p.role,
    muted: p.muted,
    handRaised: p.handRaised,
    stageInvite: p.stageInvite,
  }))
  return { roomId, participants }
}

/** Push fresh room state to the socket service + broadcast to members. */
export async function relayRoomSync(roomId: string): Promise<void> {
  const sync = await buildRoomSync(roomId)
  if (!sync) return
  await relaySend([`room:${roomId}`], 'internal:room_sync', sync)
}

/** Notify one user inside a room context (invites, kicks, requests). */
export function relayRoomUser(userId: string, event: string, data: unknown) {
  return relayToUser(userId, event, data)
}

export { relaySend, relayToRoom, relayToUser, relayToLive }
