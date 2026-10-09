import { GoogleGenAI, type GenerateContentResponse } from '@google/genai'
import { findAircraft } from '../../../packages/data/src/aircraft-lookup'
import { normalizeFlightNumber } from '../_services/blockTimeMedian'
import { HttpError } from '../_lib/http'
import { ProviderResponseError } from '../import/_provider'
import { buildBatchPrompt, type FlightToEnrich, type EnrichmentResult } from './_shared'

// Below the 40s web client deadline, including response validation.
export const ENRICHMENT_DEADLINE_MS = 20_000

interface ProviderAircraft {
  index: number
  icao?: string | null
  name?: string | null
  confidence: number
  evidence?: string | null
  uncertainty?: string | null
  equipment_basis?: 'actual' | 'scheduled' | 'unknown'
  evidence_date?: string | null
  evidence_origin?: string | null
  evidence_destination?: string | null
  evidence_flight?: string | null
  source_urls?: string[]
  registration?: string | null
  operating_airline?: string | null
}

/** A retrieved URL is provenance, not independent verification of its page's claims. */
export function normalizeEnrichment(response: GenerateContentResponse, flights: FlightToEnrich[]): EnrichmentResult[] {
  if (!response.text) throw new ProviderResponseError('Empty enrichment response')
  let parsed: { results: ProviderAircraft[] }
  try { parsed = JSON.parse(response.text.trim().replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/, '$1')) } catch { throw new ProviderResponseError('Invalid enrichment JSON') }
  const nullableStrings = ['icao', 'name', 'evidence', 'uncertainty', 'evidence_date', 'evidence_origin',
    'evidence_destination', 'evidence_flight', 'registration', 'operating_airline'] as const
  if (!parsed || !Array.isArray(parsed.results) || parsed.results.length !== flights.length ||
      new Set(parsed.results.map(row => row?.index)).size !== flights.length ||
      parsed.results.some(row => !row || !Number.isInteger(row.index) || row.index < 1 || row.index > flights.length ||
        !Number.isFinite(row.confidence) || nullableStrings.some(key => row[key] != null && typeof row[key] !== 'string') ||
        (row.equipment_basis != null && !['actual', 'scheduled', 'unknown'].includes(row.equipment_basis)) ||
        (row.source_urls != null && (!Array.isArray(row.source_urls) || row.source_urls.some(url => typeof url !== 'string'))))) {
    throw new ProviderResponseError('Invalid enrichment response shape')
  }
  const candidate = response.candidates?.[0]
  const metadata = candidate?.groundingMetadata
  const chunks = metadata?.groundingChunks ?? []
  const supports = metadata?.groundingSupports ?? []
  return flights.map((flight, index) => {
    const row = parsed.results.find(item => item.index === index + 1)!
    const citedIndices = new Set<number>()
    // Search supports may be cumulative prefixes. Attribute a citation ending in this row's evidence,
    // rather than attaching every citation to every earlier record in that prefix.
    if (row.evidence && parsed.results.filter(item => item.evidence === row.evidence).length === 1) {
      for (const support of supports) {
        const segment = support.segment
        const part = candidate?.content?.parts?.[segment?.partIndex ?? 0]?.text ?? ''
        const text = segment?.text ?? new TextDecoder().decode(new TextEncoder().encode(part)
          .slice(segment?.startIndex ?? 0, segment?.endIndex ?? 0))
        const encoded = JSON.stringify(row.evidence).slice(1, -1)
        const position = part.indexOf(encoded)
        const unique = position >= 0 && part.indexOf(encoded, position + encoded.length) === -1
        const evidenceStart = new TextEncoder().encode(part.slice(0, position)).length
        const evidenceEnd = evidenceStart + new TextEncoder().encode(encoded).length
        const endsInEvidence = unique && segment?.endIndex != null && segment.endIndex > evidenceStart &&
          segment.endIndex <= evidenceEnd + 1 && (segment.startIndex ?? 0) < evidenceEnd
        if (endsInEvidence || text === row.evidence || text === encoded || text === JSON.stringify(row.evidence)) {
          for (const chunkIndex of support.groundingChunkIndices ?? []) citedIndices.add(chunkIndex)
        }
      }
    }
    const sources = new Map<string, { url: string; title: string }>()
    for (const [chunkIndex, chunk] of chunks.entries()) {
      const uri = chunk.web?.uri
      if (!uri || !(citedIndices.has(chunkIndex) || supports.length === 0 && row.source_urls?.includes(uri))) continue
      try {
        const url = new URL(uri)
        if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) continue
        sources.set(uri, { url: uri, title: chunk.web?.title?.trim() || url.hostname })
      } catch { /* Invalid provider URLs never become links. */ }
    }
    const flightNumber = normalizeFlightNumber(flight.airline_iata, flight.flight_number)
    const matchesFlight = row.evidence_date === flight.date && row.evidence_origin === flight.origin &&
      row.evidence_destination === flight.destination && !!flightNumber && !!flight.airline_iata &&
      row.evidence_flight?.toUpperCase().replace(/\s/g, '').startsWith(flight.airline_iata.toUpperCase()) &&
      normalizeFlightNumber(flight.airline_iata, row.evidence_flight) === flightNumber
    const icao = row.icao?.trim().toUpperCase()
    const offered = !!icao && !!findAircraft(icao) && row.confidence >= 0.7 && !!row.evidence?.trim() &&
      matchesFlight && sources.size > 0 && (row.equipment_basis === 'actual' || row.equipment_basis === 'scheduled') &&
      (row.equipment_basis !== 'actual' || flight.date <= new Date(Date.now() + 14 * 3600_000).toISOString().slice(0, 10))
    return {
      flight_id: flight.id,
      aircraft_icao: offered ? icao : null,
      aircraft_name: offered ? findAircraft(icao)?.name ?? row.name ?? null : null,
      confidence: offered ? Math.min(row.equipment_basis === 'scheduled' ? 0.89 : 1, row.confidence) : 0,
      equipment_basis: offered ? row.equipment_basis : 'unknown',
      evidence_date: matchesFlight ? row.evidence_date ?? null : null,
      evidence: offered ? row.evidence ?? null : null,
      uncertainty: offered ? row.uncertainty ?? null : 'No matching dated search evidence for this flight.',
      sources: [...sources.values()],
      registration: offered && row.equipment_basis === 'actual' ? row.registration?.trim().toUpperCase() || null : null,
      operating_airline: offered ? row.operating_airline?.trim() || null : null,
      source: 'gemini',
    }
  })
}

/** Shared by the authenticated handler and the opt-in, read-only source evaluator. */
export async function lookupAircraft(apiKey: string, model: string, flights: FlightToEnrich[]) {
  const controller = new AbortController()
  let expired = false
  const deadline = setTimeout(() => { expired = true; controller.abort() }, ENRICHMENT_DEADLINE_MS)
  try {
    const response = await new GoogleGenAI({ apiKey }).models.generateContent({ model, contents: buildBatchPrompt(flights), config: {
      // JSON mode omitted here: live checks returned no grounding citations with it.
      tools: [{ googleSearch: {} }],
      httpOptions: { timeout: ENRICHMENT_DEADLINE_MS }, abortSignal: controller.signal,
    } })
    return { results: normalizeEnrichment(response, flights), tokenCount: response.usageMetadata?.totalTokenCount,
      searchSourceCount: response.candidates?.[0]?.groundingMetadata?.groundingChunks?.length ?? 0,
      searchSuggestionsHtml: response.candidates?.[0]?.groundingMetadata?.searchEntryPoint?.renderedContent }
  } catch (error) {
    if (expired) throw new HttpError(504, 'The AI service timed out. Please try again.', 'PROVIDER_TIMEOUT')
    throw error
  } finally { clearTimeout(deadline) }
}
