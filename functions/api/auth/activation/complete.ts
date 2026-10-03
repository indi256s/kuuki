import { runHandler, readJson, json, HttpError } from '../../_lib/http'
import { requireStrictSameOrigin } from '../../_lib/auth'
import { rateLimit, clientIp } from '../../_lib/ratelimit'
import { completeActivation } from '../../_lib/activation'
import { configuredActivationOrigin } from '../../_lib/activationSender'

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const response = await runHandler(async () => {
    const { request, env } = context
    requireStrictSameOrigin(request)
    if (new URL(request.url).origin !== configuredActivationOrigin(env)) {
      throw new HttpError(403, 'Activation origin required', 'ACTIVATION_ORIGIN')
    }
    await rateLimit(env.DB, `activation-complete:${clientIp(request)}`, 20, 3600)
    const bearer = request.headers.get('Authorization')
    const token = bearer?.startsWith('Bearer ') ? bearer.slice(7) : ''
    const body = await readJson<{ password?: unknown }>(request)
    const password = body?.password
    if (typeof password !== 'string' || password.length < 8 || password.length > 1024) {
      throw new HttpError(400, 'Password must be 8–1024 characters', 'WEAK_PASSWORD')
    }
    if (!token || !(await completeActivation(env.DB, token, password, env.AUTH_SECRET))) {
      throw new HttpError(400, 'Activation link is invalid or expired', 'INVALID_ACTIVATION')
    }
    return json({ ok: true })
  })
  response.headers.set('Cache-Control', 'no-store')
  response.headers.set('Referrer-Policy', 'no-referrer')
  return response
}
