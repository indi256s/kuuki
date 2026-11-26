import { addGroundVisit, updateGroundVisit } from '@kuuki/client/passport'
import type { LandVisit } from './route-model'

const AT_ONCE = 4

type Recorded = Awaited<ReturnType<typeof addGroundVisit>>

export interface LandVisitApi {
  add: typeof addGroundVisit
  update: typeof updateGroundVisit
}

const passport: LandVisitApi = { add: addGroundVisit, update: updateGroundVisit }

export async function recordLandVisit(
  ownerId: string,
  visit: LandVisit,
  api: LandVisitApi = passport,
): Promise<Recorded> {
  const stored = await api.add(
    ownerId,
    visit.countryCode,
    { visitYear: visit.visitYear, entryMethod: 'land' },
    visit.id,
  )
  if (stored.visitYear === visit.visitYear) return stored
  return api.update(ownerId, visit.id, { visitYear: visit.visitYear })
}

export async function recordLandVisits(
  ownerId: string,
  visits: readonly LandVisit[],
  onRecorded: (id: string) => void,
  api: LandVisitApi = passport,
): Promise<PromiseSettledResult<Recorded>[]> {
  const results: PromiseSettledResult<Recorded>[] = []
  let next = 0
  const worker = async () => {
    while (next < visits.length) {
      const index = next++
      try {
        const value = await recordLandVisit(ownerId, visits[index], api)
        onRecorded(visits[index].id)
        results[index] = { status: 'fulfilled', value }
      } catch (reason) {
        results[index] = { status: 'rejected', reason }
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(AT_ONCE, visits.length) }, worker))
  return results
}
