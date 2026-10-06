// Deterministic connection chains (ADR 0001 §4). No trips entity: a link is derived from two legs, a chain
// is a maximal path of unambiguous links, and ambiguity is review-only and never suppresses a country.
//
// Flight `date` is a date-only label and is never passed to `new Date(date)`; it is only compared and
// shifted with the calendar helper. Instants (`departure_utc`, `arrival_utc`) are canonical ISO strings.
import { addDays } from '../../../packages/shared/src/calendar'

export interface ConnectionLeg {
  id: number
  date: string
  origin: string
  destination: string
  departure_utc: string | null
  arrival_utc: string | null
  origin_country: string | null
  destination_country: string | null
}

/** `precise`: both instants known and 0..24h apart. `estimated`: date-only, same or next calendar day. */
export type ConnectionLabel = 'precise' | 'estimated'

export type ConnectionDecision =
  | { kind: 'none' }
  | { kind: 'ambiguous'; candidateIds: number[] }
  | {
      kind: 'link'
      toId: number
      label: ConnectionLabel
      /** Country of the incoming leg's destination, the airport the connection happens at. */
      hubCountry: string | null
      startCountry: string | null
      finalCountry: string | null
      /** The hub is in neither the chain's start nor its final country. Only these suggest transit. */
      thirdCountry: boolean
      chainIds: number[]
    }

export const MAX_CONNECTION_GAP_MS = 24 * 3_600_000

const instant = (value: string | null): number | null => {
  if (!value) return null
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? null : parsed
}

// `flights.date` has no DB CHECK. A label that is not YYYY-MM-DD cannot be shifted, so that leg is treated as
// undated: it never forms or extends a chain (its endpoints still count as ordinary evidence).
const DATE_LABEL = /^\d{4}-\d{2}-\d{2}$/

const utcDay = (ms: number) => new Date(ms).toISOString().slice(0, 10)

interface Node {
  leg: ConnectionLeg
  dep: number | null
  arr: number | null
}

/** Ordered by reliable instant first, then date, with the id as the stable tiebreak. Affects traversal only. */
const sortKey = (node: Node) => (node.dep === null ? `${node.leg.date}T00:00:00.000Z` : new Date(node.dep).toISOString())
const byTraversal = (a: Node, b: Node) => {
  const left = sortKey(a)
  const right = sortKey(b)
  return left < right ? -1 : left > right ? 1 : a.leg.id - b.leg.id
}

/**
 * One decision per leg, keyed by the incoming leg's id. Link A->B exists only when B is A's single candidate
 * and A is B's single candidate in the winning tier (precise outranks estimated); anything else with a
 * candidate is ambiguous. A cycle (an untimed same-date pair that cannot be ordered) is ambiguous too.
 */
export function connectionChains(allLegs: ConnectionLeg[]): Map<number, ConnectionDecision> {
  const legs = allLegs.filter(leg => DATE_LABEL.test(leg.date))
  const nodes = legs.map<Node>(leg => ({ leg, dep: instant(leg.departure_utc), arr: instant(leg.arrival_utc) })).sort(byTraversal)

  // Origin airport -> date label -> legs departing there, so candidate search touches a few days only.
  const byOrigin = new Map<string, Map<string, Node[]>>()
  for (const node of nodes) {
    const days = byOrigin.get(node.leg.origin) ?? new Map<string, Node[]>()
    const sameDay = days.get(node.leg.date) ?? []
    sameDay.push(node)
    days.set(node.leg.date, sameDay)
    byOrigin.set(node.leg.origin, days)
  }

  const precise = new Map<number, Set<number>>()
  const estimated = new Map<number, Set<number>>()
  const reversePrecise = new Map<number, Set<number>>()
  const reverseEstimated = new Map<number, Set<number>>()
  const add = (forward: Map<number, Set<number>>, reverse: Map<number, Set<number>>, from: number, to: number) => {
    forward.set(from, (forward.get(from) ?? new Set()).add(to))
    reverse.set(to, (reverse.get(to) ?? new Set()).add(from))
  }

  for (const a of nodes) {
    const days = byOrigin.get(a.leg.destination)
    if (!days) continue
    // Label dates that can hold a candidate: the estimate window, plus (for a timed arrival) every day a 24h
    // window can touch once local-day labels (up to ±1 day from UTC) are allowed for.
    const wanted = new Set([a.leg.date, addDays(a.leg.date, 1)])
    if (a.arr !== null) {
      const arrDay = utcDay(a.arr)
      for (let shift = -2; shift <= 3; shift += 1) wanted.add(addDays(arrDay, shift))
    }
    for (const day of wanted) {
      for (const b of days.get(day) ?? []) {
        if (b.leg.id === a.leg.id) continue
        if (a.arr !== null && b.dep !== null) {
          const gap = b.dep - a.arr
          if (gap >= 0 && gap <= MAX_CONNECTION_GAP_MS) add(precise, reversePrecise, a.leg.id, b.leg.id)
        } else if (b.leg.date === a.leg.date || b.leg.date === addDays(a.leg.date, 1)) {
          add(estimated, reverseEstimated, a.leg.id, b.leg.id)
        }
      }
    }
  }

  // The winning tier's candidate set: precise when any exists, otherwise estimated.
  const winning = (p: Map<number, Set<number>>, e: Map<number, Set<number>>, id: number) => {
    const exact = p.get(id)
    if (exact?.size) return { tier: 'precise' as const, ids: [...exact].sort((x, y) => x - y) }
    return { tier: 'estimated' as const, ids: [...(e.get(id) ?? [])].sort((x, y) => x - y) }
  }

  const links = new Map<number, { to: number; label: ConnectionLabel }>()
  const ambiguous = new Map<number, number[]>()
  for (const { leg } of nodes) {
    const next = winning(precise, estimated, leg.id)
    if (next.ids.length === 0) continue
    const only = next.ids.length === 1 ? next.ids[0] : null
    const previous = only === null ? null : winning(reversePrecise, reverseEstimated, only)
    if (only !== null && previous && previous.ids.length === 1 && previous.ids[0] === leg.id) {
      links.set(leg.id, { to: only, label: next.tier })
    } else {
      ambiguous.set(leg.id, next.ids)
    }
  }

  // A cycle among unambiguous links cannot be ordered: demote every member to ambiguous.
  const visited = new Set<number>()
  for (const start of links.keys()) {
    if (visited.has(start)) continue
    const path = new Set<number>()
    let cursor = start
    while (links.has(cursor) && !visited.has(cursor) && !path.has(cursor)) {
      path.add(cursor)
      cursor = links.get(cursor)!.to
    }
    if (path.has(cursor)) {
      let cycle = cursor
      do {
        const next = links.get(cycle)!.to
        ambiguous.set(cycle, [next]); links.delete(cycle)
        cycle = next
      } while (cycle !== cursor)
    }
    for (const id of path) visited.add(id)
  }

  const legById = new Map(nodes.map(node => [node.leg.id, node.leg]))
  const hasIncoming = new Set([...links.values()].map(link => link.to))
  const chainOf = new Map<number, { ids: number[]; start: string | null; final: string | null }>()
  for (const { leg } of nodes) {
    if (hasIncoming.has(leg.id) || !links.has(leg.id)) continue // chains are walked from their head
    const ids = [leg.id]
    let tail = leg
    while (links.has(tail.id)) { tail = legById.get(links.get(tail.id)!.to)!; ids.push(tail.id) }
    const chain = { ids, start: leg.origin_country, final: tail.destination_country }
    for (const id of ids) chainOf.set(id, chain)
  }

  const decisions = new Map<number, ConnectionDecision>()
  for (const leg of allLegs) if (!DATE_LABEL.test(leg.date)) decisions.set(leg.id, { kind: 'none' })
  for (const { leg } of nodes) {
    const link = links.get(leg.id)
    if (link) {
      const chain = chainOf.get(leg.id)!
      const hub = leg.destination_country
      decisions.set(leg.id, {
        kind: 'link', toId: link.to, label: link.label, hubCountry: hub, startCountry: chain.start, finalCountry: chain.final,
        // An unknown country (unmapped airport) never supports suppression, wherever it sits in the chain.
        thirdCountry: hub !== null && chain.start !== null && chain.final !== null && hub !== chain.start && hub !== chain.final, chainIds: chain.ids,
      })
    } else if (ambiguous.has(leg.id)) {
      decisions.set(leg.id, { kind: 'ambiguous', candidateIds: ambiguous.get(leg.id)! })
    } else {
      decisions.set(leg.id, { kind: 'none' })
    }
  }
  return decisions
}
