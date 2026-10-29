import { z } from 'zod'
import { overviewFilterSchema } from '@kuuki/shared/overview/filter-schema'
import type { OverviewFilter } from '@kuuki/shared/overview/model'
import { DEFAULT_ORDER } from '@kuuki/shared/overview/prefs'

const KEY = 'kuuki:airport-returns:v1'
const TTL = 24 * 60 * 60 * 1000
const markerSchema = z.strictObject({
  v: z.literal(1),
  token: z.string().uuid(),
  owner: z.string().min(1),
})
const snapshotSchema = z.strictObject({
  v: z.literal(1),
  token: z.string().uuid(),
  owner: z.string().min(1),
  createdAt: z.number().finite(),
  sourceUrl: z.string().refine((value) => /^\/overview(?:\?year=\d{4})?$/.test(value)),
  filter: overviewFilterSchema,
  category: z.enum(['airlines', 'airports', 'routes']),
  airport: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .nullable(),
  mobileChapter: z.enum(DEFAULT_ORDER).nullable(),
  pageY: z.number().finite().nonnegative(),
  sheetY: z.number().finite().nonnegative(),
  opener: z.string().regex(/^airport-[A-Z]{3}$/),
  pendingDeparture: z.boolean(),
  visited: z.boolean(),
})
export type AirportReturnSnapshot = z.infer<typeof snapshotSchema>
type ReturnUI = Pick<
  AirportReturnSnapshot,
  'category' | 'airport' | 'mobileChapter' | 'pageY' | 'sheetY'
>
const records = new Map<string, AirportReturnSnapshot>()
const listeners = new Set<() => void>()
let loaded = false
function load() {
  if (loaded || typeof window === 'undefined') return
  loaded = true
  try {
    const raw: unknown = JSON.parse(sessionStorage.getItem(KEY) ?? '[]')
    if (Array.isArray(raw))
      for (const value of raw.slice(-10)) {
        const item = snapshotSchema.safeParse(value)
        if (
          item.success &&
          Date.now() - item.data.createdAt < TTL &&
          item.data.createdAt <= Date.now()
        )
          records.set(item.data.token, item.data)
      }
  } catch {
    /* Memory remains available when session storage is blocked. */
  }
}
function persist() {
  for (const [token, item] of records) if (Date.now() - item.createdAt >= TTL) records.delete(token)
  const keep = [...records.values()].sort((a, b) => a.createdAt - b.createdAt).slice(-10)
  records.clear()
  for (const item of keep) records.set(item.token, item)
  try {
    sessionStorage.setItem(KEY, JSON.stringify(keep))
  } catch {
    /* Same-tab memory fallback. */
  }
}
function bound(owner: string, token: string | null | undefined) {
  load()
  const item = token ? records.get(token) : undefined
  return item?.owner === owner && Date.now() - item.createdAt < TTL && item.createdAt <= Date.now()
    ? item
    : null
}
function sourceMarker(owner: string) {
  if (typeof window === 'undefined' || location.pathname !== '/overview') return null
  const marker = markerSchema.safeParse(history.state?.kuukiAirportReturn)
  return marker.success && marker.data.owner === owner ? marker.data : null
}
export function captureAirportReturn(
  owner: string,
  filter: OverviewFilter,
  ui: ReturnUI,
): AirportReturnSnapshot {
  load()
  const token = crypto.randomUUID()
  const candidate = snapshotSchema.parse({
    v: 1,
    token,
    owner,
    createdAt: Date.now(),
    sourceUrl: location.pathname + location.search,
    filter,
    ...ui,
    opener: `airport-${ui.airport}`,
    pendingDeparture: true,
    visited: false,
  })
  records.set(token, candidate)
  persist()
  history.replaceState(
    { ...history.state, kuukiAirportReturn: { v: 1, token, owner } },
    '',
    location.href,
  )
  return candidate
}
export function getOverviewReturn(owner: string): AirportReturnSnapshot | null {
  const marker = sourceMarker(owner)
  const item = bound(owner, marker?.token)
  return item?.visited ? item : null
}
export const subscribeOverviewReturn = (listener: () => void) => {
  listeners.add(listener)
  window.addEventListener('popstate', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('popstate', listener)
  }
}
/** User changes update this exact source entry; Forward→Back cannot replay an older choice. */
export function updateOverviewReturn(
  owner: string,
  change: Partial<ReturnUI> & { filter?: OverviewFilter },
) {
  const item = getOverviewReturn(owner)
  if (!item) return
  if (
    Object.entries(change).every(
      ([key, value]) =>
        JSON.stringify(item[key as keyof AirportReturnSnapshot]) === JSON.stringify(value),
    )
  )
    return
  records.set(item.token, { ...item, ...structuredClone(change) })
  persist()
}
export function markAirportVisit(owner: string, token: string | null) {
  const item = bound(owner, token)
  const visit = markerSchema.safeParse(history.state?.kuukiAirportVisit)
  if (visit.success && visit.data.owner === owner && visit.data.token === token && item) return
  if (!item?.pendingDeparture) return
  records.set(item.token, { ...item, pendingDeparture: false, visited: true })
  persist()
  history.replaceState(
    { ...history.state, kuukiAirportVisit: { v: 1, owner, token } },
    '',
    location.href,
  )
}
export function airportOverviewBack(owner: string, token: string | null): boolean {
  const visit = markerSchema.safeParse(history.state?.kuukiAirportVisit)
  if (
    !visit.success ||
    visit.data.owner !== owner ||
    visit.data.token !== token ||
    !bound(owner, token)?.visited
  )
    return false
  history.back()
  return true
}
export function clearAirportReturns() {
  records.clear()
  loaded = true
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    /* No persisted records to clear. */
  }
  if (typeof window !== 'undefined') {
    const state = { ...history.state }
    delete state.kuukiAirportReturn
    delete state.kuukiAirportVisit
    delete state.kuukiAirportCompare
    history.replaceState(state, '', location.href)
  }
  for (const listener of listeners) listener()
}
