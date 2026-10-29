import { type MakerKey } from '../../../data/src/aircraft-makers'
import { z } from 'zod'
import { overviewFilterSchema as filterSchema } from './filter-schema'
import type { OverviewFilter } from './model'

export const DEFAULT_ORDER = [
  'rankings',
  'routes',
  'records',
  'crossings',
  'rhythm',
  'clock',
  'aircraft',
] as const
const section = z.enum(DEFAULT_ORDER)
export type SectionId = z.infer<typeof section>
export interface OverviewPrefs {
  version: 1
  filter: OverviewFilter
  layout: { order: SectionId[]; hidden: SectionId[] }
  replayPaused: boolean
  publicSections: { records: boolean; fleet: boolean }
}
export const DEFAULT_PREFS: OverviewPrefs = {
  version: 1,
  filter: {},
  layout: { order: [...DEFAULT_ORDER], hidden: [] },
  replayPaused: false,
  publicSections: { records: false, fleet: false },
}

const sections = z.array(section).refine((values) => new Set(values).size === values.length)
export const overviewPrefsSchema = z.strictObject({
  version: z.literal(1),
  filter: filterSchema,
  layout: z.strictObject({ order: sections, hidden: sections }),
  replayPaused: z.boolean(),
  publicSections: z.strictObject({ records: z.boolean(), fleet: z.boolean() }),
})

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
function field<T>(schema: z.ZodType<T>, value: unknown, fallback: T): T {
  const parsed = schema.safeParse(value)
  return parsed.success ? parsed.data : fallback
}

// Section ids retired by Overview cards v2, mapped to the card that absorbed them.
const LEGACY_SECTIONS: Record<string, SectionId> = {
  fleet: 'aircraft',
  manufacturers: 'aircraft',
  timeline: 'rhythm',
}
// Cards a merged id replaced in a pre-v2 layout.
const REPLACED: Partial<Record<SectionId, string[]>> = {
  aircraft: ['fleet', 'manufacturers'],
  rhythm: ['rhythm', 'timeline'],
}

export function normalizeLayout(raw: {
  order?: unknown
  hidden?: unknown
}): OverviewPrefs['layout'] {
  const migrate = (id: unknown): SectionId | null =>
    typeof id !== 'string'
      ? null
      : Object.hasOwn(LEGACY_SECTIONS, id)
        ? LEGACY_SECTIONS[id]
        : section.safeParse(id).success
          ? (id as SectionId)
          : null
  const known = (value: unknown): SectionId[] =>
    Array.isArray(value) ? [...new Set(value.flatMap((id) => migrate(id) ?? []))] : []
  const rawHidden = new Set<unknown>(Array.isArray(raw.hidden) ? raw.hidden : [])
  const legacy = [raw.order, raw.hidden].some(
    (value) =>
      Array.isArray(value) &&
      value.some((id) => typeof id === 'string' && Object.hasOwn(LEGACY_SECTIONS, id)),
  )
  // In a pre-v2 layout a merged card is hidden only if every card it replaced was hidden.
  const isHidden = (id: SectionId) =>
    legacy && REPLACED[id] ? REPLACED[id].every((old) => rawHidden.has(old)) : rawHidden.has(id)
  return {
    order: [...new Set([...known(raw.order), ...DEFAULT_ORDER])],
    hidden: known(raw.hidden).filter(isHidden),
  }
}

export function parsePrefs(raw: string | null): OverviewPrefs {
  const defaults = structuredClone(DEFAULT_PREFS)
  if (raw === null) return defaults
  try {
    const stored: unknown = JSON.parse(raw)
    if (
      !object(stored) ||
      typeof stored.version !== 'number' ||
      !Number.isInteger(stored.version) ||
      stored.version < 0 ||
      stored.version > 1
    )
      return defaults
    const filter: OverviewFilter = {}
    if (object(stored.filter)) {
      for (const rawKey of Object.keys(stored.filter)) {
        if (!Object.hasOwn(filterSchema.shape, rawKey)) continue
        const key = rawKey as keyof OverviewFilter
        const parsed = filterSchema.shape[key].safeParse(stored.filter[key])
        if (!parsed.success || parsed.data === undefined) continue
        // Every reference manufacturer has its own slot now, so a saved Other would match no flight: drop it.
        const value =
          key === 'makers'
            ? (parsed.data as MakerKey[]).filter((maker) => maker !== 'other')
            : parsed.data
        if (key !== 'makers' || (value as MakerKey[]).length)
          Object.assign(filter, { [key]: value })
      }
    }
    const layout = object(stored.layout) ? stored.layout : {}
    const publicSections = object(stored.publicSections) ? stored.publicSections : {}
    return {
      version: 1,
      filter,
      layout: normalizeLayout(layout),
      replayPaused: field(z.boolean(), stored.replayPaused, false),
      publicSections: {
        records: field(z.boolean(), publicSections.records, false),
        fleet: field(z.boolean(), publicSections.fleet, false),
      },
    }
  } catch {
    return defaults
  }
}
