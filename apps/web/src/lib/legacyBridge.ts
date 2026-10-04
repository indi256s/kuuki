/** The compatibility app only returns to known Next entry routes. */
const returnPaths = new Set(['/overview', '/journal', '/passport', '/settings', '/signin'])

export function allowedLegacyReturn(raw: string | null): string | null {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return null
  try {
    const url = new URL(raw, window.location.origin)
    if (url.origin !== window.location.origin || !returnPaths.has(url.pathname)) return null
    return url.pathname
  } catch {
    return null
  }
}

export type LegacyEntry =
  | { action: 'add' }
  | { action: 'addCountry' }
  | { action: 'edit'; flightId: number }
  | { action: 'claim'; countryCode: string }

export function parseLegacyEntry(search: string): LegacyEntry | null {
  const params = new URLSearchParams(search)
  const action = params.get('action')
  if (action === 'add') return { action }
  if (action === 'addCountry') return { action }
  if (action === 'edit') {
    const id = params.get('flightId')
    if (id && /^[1-9]\d*$/.test(id) && Number.isSafeInteger(Number(id))) {
      return { action, flightId: Number(id) }
    }
  }
  if (action === 'claim') {
    const countryCode = params.get('countryCode')
    if (countryCode && /^[A-Z]{2}$/.test(countryCode)) return { action, countryCode }
  }
  return null
}

export function returnAfterLegacyWrite(search: string): void {
  const path = allowedLegacyReturn(new URLSearchParams(search).get('returnTo'))
  if (path) window.location.assign(path)
}
