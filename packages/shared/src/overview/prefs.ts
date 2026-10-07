import { z } from 'zod'
import type { OverviewFilter } from './model'

const section = z.enum(['records', 'crossings', 'fleet', 'clock', 'rhythm', 'rankings'])
export type SectionId = z.infer<typeof section>
export interface OverviewPrefs {
  version: 1
  filter: OverviewFilter
  layout: { order: SectionId[]; hidden: SectionId[] }
  replayPaused: boolean
  publicSections: { records: boolean; fleet: boolean }
}
export const DEFAULT_PREFS: OverviewPrefs = { version: 1, filter: {},
  layout: { order: ['records', 'crossings', 'fleet', 'clock', 'rhythm', 'rankings'], hidden: [] },
  replayPaused: false, publicSections: { records: false, fleet: false } }

const strings = z.array(z.string())
const month = z.string().regex(/^\d{4}-(?:0[1-9]|1[0-2])$/)
const filterSchema = z.strictObject({
  period: z.union([z.strictObject({ years: z.array(z.number().int().min(0).max(9999)) }),
    z.strictObject({ from: month, to: month }).refine(value => value.from <= value.to)]).optional(),
  countries: strings.optional(), regions: strings.optional(), airlines: strings.optional(), aircraft: strings.optional(),
  routes: strings.optional(), manufacturers: strings.optional(), bodyTypes: strings.optional(),
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

export function parsePrefs(raw: string | null): OverviewPrefs {
  const defaults = structuredClone(DEFAULT_PREFS)
  if (raw === null) return defaults
  try {
    const stored: unknown = JSON.parse(raw)
    if (!object(stored) || typeof stored.version !== 'number' || !Number.isInteger(stored.version) ||
        stored.version < 0 || stored.version > 1) return defaults
    const filter: OverviewFilter = {}
    if (object(stored.filter)) {
      for (const key of Object.keys(filterSchema.shape) as Array<keyof OverviewFilter>) {
        const parsed = filterSchema.shape[key].safeParse(stored.filter[key])
        if (parsed.success && parsed.data !== undefined) Object.assign(filter, { [key]: parsed.data })
      }
    }
    const layout = object(stored.layout) ? stored.layout : {}
    const publicSections = object(stored.publicSections) ? stored.publicSections : {}
    return { version: 1, filter,
      layout: { order: field(sections, layout.order, defaults.layout.order), hidden: field(sections, layout.hidden, []) },
      replayPaused: field(z.boolean(), stored.replayPaused, false),
      publicSections: { records: field(z.boolean(), publicSections.records, false),
        fleet: field(z.boolean(), publicSections.fleet, false) } }
  } catch { return defaults }
}
