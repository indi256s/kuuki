import { getJob, type ExtractedFlight, type EnrichmentStatusType } from '../_shared'

interface Env {
  IMPORT_JOBS: KVNamespace
}

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
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }

  if (context.request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const jobId = context.params.jobId as string

  if (!jobId) {
    return Response.json(
      { status: 'failed', error: 'Job ID required' } as EnrichmentResponse,
      { status: 400, headers: corsHeaders }
    )
  }

  const kv = context.env.IMPORT_JOBS
  const job = await getJob(kv, jobId)

  if (!job) {
    return Response.json(
      { status: 'failed', error: 'Job not found or expired' } as EnrichmentResponse,
      { status: 404, headers: corsHeaders }
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

  return Response.json(response, { headers: corsHeaders })
}
