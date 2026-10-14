import type { RequestData } from '../../functions/api/_lib/auth'
import { runApiRequest } from '../../functions/_middleware'
import { listFlights, createFlightRequest } from '../../functions/api/flights/index'
import {
  readFlightRequest,
  updateFlightRequest,
  deleteFlightRequest,
} from '../../functions/api/flights/[id]'
import { bulkCreateRequest } from '../../functions/api/flights/bulk'
import { bulkDeleteRequest } from '../../functions/api/flights/bulk-delete'
import { aircraftBatchRequest } from '../../functions/api/flights/aircraft-batch'
import {
  claimCountryRequest,
  unclaimCountryRequest,
} from '../../functions/api/passport/claims/[cc]/index'
import {
  hideCountryRequest,
  unhideCountryRequest,
} from '../../functions/api/passport/hidden/[cc]/index'
import {
  createGroundVisitRequest,
  listGroundVisitsRequest,
} from '../../functions/api/passport/ground-visits/index'
import { deleteGroundVisitRequest } from '../../functions/api/passport/ground-visits/[id]'
import { updateProfileRequest } from '../../functions/api/profiles/me'
import { deleteAccountRequest } from '../../functions/api/auth/account'
import { requestPasswordReset } from '../../functions/api/auth/password-reset/request'
import { completePasswordReset } from '../../functions/api/auth/password-reset/complete'

/** One active transport per migrated family; Pages wrappers remain for rollback. */
export function captureHandler(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): (() => Promise<Response>) | null {
  const path = new URL(request.url).pathname
  const method = request.method
  const data: RequestData = { user: null }
  let handler: (() => Promise<Response>) | undefined
  if (path === '/api/flights')
    handler = () =>
      method === 'GET' ? listFlights(request, env, data) : createFlightRequest(request, env, data)
  else if (path === '/api/flights/bulk') handler = () => bulkCreateRequest(request, env, data)
  else if (path === '/api/flights/bulk-delete')
    handler = () => bulkDeleteRequest(request, env, data)
  else if (path === '/api/flights/aircraft-batch')
    handler = () => aircraftBatchRequest(request, env, data)
  else if (/^\/api\/flights\/\d+$/.test(path)) {
    const id = path.split('/').at(-1)!
    handler = () =>
      method === 'GET'
        ? readFlightRequest(request, env, data, id)
        : method === 'PATCH'
          ? updateFlightRequest(request, env, data, id)
          : deleteFlightRequest(request, env, data, id)
  } else if (/^\/api\/passport\/claims\/[^/]+$/.test(path)) {
    const code = path.split('/').at(-1)!
    handler = () =>
      method === 'PUT'
        ? claimCountryRequest(request, env, data, decodeURIComponent(code))
        : unclaimCountryRequest(request, env, data, decodeURIComponent(code))
  } else if (/^\/api\/passport\/hidden\/[^/]+$/.test(path)) {
    const code = path.split('/').at(-1)!
    handler = () =>
      method === 'PUT'
        ? hideCountryRequest(request, env, data, decodeURIComponent(code))
        : unhideCountryRequest(request, env, data, decodeURIComponent(code))
  } else if (path === '/api/passport/ground-visits')
    handler = () =>
      method === 'GET'
        ? listGroundVisitsRequest(request, env, data)
        : createGroundVisitRequest(request, env, data)
  else if (/^\/api\/passport\/ground-visits\/[^/]+$/.test(path))
    handler = () => deleteGroundVisitRequest(request, env, data, path.split('/').at(-1)!)
  else if (path === '/api/profiles/me' && method === 'PATCH')
    handler = () => updateProfileRequest(request, env, data)
  else if (path === '/api/auth/account') handler = () => deleteAccountRequest(request, env, data)
  // Pre-auth recovery: the shared middleware skips session handling for these paths.
  else if (path === '/api/auth/password-reset/request')
    handler = () => requestPasswordReset(request, env, (task) => ctx.waitUntil(task))
  else if (path === '/api/auth/password-reset/complete')
    handler = () => completePasswordReset(request, env)
  return handler ? () => runApiRequest(request, env, data, handler!) : null
}
