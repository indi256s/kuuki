// POST /api/import/batches/:id/confirm — convert reviewed drafts into flights, `{timezone?, items: [{draftId, version, key}]}`.
// Receipt-first and per-item: each item answers `created`, `replayed` or an error in place, so a retry after a lost
// response or a partial failure creates only what is still missing. The flights come from the shared bulk-create
// path, so reference validation is the ordinary one. See `_services/importConversion.ts` for the statement chain.
import { runHandler, readJson, json } from '../../../_lib/http'
import { requireCsrf, requireUser, type RequestData } from '../../../_lib/auth'
import { confirmBatch, parseConfirmRequest } from '../../../_services/importConversion'

export const onRequestPost: PagesFunction<Env, string, RequestData> = context =>
  runHandler(async () => {
    requireCsrf(context.request)
    const user = requireUser(context.data)
    // A full item is ~150 bytes; 64 KB covers FLIGHT_BULK_CREATE_MAX with room to spare.
    const request = parseConfirmRequest(await readJson<unknown>(context.request, { maxBytes: 64 * 1024 }))
    const { results, batch, derived } = await confirmBatch(context.env.DB, user.id, String(context.params.id), request, new Date())
    return json({ results, batch, ...(derived ?? {}) })
  })
