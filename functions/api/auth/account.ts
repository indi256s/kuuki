import { runHandler, json, readJson, HttpError } from '../_lib/http'
import { requireCsrf, requireUser, type RequestData } from '../_lib/auth'
import { deleteUserCascade, getPasswordHashById, parsePassword } from '../_lib/users'
import { verifyPassword } from '../_lib/crypto'
import { rateLimit } from '../_lib/ratelimit'
import { clearSessionCookies } from '../_lib/authCookies'
import { clearBetterAuthCookie } from '../_lib/betterAuth'
import { abortImportJob } from '../_services/importRuntime'

export const onRequestDelete: PagesFunction<Env, string, RequestData> = (context) =>
  deleteAccountRequest(context.request, context.env, context.data)

export function deleteAccountRequest(
  request: Request,
  env: Env,
  data: RequestData,
): Promise<Response> {
  return runHandler(async () => {
    requireCsrf(request)
    const user = requireUser(data)
    await rateLimit(env.DB, `account-delete:${user.id}`, 5, 3600)

    const body = await readJson<{ password?: string }>(request)
    const password = parsePassword(body?.password, 'current')
    const hash = await getPasswordHashById(env.DB, user.id)
    if (!hash || !(await verifyPassword(password, hash, env.AUTH_SECRET))) {
      throw new HttpError(401, 'Incorrect password', 'INVALID_CREDENTIALS')
    }

    const jobs = await deleteUserCascade(env.DB, user.id)
    await Promise.all(jobs.map((batchId) => abortImportJob(env, user.id, batchId)))

    const res = json({ ok: true })
    clearSessionCookies(res.headers)
    clearBetterAuthCookie(res.headers, request)
    return res
  })
}
