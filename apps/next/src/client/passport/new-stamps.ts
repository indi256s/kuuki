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

/**
 * Adds one country to the owner's seen baseline, so a stamp pressed on the atlas never replays on the cards. Without a
 * baseline nothing is recorded: the page's first read records the whole collection, this country included.
 */
export function markSeen(
  ownerId: string,
  code: string,
  storage: Pick<Storage, 'getItem' | 'setItem'>,
): void {
  const key = `kuuki:passport-seen:${ownerId}`
  const previous = memory.get(key)
  let stored: string[] | undefined
  try {
    const raw = storage.getItem(key)
    const value: unknown = raw ? JSON.parse(raw) : undefined
    if (Array.isArray(value) && value.every((item) => typeof item === 'string')) stored = value
  } catch {
    /* blocked or malformed storage keeps the tab baseline */
  }
  if (!previous && !stored) return
  const seen = [...new Set([...(previous ?? []), ...(stored ?? []), code])]
  memory.set(key, seen)
  try {
    storage.setItem(key, JSON.stringify(seen))
  } catch {
    /* memory prevents a remount replay */
  }
}
