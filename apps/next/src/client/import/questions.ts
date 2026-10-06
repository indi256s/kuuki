// Review questions: what holds review rows back, grouped so one answer settles every row with the same cause.
// Questions are derived from the drafts on every render and never stored. An answer is an ordinary draft change, so
// a reload, another tab or an expired batch behaves exactly as it does for row edits, and an answered question is
// simply gone. Kuuki never answers for the member: suggestions are buttons, never defaults.
import type { DraftChange } from './draft-saver'
import type { Draft } from './import-types'
import { isDuplicate, lowFields, toValues, validateValues, type FieldName } from './review-model'

export type Endpoint = 'origin' | 'destination'
export interface YearQuestion { kind: 'year'; key: string; drafts: Draft[]; years: [number, number] }
export interface AirlineQuestion { kind: 'airline'; key: 'airline'; drafts: Draft[] }
export interface AirportQuestion { kind: 'airport'; key: string; options: string[]; items: { draft: Draft; endpoint: Endpoint }[] }
export interface StatusQuestion { kind: 'status'; key: 'status'; drafts: Draft[] }
export type Question = YearQuestion | AirlineQuestion | AirportQuestion | StatusQuestion

const MONTH_DAY = /^(\d{2})-(\d{2})$/
/** A day and month printed without a year, as MM-DD; null when absent or not a real day (29 February is allowed). */
export function monthDayOf(draft: Draft): { month: number; day: number } | null {
  const match = MONTH_DAY.exec(draft.fields.date_month_day ?? '')
  if (!match) return null
  const [month, day] = [Number(match[1]), Number(match[2])]
  const probe = new Date(Date.UTC(2000, month - 1, day))
  return probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day ? { month, day } : null
}

const pad = (n: number) => String(n).padStart(2, '0')
const dateIn = (year: number, { month, day }: { month: number; day: number }) => `${year}-${pad(month)}-${pad(day)}`
const realDate = (value: string) => {
  const [y, m, d] = value.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
}

const needsYear = (draft: Draft) => !draft.fields.date && !draft.yearExplicit && !draft.yearConfirmed && monthDayOf(draft) !== null
const needsAirline = (draft: Draft) => draft.fields.airline_was_placeholder === true && draft.fields.airline_iata === 'ZZ'
const optionsFor = (draft: Draft, endpoint: Endpoint) => draft.fields[`${endpoint}_options`] ?? []
const needsAirport = (draft: Draft, endpoint: Endpoint) => !draft.fields[endpoint] && optionsFor(draft, endpoint).length > 0
const needsStatus = (draft: Draft) => draft.fields.review_required === true && !draft.selected

/** Causes a question can settle, for one review row. */
export function openCauses(draft: Draft): Question['kind'][] {
  const causes: Question['kind'][] = []
  if (needsYear(draft)) causes.push('year')
  if (needsAirline(draft)) causes.push('airline')
  if (needsAirport(draft, 'origin') || needsAirport(draft, 'destination')) causes.push('airport')
  if (needsStatus(draft)) causes.push('status')
  return causes
}

/**
 * The latest year in which every given day has happened by `today` (plus two days, for a boarding pass issued the
 * day before), and the year before it. These are offered as buttons; neither is preselected.
 */
export function suggestedYears(days: { month: number; day: number }[], today: string): [number, number] {
  const limit = Date.parse(`${today}T00:00:00Z`) + 2 * 86_400_000
  let year = Number(today.slice(0, 4)) + 1
  while (days.some(day => { const value = dateIn(year, day); return !realDate(value) || Date.parse(`${value}T00:00:00Z`) > limit })) year--
  return [year, year - 1]
}

/** Days that straddle New Year (Nov–Dec with Jan–Feb) split into two questions: one year cannot be right for both. */
function splitAcrossNewYear(drafts: Draft[]): Draft[][] {
  const months = drafts.map(draft => monthDayOf(draft)!.month)
  if (!(months.some(month => month >= 11) && months.some(month => month <= 2))) return [drafts]
  return [drafts.filter(draft => monthDayOf(draft)!.month >= 7), drafts.filter(draft => monthDayOf(draft)!.month < 7)]
}

/**
 * Questions for the review rows, largest first. A single row still gets its question: one boarding pass is the common
 * case, and two year buttons beat typing a full date the document already half-printed.
 */
export function buildQuestions(drafts: Draft[], today: string): Question[] {
  const open = [...drafts].filter(draft => draft.status === 'review' && !isDuplicate(draft)).sort((a, b) => a.ordinal - b.ordinal)
  const questions: Question[] = []

  for (const group of splitAcrossNewYear(open.filter(needsYear))) {
    if (group.length === 0) continue
    const first = monthDayOf(group[0])!
    questions.push({ kind: 'year', key: `year:${pad(first.month)}`, drafts: group, years: suggestedYears(group.map(draft => monthDayOf(draft)!), today) })
  }

  const airline = open.filter(needsAirline)
  if (airline.length > 0) questions.push({ kind: 'airline', key: 'airline', drafts: airline })

  const airports = new Map<string, AirportQuestion>()
  for (const draft of open) for (const endpoint of ['origin', 'destination'] as const) {
    if (!needsAirport(draft, endpoint)) continue
    const options = optionsFor(draft, endpoint)
    const key = `airport:${[...options].sort().join(',')}`
    const question = airports.get(key) ?? { kind: 'airport' as const, key, options, items: [] }
    question.items.push({ draft, endpoint })
    airports.set(key, question)
  }
  questions.push(...airports.values())

  const status = open.filter(needsStatus)
  if (status.length > 0) questions.push({ kind: 'status', key: 'status', drafts: status })

  const size = (question: Question) => question.kind === 'airport' ? question.items.length : question.drafts.length
  return questions.sort((a, b) => size(b) - size(a))
}

/** Every review row a question touches. */
export const questionDrafts = (question: Question): Draft[] =>
  question.kind === 'airport' ? [...new Map(question.items.map(item => [item.draft.id, item.draft])).values()] : question.drafts

const REQUIRED: FieldName[] = ['date', 'origin', 'destination', 'airline_iata']

/**
 * The row is ready to import once this change lands: nothing left to ask, the shared validator accepts it, and every
 * required field the source was unsure about has now been stated by the member.
 */
function readyAfter(draft: Draft, change: DraftChange, stated: FieldName[]): boolean {
  const fields = { ...draft.fields } as Record<string, unknown>
  for (const [key, value] of Object.entries(change.fields ?? {})) { if (value === null) fields[key] = key === 'airline_iata' ? '' : undefined; else fields[key] = value }
  const after: Draft = { ...draft, fields: fields as unknown as Draft['fields'], yearConfirmed: change.yearConfirmed ?? draft.yearConfirmed }
  if (openCauses(after).length > 0) return false
  if (!after.fields.date || (!after.yearExplicit && !after.yearConfirmed)) return false
  if (Object.keys(validateValues(toValues(after.fields))).length > 0) return false
  return !lowFields(draft).some(name => REQUIRED.includes(name) && !stated.includes(name))
}

/** Select a row only when the answer made it ready; never unselect one the member chose. */
const withSelection = (draft: Draft, change: DraftChange, stated: FieldName[]): DraftChange =>
  !draft.selected && readyAfter(draft, change, stated) ? { ...change, selected: true } : change

export const answerYear = (draft: Draft, year: number): DraftChange | null => {
  const day = monthDayOf(draft)
  if (!day || !realDate(dateIn(year, day))) return null
  return withSelection(draft, { fields: { date: dateIn(year, day) }, yearConfirmed: true }, ['date'])
}

/** The flight is saved without an airline; the member can add one later in the journal. */
export const answerNoAirline = (draft: Draft): DraftChange => withSelection(draft, { fields: { airline_iata: null } }, ['airline_iata'])

export const answerAirport = (draft: Draft, endpoint: Endpoint, code: string): DraftChange =>
  withSelection(draft, { fields: { [endpoint]: code } }, [endpoint])

/** «Летал»: the member vouches for the flight, which is what the source could not. */
export const answerFlown = (): DraftChange => ({ selected: true })
/** «Не летал»: the row is skipped, and can be brought back. */
export const answerNotFlown = (): DraftChange => ({ dismissed: true })
export const answerRestore = (): DraftChange => ({ dismissed: false })
