import 'server-only'
import { readJournalAll } from '../../../../functions/api/_services/journal'
import type { JournalPayload } from '../../../../functions/api/_services/journalPayload'
import { readTransitReviewAvailability } from '../../../../functions/api/_services/transitReview'
import { getRequestEnv, getRequestIdentity } from './identity'

/** The owner's whole journal (spec D3/D4): no filters or paging, the client filters in memory. */
export async function getOwnJournalAll() {
  const identity = await getRequestIdentity()
  if (!identity) return null
  const env = await getRequestEnv()
  const data: JournalPayload = await readJournalAll(env.DB, identity.id)
  const historicalReviewAvailable = await readTransitReviewAvailability(
    env.DB,
    identity.id,
    data.flights.map((flight) => ({
      ...flight,
      arrival_transit: flight.arrival_transit === null ? null : flight.arrival_transit ? 1 : 0,
    })),
  ).catch(() => null)
  return { ownerId: identity.id, data, historicalReviewAvailable }
}
