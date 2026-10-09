import { z } from 'zod'
import { periodDays } from './range'
import type { OverviewFilter } from './model'

export const DEFAULT_ORDER = ['rankings', 'records', 'manufacturers', 'fleet', 'clock', 'rhythm', 'timeline', 'crossings'] as const
const section = z.enum(DEFAULT_ORDER)
export type SectionId = z.infer<typeof section>
export interface OverviewPrefs {
  version: 1
  filter: OverviewFilter
  layout: { order: SectionId[]; hidden: SectionId[] }
  replayPaused: boolean
  publicSections: { records: boolean; fleet: boolean }
}
export const DEFAULT_PREFS: OverviewPrefs = { version: 1, filter: {},
  layout: { order: [...DEFAULT_ORDER], hidden: [] },
  replayPaused: false, publicSections: { records: false, fleet: false } }

const strings = z.array(z.string())
const filterSchema = z.strictObject({
  period: z.union([z.strictObject({ years: z.array(z.number().int().min(0).max(9999)) }),
    z.strictObject({ from: z.string(), to: z.string() }).refine(value => periodDays(value) !== null)]).optional(),
  countries: strings.optional(), regions: strings.optional(), airlines: strings.optional(), aircraft: strings.optional(),
  routes: strings.optional(), airports: strings.optional(), families: strings.optional(),
  alliances: z.array(z.enum(['star', 'oneworld', 'skyteam'])).optional(),
  makers: z.array(z.enum(['airbus', 'boeing', 'embraer', 'atr', 'other', 'unknown'])).optional(),
  bodies: z.array(z.enum(['narrow', 'wide'])).optional(),
  depHours: z.array(z.number().int().min(0).max(23)).optional(),
  arrHours: z.array(z.number().int().min(0).max(23)).optional(),
  haul: z.array(z.enum(['short', 'medium', 'long'])).optional(),
  domestic: z.array(z.enum(['domestic', 'international'])).optional(),
  departureBands: z.array(z.enum(['night', 'morning', 'afternoon', 'evening'])).optional(),
})
const sections = z.array(section).refine(values => new Set(values).size === values.length)
export const overviewPrefsSchema = z.strictObject({ version: z.literal(1), filter: filterSchema,
  layout: z.strictObject({ order: sections, hidden: sections }), replayPaused: z.boolean(),
  publicSections: z.strictObject({ records: z.boolean(), fleet: z.boolean() }) })

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
function field<T>(schema: z.ZodType<T>, value: unknown, fallback: T): T {
  const parsed = schema.safeParse(value)
  return parsed.success ? parsed.data : fallback
}

export function normalizeLayout(raw: { order?: unknown; hidden?: unknown }): OverviewPrefs['layout'] {
  const known = (value: unknown): SectionId[] => Array.isArray(value)
    ? [...new Set(value.filter((id): id is SectionId => section.safeParse(id).success))] : []
  return { order: [...new Set([...known(raw.order), ...DEFAULT_ORDER])], hidden: known(raw.hidden) }
}

export function parsePrefs(raw: string | null): OverviewPrefs {
  const defaults = structuredClone(DEFAULT_PREFS)
  if (raw === null) return defaults
  try {
    const stored: unknown = JSON.parse(raw)
    if (!object(stored) || typeof stored.version !== 'number' || !Number.isInteger(stored.version) ||
        stored.version < 0 || stored.version > 1) return defaults
    const filter: OverviewFilter = {}
    if (object(stored.filter)) {
      for (const rawKey of Object.keys(stored.filter)) {
        if (!Object.hasOwn(filterSchema.shape, rawKey)) continue
        const key = rawKey as keyof OverviewFilter
        const parsed = filterSchema.shape[key].safeParse(stored.filter[key])
        if (parsed.success && parsed.data !== undefined) Object.assign(filter, { [key]: parsed.data })
      }
    }
    const layout = object(stored.layout) ? stored.layout : {}
    const publicSections = object(stored.publicSections) ? stored.publicSections : {}
    return { version: 1, filter,
      layout: normalizeLayout(layout),
      replayPaused: field(z.boolean(), stored.replayPaused, false),
      publicSections: { records: field(z.boolean(), publicSections.records, false),
        fleet: field(z.boolean(), publicSections.fleet, false) } }
  } catch { return defaults }
}
