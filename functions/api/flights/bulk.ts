// POST /api/flights/bulk — create up to FLIGHT_BULK_CREATE_MAX flights, each under its own idempotency key.
// Items validate independently; accepted flights and their receipts commit in one D1 batch with one
// dirty mark, then derived state is repaired once. Results are positional: created / replayed / error.
// The work lives in `_services/flightCreate.ts`, shared with import draft conversion.

import { runHandler, readJson, json, HttpError } from '../_lib/http'
import { requireUser, requireCsrf, type RequestData } from '../_lib/auth'
import { FLIGHT_BULK_CREATE_MAX } from '../../../packages/shared/src/flightValidation'
import { takeRequestTimezone } from '../_services/lifecycle'
import { bulkCreate } from '../_services/flightCreate'

export const onRequestPost: PagesFunction<Env, string, RequestData> = (context) =>
  bulkCreateRequest(context.request, context.env, context.data)

/** Actual Request/Response domain entry, shared by the Pages compatibility transport. */
export function bulkCreateRequest(
  request: Request,
  env: Env,
  data: RequestData,
): Promise<Response> {
  return runHandler(async () => {
    requireCsrf(request)
    const user = requireUser(data)

    // A full legitimate item is under 1 KB, so 64 KB covers FLIGHT_BULK_CREATE_MAX with room to spare.
    const { body, timezone } = takeRequestTimezone(
      await readJson<{ items?: unknown }>(request, { maxBytes: 64 * 1024 }),
    )
    const items = (body as { items?: unknown } | null)?.items
    if (!Array.isArray(items) || items.length === 0)
      throw new HttpError(400, 'items must be a non-empty array', 'INVALID_ITEMS')
    if (items.length > FLIGHT_BULK_CREATE_MAX)
      throw new HttpError(
        413,
        `At most ${FLIGHT_BULK_CREATE_MAX} flights per request`,
        'TOO_MANY_FLIGHTS',
      )

    const { results, derived } = await bulkCreate(env.DB, user.id, items, { timezone })
    return json(derived ? { results, ...derived } : { results })
  })
}
