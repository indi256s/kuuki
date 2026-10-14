import { HttpError } from '../_lib/http'
import { DEFAULT_MODEL } from '../import/_provider'
import { ANTHROPIC_ENRICH_MODEL, lookupAnthropicAircraft, type AircraftUsage } from './_anthropic'
import { lookupAircraft } from './_lookup'
import type { FlightToEnrich, EnrichmentResult } from './_shared'
import type { ProviderAircraft } from './_evidence'

interface EnrichmentConfig {
  ENRICH_PROVIDER?: string
  GEMINI_API_KEY?: string
  GEMINI_ENRICH_MODEL?: string
  ANTHROPIC_API_KEY?: string
  ANTHROPIC_WORKSPACE_ID?: string
  ANTHROPIC_ENRICH_MODEL?: string
}
export function resolveEnrichmentProvider(config: EnrichmentConfig): {
  provider: 'gemini' | 'anthropic'
  model: string
} {
  const provider = config.ENRICH_PROVIDER?.trim() || 'gemini'
  if (provider === 'gemini')
    return { provider, model: config.GEMINI_ENRICH_MODEL?.trim() || DEFAULT_MODEL }
  if (provider === 'anthropic')
    return { provider, model: config.ANTHROPIC_ENRICH_MODEL?.trim() || ANTHROPIC_ENRICH_MODEL }
  throw new HttpError(
    500,
    'Aircraft search provider is not configured correctly.',
    'PROVIDER_CONFIG',
  )
}
export async function lookupFlightAircraft(
  config: EnrichmentConfig,
  flights: FlightToEnrich[],
): Promise<{
  results: EnrichmentResult[]
  tokenCount?: number
  searchSourceCount: number
  searchSuggestionsHtml?: string
  usage?: AircraftUsage
  requestCount: number
  evidencePackets?: Array<{ id: number; url: string; title: string; text: string }>
  researchRows?: ProviderAircraft[]
}> {
  const { provider, model } = resolveEnrichmentProvider(config)
  if (provider === 'anthropic') {
    if (!config.ANTHROPIC_API_KEY?.trim())
      throw new HttpError(500, 'Aircraft search credential is not configured.', 'PROVIDER_CONFIG')
    return lookupAnthropicAircraft(
      config.ANTHROPIC_API_KEY.trim(),
      model,
      flights,
      config.ANTHROPIC_WORKSPACE_ID?.trim(),
    )
  }
  if (!config.GEMINI_API_KEY?.trim()) throw new HttpError(500, 'Gemini API key not configured')
  return {
    ...(await lookupAircraft(config.GEMINI_API_KEY.trim(), model, flights)),
    requestCount: 1,
  }
}
