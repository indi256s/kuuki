import type { RowOutcome } from './confirm-runner'
import type { SaveState } from './draft-saver'
import { routeCountries, routeKm } from './flight-input'
import type { Finish } from './import-finish'
import type { Draft } from './import-types'
import {
  gapQuestions,
  questionDrafts,
  type AirportQuestion,
  type SharedQuestion,
  type YearQuestion,
} from './questions'
import { isDuplicate, withSaved, withUnsent } from './review-model'
import {
  buildRoute,
  copiesOf,
  landOutcome,
  landVisits,
  legDraft,
  legOf,
  legReady,
  stampReach,
  type Leg,
} from './route-model'
import type { SessionEntry } from './unified-session'

export interface ReviewInput {
  drafts: Draft[]
  outcomes: ReadonlyMap<string, RowOutcome>
  states: Readonly<Record<string, SaveState>>
  entries: readonly SessionEntry[]
  requiresSelection: boolean
  deferred: ReadonlySet<string>
  today: string
}

const idsOf = (entries: readonly SessionEntry[], pick: (entry: SessionEntry) => string[]) =>
  new Set(entries.flatMap(pick))

export function buildReview({
  drafts: stored,
  outcomes,
  states,
  entries,
  requiresSelection,
  deferred,
  today,
}: ReviewInput) {
  const drafts = withSaved(stored, outcomes)
  const byId = new Map(drafts.map((draft) => [draft.id, draft]))
  const suppressed = idsOf(entries, (entry) => entry.suppressedIds ?? [])
  const excluded = idsOf(entries, (entry) => entry.excludedIds ?? [])
  const landDone = idsOf(entries, (entry) => entry.landDoneIds ?? [])
  const presented = drafts.flatMap((draft) =>
    draft.status === 'review' ||
    draft.status === 'converted' ||
    (draft.status === 'dismissed' && !suppressed.has(draft.id))
      ? [legDraft(withUnsent(draft, states[draft.id]?.unsent))]
      : [],
  )
  const review = presented.filter((draft) => draft.status === 'review')
  const copies = copiesOf(presented)
  const implicit =
    review.length === 1 &&
    !isDuplicate(review[0]) &&
    !copies.has(review[0].id) &&
    !requiresSelection &&
    !excluded.has(review[0].id)
      ? review[0].id
      : null
  const legs = presented.map((draft) =>
    legOf(draft, draft.id === implicit, copies.get(draft.id) ?? null),
  )
  const legById = new Map(legs.map((leg) => [leg.id, leg]))

  const chosen: string[] = []
  let blanks = 0
  let undecided = 0
  for (const leg of legs) {
    if (leg.saved) continue
    if (leg.decision === null) undecided++
    if (leg.decision !== 'flew' || leg.draft.status !== 'review') continue
    if (legReady(leg)) chosen.push(leg.id)
    else blanks++
  }
  const visits = landVisits(legs).filter((visit) => !landDone.has(visit.id))
  const pendingLand = legs.filter(
    (leg) => leg.decision === 'land' && !leg.saved && !landDone.has(leg.id),
  )
  const recorded = legs.some((leg) => leg.saved) || landDone.size > 0

  const reviewIds = new Set(review.map((draft) => draft.id))
  const questions = gapQuestions(
    review.filter((draft) => !reviewIds.has(copies.get(draft.id) ?? '')),
    today,
  )
  const shared: SharedQuestion[] = []
  const yearOf = new Map<string, YearQuestion>()
  const airportsOf = new Map<string, AirportQuestion[]>()
  for (const question of questions) {
    if (questionDrafts(question).length >= 2 && !deferred.has(question.key)) {
      shared.push(question)
      continue
    }
    if (question.kind === 'year') {
      for (const draft of question.drafts) if (!yearOf.has(draft.id)) yearOf.set(draft.id, question)
      continue
    }
    for (const id of new Set(question.items.map((item) => item.draft.id))) {
      const list = airportsOf.get(id)
      if (list) list.push(question)
      else airportsOf.set(id, [question])
    }
  }

  return {
    drafts,
    byId,
    reviewIds,
    legs,
    legById,
    chosen,
    blanks,
    undecided,
    visits,
    pendingLand,
    landDone,
    recorded,
    shared,
    yearOf,
    airportsOf,
    route: buildRoute(legs),
    reach: stampReach(legs),
  }
}

export type Review = ReturnType<typeof buildReview>

export function finishOf({
  drafts,
  outcomes,
  landSaved,
  legs,
}: {
  drafts: Draft[]
  outcomes: ReadonlyMap<string, RowOutcome>
  landSaved: ReadonlySet<string>
  legs: readonly Leg[]
}): Omit<Finish, 'before'> {
  const saved = [...outcomes].filter(
    (entry): entry is [string, Extract<RowOutcome, { status: 'saved' }>] =>
      entry[1].status === 'saved',
  )
  const savedDrafts = withSaved(drafts, outcomes).filter((draft) => draft.status === 'converted')
  const savedIds = new Set([...saved.map(([id]) => id), ...savedDrafts.map((draft) => draft.id)])
  const touched = [
    ...new Set([
      ...savedDrafts.flatMap((draft) =>
        routeCountries(draft.fields.origin, draft.fields.destination),
      ),
      ...legs.flatMap((leg) =>
        landSaved.has(leg.id) && leg.destination.country ? [leg.destination.country] : [],
      ),
    ]),
  ]
  return {
    id: crypto.randomUUID(),
    flights: savedIds.size,
    km: savedDrafts.reduce(
      (total, draft) => total + routeKm(draft.fields.origin, draft.fields.destination),
      0,
    ),
    land: landSaved.size,
    firstFlightId: saved[0]?.[1].flightId ?? savedDrafts[0]?.convertedFlightId ?? null,
    touched,
    stamps: touched.length ? null : [],
  }
}

export const landReason = (pending: readonly Leg[]) =>
  pending.some((leg) => landOutcome(leg) === 'unknown-country') ? 'unknown-country' : 'same-country'

export type Blocked =
  | 'text'
  | 'unsent'
  | 'reading'
  | 'not-ready'
  | 'source'
  | 'same-country'
  | 'unknown-country'
  | 'nothing'

export type Completion =
  | { kind: 'save'; count: number }
  | { kind: 'finish' }
  | { kind: 'blocked'; reason: Blocked }

export interface CompletionInput {
  text: boolean
  unsent: boolean
  reading: boolean
  sourceFailed: boolean
}

export function completionOf(
  review: Pick<Review, 'chosen' | 'visits' | 'blanks' | 'recorded' | 'pendingLand'>,
  { text, unsent, reading, sourceFailed }: CompletionInput,
): Completion {
  const blocked = (reason: Blocked): Completion => ({ kind: 'blocked', reason })
  if (text) return blocked('text')
  if (unsent) return blocked('unsent')
  if (reading) return blocked('reading')
  const count = review.chosen.length + review.visits.length
  if (count > 0) return { kind: 'save', count }
  if (review.blanks) return blocked('not-ready')
  if (!review.recorded)
    return blocked(review.pendingLand.length ? landReason(review.pendingLand) : 'nothing')
  if (sourceFailed) return blocked('source')
  return { kind: 'finish' }
}

export const failedSaves = (drafts: readonly Draft[], outcomes: ReadonlyMap<string, RowOutcome>) =>
  drafts.some(
    (draft) => draft.status === 'review' && (outcomes.get(draft.id)?.status ?? 'saved') !== 'saved',
  )
