import { getJob, type ExtractedFlight, type EnrichmentStatusType } from '../_shared'
import { corsHeaders, corsPreflight } from '../../_lib/cors'
import type { RequestData } from '../../_lib/auth'

interface EnrichmentResponse {
  status: EnrichmentStatusType
  flights?: ExtractedFlight[]
  error?: string
}

/**
 * GET /api/import/enrichment/[jobId]
 *
 * Polls enrichment job status for two-phase import.
 * Returns enriched flights when complete.
 */
export const onRequestGet: PagesFunction<Env, string, RequestData> = async (context) => {
  const { request, env } = context
  const cors = corsHeaders(request, env, 'GET, OPTIONS')

  if (request.method === 'OPTIONS') {
    return corsPreflight(request, env, 'GET, OPTIONS')
  }

  // Auth gate — keep job polling private to signed-in users
  const user = (context.data && context.data.user) || null
  if (!user) {
    return new Response(
      JSON.stringify({ status: 'failed', error: 'Authentication required', code: 'UNAUTHENTICATED' }),
      { status: 401, headers: { 'Content-Type': 'application/json', ...cors } }
    )
  }

  const jobId = context.params.jobId as string

  if (!jobId) {
    return Response.json(
      { status: 'failed', error: 'Job ID required' } as EnrichmentResponse,
      { status: 400, headers: cors }
    )
  }

  const kv = context.env.IMPORT_JOBS
  const job = await getJob(kv, jobId)

  if (!job) {
    return Response.json(
      { status: 'failed', error: 'Job not found or expired' } as EnrichmentResponse,
      { status: 404, headers: cors }
    )
  }

  // Ownership: jobs are per-user. Return 404 (not 403) for someone else's job so existence
  // isn't disclosed — indistinguishable from the not-found branch above.
  if (job.ownerId !== user.id) {
    return Response.json(
      { status: 'failed', error: 'Job not found or expired' } as EnrichmentResponse,
      { status: 404, headers: cors }
    )
  }

  // Map job status to enrichment status
  let enrichmentStatus: EnrichmentStatusType
  switch (job.status) {
    case 'completed':
      enrichmentStatus = 'completed'
      break
    case 'failed':
      enrichmentStatus = 'failed'
      break
    default:
      enrichmentStatus = 'pending'
  }

  const response: EnrichmentResponse = {
    status: enrichmentStatus,
    ...(job.flights && { flights: job.flights }),
    ...(job.error && { error: job.error }),
  }

  return Response.json(response, { headers: cors })
}
