import { airportAssetPaths } from './catalog.generated'

const paths = new Set(airportAssetPaths)
/** Only generated public data, never a route fallback or a private response. */
export function immutableAirportAsset(request: Request, response: Response): boolean {
  if (!paths.has(new URL(request.url).pathname)) return false
  if (request.method !== 'GET' && request.method !== 'HEAD') return false
  if (response.status !== 200 && response.status !== 304) return false
  if (response.headers.has('Set-Cookie')) return false
  const path = new URL(request.url).pathname
  const expected = path.endsWith('.svg')
    ? 'image/svg+xml'
    : path.endsWith('.json')
      ? 'application/json'
      : 'text/plain'
  const mime = response.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase()
  return mime === expected || (response.status === 304 && mime === undefined)
}
