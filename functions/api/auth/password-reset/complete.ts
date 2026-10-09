import { runHandler, readJson, json, HttpError } from '../../_lib/http'
import { requireStrictSameOrigin } from '../../_lib/auth'
import { rateLimit, clientIp } from '../../_lib/ratelimit'
import { completePasswordRecovery } from '../../_lib/passwordRecovery'
import { parsePassword } from '../../_lib/users'
import { clearSessionCookies } from '../../_lib/authCookies'
import { clearBetterAuthCookie } from '../../_lib/betterAuth'

export async function completePasswordReset(request: Request, env: Env): Promise<Response> {
  const response = await runHandler(async () => {
    requireStrictSameOrigin(request)
    await rateLimit(env.DB, `recovery-complete:${clientIp(request)}`, 20, 3600)
    const bearer = request.headers.get('Authorization')
    const token = bearer?.startsWith('Bearer ') ? bearer.slice(7) : ''
    const body = await readJson<{ password?: unknown }>(request)
    const password = parsePassword(body?.password, 'new')
    if (!token || !(await completePasswordRecovery(env.DB, token, password, env.AUTH_SECRET))) {
      throw new HttpError(400, 'Recovery link is invalid or expired', 'INVALID_RECOVERY')
    }
    const result = json({ ok: true })
    clearSessionCookies(result.headers)
    clearBetterAuthCookie(result.headers, request)
    return result
  })
  response.headers.set('Referrer-Policy', 'no-referrer')
  return response
}

export const onRequestPost: PagesFunction<Env> = ({ request, env }) =>
  completePasswordReset(request, env)
