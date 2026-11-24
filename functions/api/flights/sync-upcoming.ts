import { runHandler, json } from '../_lib/http'
import { requireCsrf, requireUser, type RequestData } from '../_lib/auth'
import { isDerivedReady, repairUserDerivedState, stateOf } from '../_services/derivedState'
import { applyDueTransitions } from '../_services/lifecycle'

export const onRequestPost: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => {
    const { request, env, data } = context
    requireCsrf(request)
    const user = requireUser(data)

    const due = await applyDueTransitions(env.DB, { userId: user.id })
    const state = await stateOf(env.DB, user.id)
    const derived =
      state && !isDerivedReady(state) ? await repairUserDerivedState(env.DB, user.id) : {}
    return json({
      synced: due.synced,
      awaited: due.awaited,
      autoConfirmed: due.autoConfirmed,
      more: due.more,
      ...derived,
    })
  })
