import { computeOverview } from '../../../../packages/shared/src/overview/compute'
import type { OverviewFilter } from '../../../../packages/shared/src/overview/model'
import { overviewPrefsSchema, parsePrefs } from '../../../../packages/shared/src/overview/prefs'
import { requireUser, type RequestData } from '../../_lib/auth'
import { HttpError, runHandler } from '../../_lib/http'
import { readOverviewData } from '../../_services/overviewData'
import { renderShareCard } from '../../_services/overviewShareCard'

export function shareFilter(raw: string): OverviewFilter {
  try {
    if (!raw || raw.length > 8192 || !/^[A-Za-z0-9_-]+$/.test(raw)) throw new Error('Invalid encoding')
    const bytes = Uint8Array.from(atob(raw.replaceAll('-', '+').replaceAll('_', '/')), char => char.charCodeAt(0))
    const parsed: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes))
    return overviewPrefsSchema.shape.filter.parse(parsed)
  } catch { throw new HttpError(400, 'Invalid overview filter', 'INVALID_FILTER') }
}

export const onRequestGet: PagesFunction<Env, string, RequestData> = context => runHandler(async () => {
  const user = requireUser(context.data)
  const raw = new URL(context.request.url).searchParams.get('filter')
  const explicit = raw === null ? null : shareFilter(raw)
  const profile = await context.env.DB.prepare('SELECT overview_prefs FROM profiles WHERE id = ?').bind(user.id)
    .first<{ overview_prefs: string | null }>()
  if (!profile) throw new HttpError(404, 'Profile not found', 'NOT_FOUND')
  const filter = explicit ?? parsePrefs(profile.overview_prefs).filter
  const payload = await readOverviewData(context.env.DB, user.id)
  if (!payload.derivedReady) throw new HttpError(503, 'Overview is updating. Please try again.', 'DERIVED_PENDING')
  return renderShareCard(computeOverview(payload, filter), context)
})
