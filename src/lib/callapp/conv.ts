import { db } from '@/lib/db'

/** Return the 1:1 conversation for a pair of users, creating it on demand. Pair is stored sorted. */
export async function getOrCreateConversation(aId: string, bId: string) {
  const [userAId, userBId] = aId < bId ? [aId, bId] : [bId, aId]
  return db.conversation.upsert({
    where: { userAId_userBId: { userAId, userBId } },
    update: {},
    create: { userAId, userBId },
  })
}
