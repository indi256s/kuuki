import { z } from 'zod'
import { overviewFilterSchema } from './overview/filter-schema'
import type { OverviewFilter } from './overview/model'

export interface AirportHistoryItem {
  id: number
  date: string
  origin: string
  destination: string
  airline: string | null
  flightNumber: string | null
  state: 'logged' | 'awaiting'
}
export interface AirportHistory {
  ownerId: string
  revision: number
  publishedRevision: number
  scopeFingerprint: string
  status: 'ready' | 'scope-updating'
  total: number | null
  items: AirportHistoryItem[]
  nextCursor: string | null
  derivedState: 'ready' | 'pending' | 'error'
}

export class AirportScopeError extends Error {
  constructor() {
    super('Invalid airport history scope')
    this.name = 'AirportScopeError'
  }
}
const scopeSchema = z.strictObject({ v: z.literal(1), filter: overviewFilterSchema })
const encoder = new TextEncoder()
const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: false })
const MAX_BYTES = 8192

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (value !== null && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonical(item)]),
    )
  return value
}
export function encodeAirportScope(filter: OverviewFilter): string {
  const parsed = scopeSchema.safeParse({ v: 1, filter })
  if (!parsed.success) throw new AirportScopeError()
  const bytes = encoder.encode(JSON.stringify(canonical(parsed.data)))
  if (bytes.length > MAX_BYTES) throw new AirportScopeError()
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}
export function decodeAirportScope(scope: string): OverviewFilter {
  try {
    if (!/^[A-Za-z0-9_-]+$/.test(scope) || scope.length > Math.ceil((MAX_BYTES * 4) / 3))
      throw new AirportScopeError()
    const binary = atob(scope.replace(/-/g, '+').replace(/_/g, '/'))
    if (binary.length > MAX_BYTES) throw new AirportScopeError()
    const parsed = scopeSchema.safeParse(
      JSON.parse(decoder.decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)))),
    )
    if (!parsed.success) throw new AirportScopeError()
    // Reject alternate encodings as well as malformed base64 trailing bits.
    if (encodeAirportScope(parsed.data.filter) !== scope) throw new AirportScopeError()
    return parsed.data.filter
  } catch {
    throw new AirportScopeError()
  }
}
