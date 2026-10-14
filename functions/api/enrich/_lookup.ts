import { GoogleGenAI, type GenerateContentResponse } from '@google/genai'
import { HttpError } from '../_lib/http'
import { normalizeAircraftEvidence, parseAircraftResults } from './_evidence'
import { buildBatchPrompt, safeUrl, type FlightToEnrich, type EnrichmentResult } from './_shared'

// Below the 40s web client deadline, including response validation.
export const ENRICHMENT_DEADLINE_MS = 20_000

/** A retrieved URL is provenance, not independent verification of its page's claims. */
export function normalizeEnrichment(
  response: GenerateContentResponse,
  flights: FlightToEnrich[],
): EnrichmentResult[] {
  const rows = parseAircraftResults(response.text, flights)
  const candidate = response.candidates?.[0]
  const metadata = candidate?.groundingMetadata
  const chunks = metadata?.groundingChunks ?? []
  const supports = metadata?.groundingSupports ?? []
  return flights.map((flight, index) => {
    const row = rows.find((item) => item.index === index + 1)!
    const citedIndices = new Set<number>()
    // Search supports may be cumulative prefixes. Attribute a citation ending in this row's evidence,
    // rather than attaching every citation to every earlier record in that prefix.
    if (row.evidence && rows.filter((item) => item.evidence === row.evidence).length === 1) {
      for (const support of supports) {
        const segment = support.segment
        const part = candidate?.content?.parts?.[segment?.partIndex ?? 0]?.text ?? ''
        const text =
          segment?.text ??
          new TextDecoder().decode(
            new TextEncoder().encode(part).slice(segment?.startIndex ?? 0, segment?.endIndex ?? 0),
          )
        const encoded = JSON.stringify(row.evidence).slice(1, -1)
        const position = part.indexOf(encoded)
        const unique = position >= 0 && part.indexOf(encoded, position + encoded.length) === -1
        const evidenceStart = new TextEncoder().encode(part.slice(0, position)).length
        const evidenceEnd = evidenceStart + new TextEncoder().encode(encoded).length
        const endsInEvidence =
          unique &&
          segment?.endIndex != null &&
          segment.endIndex > evidenceStart &&
          segment.endIndex <= evidenceEnd + 1 &&
          (segment.startIndex ?? 0) < evidenceEnd
        if (
          endsInEvidence ||
          text === row.evidence ||
          text === encoded ||
          text === JSON.stringify(row.evidence)
        ) {
          for (const chunkIndex of support.groundingChunkIndices ?? []) citedIndices.add(chunkIndex)
        }
      }
    }
    const sources = new Map<string, { url: string; title: string }>()
    for (const [chunkIndex, chunk] of chunks.entries()) {
      const uri = chunk.web?.uri
      if (
        !uri ||
        !(citedIndices.has(chunkIndex) || (supports.length === 0 && row.source_urls?.includes(uri)))
      )
        continue
      // Invalid provider URLs never become links.
      if (!safeUrl(uri)) continue
      sources.set(uri, { url: uri, title: chunk.web?.title?.trim() || new URL(uri).hostname })
    }
    return normalizeAircraftEvidence(row, flight, [...sources.values()], 'gemini')
  })
}

/** Shared by the authenticated handler and the opt-in, read-only source evaluator. */
export async function lookupAircraft(apiKey: string, model: string, flights: FlightToEnrich[]) {
  const controller = new AbortController()
  let expired = false
  const deadline = setTimeout(() => {
    expired = true
    controller.abort()
  }, ENRICHMENT_DEADLINE_MS)
  try {
    const response = await new GoogleGenAI({ apiKey }).models.generateContent({
      model,
      contents: buildBatchPrompt(flights),
      config: {
        // JSON mode omitted here: live checks returned no grounding citations with it.
        tools: [{ googleSearch: {} }],
        httpOptions: { timeout: ENRICHMENT_DEADLINE_MS },
        abortSignal: controller.signal,
      },
    })
    return {
      results: normalizeEnrichment(response, flights),
      tokenCount: response.usageMetadata?.totalTokenCount,
      searchSourceCount: response.candidates?.[0]?.groundingMetadata?.groundingChunks?.length ?? 0,
      searchSuggestionsHtml:
        response.candidates?.[0]?.groundingMetadata?.searchEntryPoint?.renderedContent,
    }
  } catch (error) {
    if (expired)
      throw new HttpError(504, 'The AI service timed out. Please try again.', 'PROVIDER_TIMEOUT')
    throw error
  } finally {
    clearTimeout(deadline)
  }
}
