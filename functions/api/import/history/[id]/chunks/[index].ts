// PUT /api/import/history/:id/chunks/:index — one manifest chunk of parsed records (ADR 0008). The server recomputes
// the digest, re-maps every record and inserts them once; a replay inserts nothing. The last chunk opens review.
import { json, readJson, runHandler } from '../../../../_lib/http'
import { rateLimit } from '../../../../_lib/ratelimit'
import { requireCsrf, requireUser, type RequestData } from '../../../../_lib/auth'
import { HISTORY_CHUNK_MAX_BYTES } from '../../../../../../packages/shared/src/flightyHistory'
import { admitChunk, parseChunkBody } from '../../../../_services/historyImport'

export const onRequestPut: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => {
    requireCsrf(context.request)
    const user = requireUser(context.data)
    await rateLimit(context.env.DB, `history-import:${user.id}`, 600, 3600)
    const records = parseChunkBody(
      await readJson<unknown>(context.request, { maxBytes: HISTORY_CHUNK_MAX_BYTES }),
    )
    const result = await admitChunk(
      context.env.DB,
      user.id,
      String(context.params.id),
      String(context.params.index),
      records,
    )
    return json(result, { status: result.inserted ? 201 : 200 })
  })
