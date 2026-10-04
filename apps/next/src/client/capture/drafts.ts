export type ExtractedFlight = {
  date: string; origin: string; destination: string; airline_iata: string
  flight_number?: string; aircraft_icao?: string; departure_time?: string; arrival_time?: string
  confidence: number; enrichment_status?: 'pending' | 'enriched' | 'failed' | 'skipped'
  field_confidence?: { date?: number; date_year_explicit?: boolean; origin?: number; destination?: number; airline_iata?: number;
    flight_number?: number; aircraft_icao?: number; departure_time?: number; arrival_time?: number }
}

const PREFIX = 'kuuki-import-draft:v1:'
const DAYS_30 = 30 * 24 * 60 * 60 * 1000
const MAX_DRAFTS = 10
export const MAX_DRAFT_ROWS = 100
const MAX_BYTES = 512_000

export type DraftRow = {
  id: string
  flight: ExtractedFlight
  selected: boolean
  yearConfirmed: boolean
  duplicate: boolean
  edited: boolean
  saved: boolean
}
export type ImportDraft = {
  schema: 1
  id: string
  ownerId: string
  createdAt: number
  updatedAt: number
  rows: DraftRow[]
}
export type DraftSummary = Pick<ImportDraft, 'id' | 'createdAt' | 'updatedAt'> & { count: number }
export type DraftStorageResult = { ok: true } | { ok: false; reason: 'quota' | 'unavailable' | 'limit' }

function validDraft(value: unknown, ownerId: string): value is ImportDraft {
  if (!value || typeof value !== 'object') return false
  const d = value as Partial<ImportDraft>
  return d.schema === 1 && d.ownerId === ownerId && typeof d.id === 'string' && /^[0-9a-f-]{36}$/.test(d.id)
    && typeof d.createdAt === 'number' && d.createdAt <= Date.now() && Date.now() - d.createdAt < DAYS_30
    && Array.isArray(d.rows) && d.rows.length <= MAX_DRAFT_ROWS
    && d.rows.every(row => typeof row?.id === 'string' && /^[0-9a-f-]{36}$/.test(row.id) && typeof row.selected === 'boolean'
      && typeof row.yearConfirmed === 'boolean' && typeof row.duplicate === 'boolean' && typeof row.edited === 'boolean'
      && (row.saved === undefined || typeof row.saved === 'boolean')
      && typeof row.flight?.date === 'string' && typeof row.flight?.origin === 'string' && typeof row.flight?.destination === 'string')
}

function cleanFlight(f: ExtractedFlight): ExtractedFlight {
  const score = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : undefined
  const confidence = f.field_confidence
  return {
    date: String(f.date ?? '').slice(0, 10), origin: String(f.origin ?? '').slice(0, 3),
    destination: String(f.destination ?? '').slice(0, 3), airline_iata: String(f.airline_iata ?? '').slice(0, 2),
    flight_number: typeof f.flight_number === 'string' ? f.flight_number.slice(0, 16) : undefined,
    aircraft_icao: typeof f.aircraft_icao === 'string' ? f.aircraft_icao.slice(0, 8) : undefined,
    departure_time: typeof f.departure_time === 'string' ? f.departure_time.slice(0, 16) : undefined,
    arrival_time: typeof f.arrival_time === 'string' ? f.arrival_time.slice(0, 16) : undefined,
    confidence: score(f.confidence) ?? 0,
    enrichment_status: ['pending', 'enriched', 'failed', 'skipped'].includes(f.enrichment_status ?? '') ? f.enrichment_status : undefined,
    field_confidence: confidence ? {
      date: score(confidence.date), date_year_explicit: confidence.date_year_explicit === true ? true : confidence.date_year_explicit === false ? false : undefined,
      origin: score(confidence.origin), destination: score(confidence.destination), airline_iata: score(confidence.airline_iata),
      flight_number: score(confidence.flight_number), aircraft_icao: score(confidence.aircraft_icao),
      departure_time: score(confidence.departure_time), arrival_time: score(confidence.arrival_time),
    } : undefined,
  }
}

function cleanDraft(draft: ImportDraft): ImportDraft {
  return { schema: 1, id: draft.id, ownerId: draft.ownerId, createdAt: draft.createdAt, updatedAt: draft.updatedAt,
    rows: draft.rows.map(row => ({ id: row.id, selected: row.saved ? false : row.selected, yearConfirmed: row.yearConfirmed,
      duplicate: row.duplicate, edited: row.edited, saved: row.saved === true, flight: cleanFlight(row.flight) })) }
}

function ownedKeys(ownerId: string): string[] {
  const prefix = PREFIX + ownerId + ':'
  return Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)).filter((key): key is string => !!key?.startsWith(prefix))
}

export function loadDraft(ownerId: string, id: string): ImportDraft | null {
  try {
    const key = PREFIX + ownerId + ':' + id
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (validDraft(parsed, ownerId) && parsed.id === id) {
      const clean = cleanDraft(parsed)
      const serialized = JSON.stringify(clean)
      if (serialized !== raw) localStorage.setItem(key, serialized)
      return clean
    }
    localStorage.removeItem(key)
  } catch { /* Storage unavailable or malformed. */ }
  return null
}

export function listDrafts(ownerId: string): DraftSummary[] {
  try {
    return ownedKeys(ownerId).flatMap(key => {
      const draft = loadDraft(ownerId, key.slice((PREFIX + ownerId + ':').length))
      return draft ? [{ id: draft.id, createdAt: draft.createdAt, updatedAt: draft.updatedAt, count: draft.rows.length }] : []
    }).sort((a, b) => b.updatedAt - a.updatedAt)
  } catch { return [] }
}

export function saveDraft(draft: ImportDraft): DraftStorageResult {
  if (!validDraft(draft, draft.ownerId) || draft.rows.length > MAX_DRAFT_ROWS) return { ok: false, reason: 'limit' }
  // Rebuild the persisted object field by field. Parser extras such as raw_text never enter storage.
  const safe = cleanDraft({ ...draft, updatedAt: Date.now() })
  const serialized = JSON.stringify(safe)
  if (serialized.length > MAX_BYTES) return { ok: false, reason: 'limit' }
  try {
    const keys = ownedKeys(draft.ownerId)
    const key = PREFIX + draft.ownerId + ':' + draft.id
    if (!keys.includes(key) && keys.length >= MAX_DRAFTS) return { ok: false, reason: 'limit' }
    localStorage.setItem(key, serialized)
    if (localStorage.getItem(key) !== serialized) return { ok: false, reason: 'unavailable' }
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('kuuki:draft-change'))
    return { ok: true }
  } catch (error) {
    return { ok: false, reason: error instanceof DOMException && error.name === 'QuotaExceededError' ? 'quota' : 'unavailable' }
  }
}

export function dismissDraft(ownerId: string, id: string): void {
  try { localStorage.removeItem(PREFIX + ownerId + ':' + id); if (typeof window !== 'undefined') window.dispatchEvent(new Event('kuuki:draft-change')) } catch { /* Identity reset still clears UI. */ }
}

export function clearDrafts(ownerId?: string): void {
  try {
    const prefix = ownerId === undefined ? PREFIX : PREFIX + ownerId + ':'
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i)
      if (key?.startsWith(prefix)) localStorage.removeItem(key)
    }
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('kuuki:draft-change'))
  } catch { /* Storage unavailable. */ }
}
