// The ground-travel list URL: `?mode=rail|road`, `?status=cancelled`, `?journey=<UUID>`. The URL mirrors the view
// state (page-flow contract "Адреса и возврат"); anything else in the query is dropped.

import { isUuid, type GroundMode } from '@kuuki/shared/groundTravel'

export const GROUND_PATH = '/ground-travel'

export type GroundView = {
  mode: GroundMode | null
  cancelled: boolean
  journey: string | null
}

export const emptyView: GroundView = { mode: null, cancelled: false, journey: null }

export function parseGroundUrl(search: string): GroundView {
  const params = new URLSearchParams(search)
  const mode = params.get('mode')
  const journey = params.get('journey')
  return {
    mode: mode === 'rail' || mode === 'road' ? mode : null,
    cancelled: params.get('status') === 'cancelled',
    journey: isUuid(journey) ? journey.toLowerCase() : null,
  }
}

export function groundSearch(view: GroundView): string {
  const params = new URLSearchParams()
  if (view.mode) params.set('mode', view.mode)
  if (view.cancelled) params.set('status', 'cancelled')
  if (view.journey) params.set('journey', view.journey)
  return params.toString()
}

export function groundHref(view: GroundView): string {
  const query = groundSearch(view)
  return query ? `${GROUND_PATH}?${query}` : GROUND_PATH
}

/** Query key a form reads to come back to the list it was opened from. */
export const RETURN_PARAM = 'return'

/** `new` and `edit` links carry the list address so Cancel and Save can return to the same filters. */
export function withReturn(path: string, view: GroundView): string {
  const joiner = path.includes('?') ? '&' : '?'
  return `${path}${joiner}${RETURN_PARAM}=${encodeURIComponent(groundHref(view))}`
}
