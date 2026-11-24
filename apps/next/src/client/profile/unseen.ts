import { badgeEventId, type EarnedBadge } from './achievements'

const memory = new Map<string, string[]>()
export function unseenBadges(
  ownerId: string,
  badges: EarnedBadge[],
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  scope: 'badge-events' | 'badge-cabinet' = 'badge-events',
) {
  const key = `kuuki:${scope}:${ownerId}`
  let previous = memory.get(key)
  try {
    const raw = storage.getItem(key)
    if (raw) {
      const value: unknown = JSON.parse(raw)
      if (Array.isArray(value) && value.every((id) => typeof id === 'string'))
        previous = previous ? [...new Set([...previous, ...value])] : value
    }
  } catch {}
  const ids = badges.map(badgeEventId)
  const fresh = previous ? badges.filter((item) => !previous.includes(badgeEventId(item))) : []
  const seen = [...new Set([...(previous ?? []), ...ids])]
  memory.set(key, seen)
  try {
    storage.setItem(key, JSON.stringify(seen))
  } catch {}
  return { badges: fresh, first: !!previous && previous.length === 0 && fresh.length > 0 }
}
