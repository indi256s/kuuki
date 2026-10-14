const memory = new Map<string, string[]>()

/**
 * Countries pressed since this owner last saw the page. The first visit on a device only records the baseline, so an
 * existing collection never replays; later arrivals are returned once. The seen set only grows (a hidden country
 * keeps its place), and a tab-local copy stands in when storage is blocked.
 */
export function unseenCountries(
  ownerId: string,
  codes: readonly string[],
  storage: Pick<Storage, 'getItem' | 'setItem'>,
): string[] {
  const key = `kuuki:passport-seen:${ownerId}`
  let previous = memory.get(key)
  try {
    const raw = storage.getItem(key)
    if (raw) {
      const value: unknown = JSON.parse(raw)
      if (Array.isArray(value) && value.every((code) => typeof code === 'string'))
        previous = previous ? [...new Set([...previous, ...value])] : value
    }
  } catch {
    /* blocked or malformed storage keeps the tab baseline */
  }
  const fresh = previous ? codes.filter((code) => !previous.includes(code)) : []
  const seen = [...new Set([...(previous ?? []), ...codes])]
  memory.set(key, seen)
  try {
    storage.setItem(key, JSON.stringify(seen))
  } catch {
    /* memory prevents a remount replay */
  }
  return fresh
}
