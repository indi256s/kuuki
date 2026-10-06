// POST /api/flights/sync-upcoming — the owner's due lifecycle transitions (ADR 0001 §2, R1): upcoming flights whose
// stored morning-after boundary has passed become awaiting, and awaiting flights past their stored 7-day boundary
// are auto-confirmed, then derived state is published. Awaiting flights count as completed.
//
// Returns { synced, awaited, autoConfirmed, more, derived_state?, revision? }. `synced` counts distinct flights whose
// state changed (a flight making both moves counts once).
// `more` asks the caller for another bounded pass. This is the Next member shell's only path for both transitions
// while the cron is held (the ActivityBridge trigger).

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
    // Any unpublished state is repaired inline: this pass's own dirty mark, a repair that failed earlier, and a stale
    // evidence stamp left by a publication below the rollback floor (ADR 0001 §10), so a member's first session
    // reconciles even while the cron is held.
    const state = await stateOf(env.DB, user.id)
    const derived = state && !isDerivedReady(state) ? await repairUserDerivedState(env.DB, user.id) : {}
    return json({ synced: due.synced, awaited: due.awaited, autoConfirmed: due.autoConfirmed, more: due.more, ...derived })
  })
