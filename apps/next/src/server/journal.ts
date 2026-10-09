import 'server-only'
import { readJournalAll } from '../../../../functions/api/_services/journal'
import type { JournalPayload } from '../../../../functions/api/_services/journalPayload'
import { getRequestEnv, getRequestIdentity } from './identity'

/** The owner's whole journal (spec D3/D4): no filters or paging, the client filters in memory. */
export async function getOwnJournalAll() {
  const identity = await getRequestIdentity()
  if (!identity) return null
  const env = await getRequestEnv()
  const data: JournalPayload = await readJournalAll(env.DB, identity.id)
  return { ownerId: identity.id, data }
}
