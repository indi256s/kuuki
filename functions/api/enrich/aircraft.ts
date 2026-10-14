import { lookupFlightAircraft, resolveEnrichmentProvider } from './_provider'
import { isCalendarDate } from '../../../packages/shared/src/flightValidation'
import { type EnrichmentRequest, type EnrichmentResponse, MAX_BATCH_SIZE, safeUrl } from './_shared'
import { corsHeaders, corsPreflight } from '../_lib/cors'
import { requireCsrf, requireUser, type RequestData } from '../_lib/auth'
import { HttpError, readJson, runHandler } from '../_lib/http'
import { rateLimit } from '../_lib/ratelimit'
import { providerFailure, usageBucket } from '../import/_provider'

export { ENRICHMENT_DEADLINE_MS } from './_lookup'

export const onRequestPost: PagesFunction<Env, string, RequestData> = async (context) => {
  const { request, env, data } = context
  const cors = corsHeaders(request, env, 'POST, OPTIONS')

  // Handle preflight
  if (request.method === 'OPTIONS') {
    return corsPreflight(request, env, 'POST, OPTIONS')
  }

  return runHandler(
    async () => {
      // CSRF: state-changing, paid-quota endpoint — require same-origin + double-submit token.
      requireCsrf(request)
      // Auth gate — burns paid Gemini quota, so reject anonymous callers
      const user = requireUser(data)
      // Per-user rate limit — paid Gemini quota. Prevents one user from running up cost
      // (security finding: AI quota / cost abuse — no per-user limit).
      await rateLimit(env.DB, `import-enrich:${user.id}`, 30, 3600)

      const body = await readJson<Partial<EnrichmentRequest>>(request, { maxBytes: 50_000 })
      const flights = body?.flights

      // Validate input
      if (!flights || !Array.isArray(flights) || flights.length === 0) {
        throw new HttpError(400, 'flights array is required and cannot be empty')
      }
      if (flights.length > MAX_BATCH_SIZE)
        throw new HttpError(400, `Maximum ${MAX_BATCH_SIZE} flights per request`)

      // Validate each flight has required fields
      for (const flight of flights) {
        if (
          !flight ||
          typeof flight.id !== 'string' ||
          !flight.id ||
          typeof flight.date !== 'string' ||
          !isCalendarDate(flight.date) ||
          typeof flight.origin !== 'string' ||
          !/^[A-Z]{3}$/.test(flight.origin) ||
          typeof flight.destination !== 'string' ||
          !/^[A-Z]{3}$/.test(flight.destination) ||
          [flight.flight_number, flight.airline_iata, flight.airline_name].some(
            (value) => value != null && typeof value !== 'string',
          ) ||
          (flight.airline_iata != null && !/^[A-Z0-9]{2}$/.test(flight.airline_iata)) ||
          (flight.flight_number != null && flight.flight_number.length > 20) ||
          (flight.airline_name != null && flight.airline_name.length > 200) ||
          (flight.source_hints != null &&
            (!Array.isArray(flight.source_hints) ||
              flight.source_hints.length > 2 ||
              flight.source_hints.some(
                (value) => typeof value !== 'string' || value.length > 1000 || !safeUrl(value),
              )))
        ) {
          throw new HttpError(
            400,
            'Each flight must have an id, calendar date, IATA endpoints and valid optional flight details',
          )
        }
      }
      if (new Set(flights.map((flight) => flight.id)).size !== flights.length) {
        throw new HttpError(400, 'Flight IDs must be unique')
      }

      const { provider, model } = resolveEnrichmentProvider(env)
      const started = Date.now()
      try {
        console.log(
          JSON.stringify({
            event: 'enrichment_start',
            provider,
            model,
            flight_count: flights.length,
          }),
        )
        const { results, tokenCount, searchSuggestionsHtml } = await lookupFlightAircraft(
          env,
          flights,
        )

        console.log(
          JSON.stringify({
            event: 'enrichment_complete',
            provider,
            model,
            outcome: 'success',
            duration_ms: Date.now() - started,
            usage_bucket: usageBucket(tokenCount),
            identified: results.filter((r) => r.aircraft_icao).length,
            total: flights.length,
          }),
        )

        return Response.json(
          {
            results,
            ...(searchSuggestionsHtml ? { search_suggestions_html: searchSuggestionsHtml } : {}),
          } as EnrichmentResponse,
          { headers: cors },
        )
      } catch (error) {
        if (error instanceof HttpError) throw error
        const failure = providerFailure(error)
        console.error(
          JSON.stringify({
            event: 'enrichment_provider_error',
            provider,
            model,
            code: failure.code,
            duration_ms: Date.now() - started,
          }),
        )
        throw failure
      }
    },
    { headers: cors, fields: { results: [] } },
  )
}
