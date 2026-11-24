const memory = new Map<string, string[]>()

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
  } catch {}
  const fresh = previous ? codes.filter((code) => !previous.includes(code)) : []
  const seen = [...new Set([...(previous ?? []), ...codes])]
  memory.set(key, seen)
  try {
    storage.setItem(key, JSON.stringify(seen))
  } catch {}
  return fresh
}

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
  } catch {}
  if (!previous && !stored) return
  const seen = [...new Set([...(previous ?? []), ...(stored ?? []), code])]
  memory.set(key, seen)
  try {
    storage.setItem(key, JSON.stringify(seen))
  } catch {}
}
