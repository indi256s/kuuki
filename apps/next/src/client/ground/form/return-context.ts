const LIST = '/ground-travel'

type Raw = string | string[] | undefined

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

export function savedHref(returnTo: string, journeyId: string): string {
  const [, query = ''] = returnTo.split('?')
  const params = new URLSearchParams(query)
  params.set('journey', journeyId)
  return `${LIST}?${params.toString()}`
}
