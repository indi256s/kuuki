// Test helpers shared by the import unit tests (not imported by product code).
import type { Batch, Draft, Snapshot } from './import-types'

export const draft = (over: Partial<Draft> & { id: string }): Draft => ({
  ordinal: 0, status: 'review', version: 1,
  fields: { date: '2026-03-01', origin: 'JFK', destination: 'BOS', airline_iata: 'AA' },
  confidence: 0.9, fieldConfidence: null, yearExplicit: true, yearConfirmed: false, selected: true, edited: false,
  duplicateAcknowledged: false, convertedFlightId: null, duplicateFlightId: null, issue: null, ...over,
})

export const batch = (over: Partial<Batch> = {}): Batch => ({
  id: 'b1', sourceType: 'text', sourceLabel: null, status: 'review', stage: 'review_ready', sequence: 1, errorCode: null,
  retryAfter: null, createdAt: '2026-10-05T00:00:00.000Z', updatedAt: '2026-10-05T00:00:00.000Z', expiresAt: '2026-11-04T00:00:00.000Z', expired: false, ...over,
})

export const snapshot = (drafts: Draft[], over: Partial<Batch> = {}): Snapshot => ({ batch: batch(over), drafts })
