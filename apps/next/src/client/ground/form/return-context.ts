// Where a form returns to. Only the list's own filters are accepted from the URL, so a crafted link can never
// send the member to an arbitrary address (page-flow contract: allowlisted return context).

const LIST = '/ground-travel'

type Raw = string | string[] | undefined

/**
 * `mode=rail&status=cancelled` or the list's own `/ground-travel?mode=rail&status=cancelled` (what list links send)
 * → `/ground-travel?mode=rail&status=cancelled`; anything else → the plain list.
 */
export function safeReturn(raw: Raw): string {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (!value || value.length > 200) return LIST
  const query = value.startsWith(LIST) ? value.slice(LIST.length) : value
  if (value.startsWith(LIST) && query !== '' && !query.startsWith('?')) return LIST
  const incoming = new URLSearchParams(query.replace(/^\?/, ''))
  const kept = new URLSearchParams()
  const mode = incoming.get('mode')
  if (mode === 'rail' || mode === 'road') kept.set('mode', mode)
  if (incoming.get('status') === 'cancelled') kept.set('status', 'cancelled')
  const search = kept.toString()
  return search ? `${LIST}?${search}` : LIST
}

/** The list address that opens a saved journey's detail, keeping the filters of the return context. */
export function savedHref(returnTo: string, journeyId: string): string {
  const [, query = ''] = returnTo.split('?')
  const params = new URLSearchParams(query)
  params.set('journey', journeyId)
  return `${LIST}?${params.toString()}`
}
