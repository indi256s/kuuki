import proj4 from 'proj4'
import polygonClipping from 'polygon-clipping'
import { containsPoint, signedArea } from '../../apps/next/src/lib/airport-models/geometry'
import type {
  AirportFeature,
  AirportModelV1,
  Measure,
  PointM,
  PolygonM,
  SourceProvenance,
} from '../../apps/next/src/lib/airport-models/model'

export type Element = {
  type: 'node' | 'way' | 'relation'
  id: number
  lat?: number
  lon?: number
  nodes?: number[]
  geometry?: { lat: number; lon: number }[]
  members?: { type: string; ref: number; role: string; geometry?: { lat: number; lon: number }[] }[]
  tags?: Record<string, string>
  [key: string]: unknown
}
export type Config = {
  iata: string
  icao: string
  name: string
  identity: string
  zone: number
  centre: PointM
  expectedRunways: number
  estimates: {
    building: number
    terminal: number
    hangar: number
    tower: number
    level: number
    taxiway: number
    runway: number
  }
  sourceSha256: string
  sourceUrl: string
  fetchedAt: string | null
  osmTimestamp: string | null
  extractedAt: string
  sourceUrls?: string[]
  sourceBboxes?: number[][]
  acquisition?: string
}
export const GENERATOR_VERSION = 'airport-models/1.0.0'
export function measure(
  raw: string | undefined,
  fallback: number,
  source: Measure['source'] = 'default',
): Measure {
  if (raw === undefined) return { metres: fallback, source }
  const match = /^\s*(\d+(?:\.\d+)?)\s*(m|ft|feet)?\s*$/i.exec(raw)
  if (!match) throw new Error(`Unsupported distance: ${raw}`)
  return {
    metres:
      Number(match[1]) *
      (match[2]?.toLowerCase() === 'ft' || match[2]?.toLowerCase() === 'feet' ? 0.3048 : 1),
    source: 'osm',
    raw,
  }
}
function intersects(a: PointM, b: PointM, c: PointM, d: PointM): boolean {
  const cross = (p: PointM, q: PointM, r: PointM) =>
    (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])
  const on = (p: PointM, q: PointM, r: PointM) =>
    Math.abs(cross(p, q, r)) < 1e-8 &&
    r[0] >= Math.min(p[0], q[0]) - 1e-8 &&
    r[0] <= Math.max(p[0], q[0]) + 1e-8 &&
    r[1] >= Math.min(p[1], q[1]) - 1e-8 &&
    r[1] <= Math.max(p[1], q[1]) + 1e-8
  return (
    (cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0) ||
    on(a, b, c) ||
    on(a, b, d) ||
    on(c, d, a) ||
    on(c, d, b)
  )
}
function ringsIntersect(a: PointM[], b: PointM[]): boolean {
  return a.slice(1).some((p, i) => b.slice(1).some((q, j) => intersects(a[i]!, p, b[j]!, q)))
}
export function adapter(elements: Element[], project: (point: PointM) => PointM) {
  const index = new Map(elements.map((e) => [`${e.type}/${e.id}`, e]))
  const get = (key: string) => {
    const e = index.get(key)
    if (!e) throw new Error(`Missing dependency ${key}`)
    return e
  }
  const points = (way: Element): PointM[] =>
    way.geometry
      ? way.geometry.map((p) => project([p.lon, p.lat]))
      : (way.nodes ?? []).map((id) => {
          const n = get(`node/${id}`)
          if (typeof n.lon !== 'number' || typeof n.lat !== 'number')
            throw new Error(`Missing coordinates node/${id}`)
          return project([n.lon, n.lat])
        })
  const same = (a: PointM, b: PointM) => Math.hypot(a[0] - b[0], a[1] - b[1]) <= 0.01
  const ring = (input: PointM[], positive: boolean): PointM[] => {
    const p = input.filter((v, i) => i === 0 || !same(v, input[i - 1]!))
    if (p.length < 4 || !same(p[0]!, p.at(-1)!)) throw new Error('Unclosed ring (tolerance 0.01 m)')
    p[p.length - 1] = p[0]!
    for (let i = 0; i < p.length - 1; i++)
      for (let j = i + 2; j < p.length - 1; j++) {
        if (i === 0 && j === p.length - 2) continue
        const a = p[i]!,
          b = p[i + 1]!,
          c = p[j]!,
          d = p[j + 1]!
        if (intersects(a, b, c, d)) throw new Error('Self-intersecting ring')
      }
    if (Math.abs(signedArea(p)) < 0.01) throw new Error('Degenerate ring')
    return signedArea(p) > 0 === positive ? p : [...p].reverse()
  }
  const join = (segments: PointM[][], positive: boolean) => {
    const remaining = segments.map((s) => [...s]),
      rings: PointM[][] = []
    while (remaining.length) {
      const chain = remaining.shift()!
      while (!same(chain[0]!, chain.at(-1)!)) {
        const matches = remaining.flatMap((s, i) =>
          same(chain.at(-1)!, s[0]!)
            ? [{ i, reverse: false }]
            : same(chain.at(-1)!, s.at(-1)!)
              ? [{ i, reverse: true }]
              : [],
        )
        if (matches.length !== 1)
          throw new Error(`Broken/ambiguous ring (${matches.length} continuations)`)
        const { i, reverse } = matches[0]!,
          next = remaining.splice(i, 1)[0]!
        chain.push(...(reverse ? next.reverse() : next).slice(1))
      }
      rings.push(ring(chain, positive))
    }
    return rings
  }
  const polygons = (e: Element): PolygonM[] => {
    if (e.type === 'way') return [{ outer: ring(points(e), true), holes: [] }]
    if (e.type !== 'relation') throw new Error('Not a polygon')
    const members = e.members?.filter((m) => m.type === 'way') ?? []
    const memberPoints = (m: (typeof members)[number]) =>
      m.geometry ? m.geometry.map((p) => project([p.lon, p.lat])) : points(get(`way/${m.ref}`))
    if (e.tags?.type === 'building') {
      const outlines = members.filter((m) => m.role === 'outline')
      if (outlines.length)
        return join(outlines.map(memberPoints), true).map((outer) => ({ outer, holes: [] }))
      const parts = members
        .filter((m) => m.role === 'part')
        .map((m) => [ring(memberPoints(m), true)])
      if (!parts.length) throw new Error('Building relation has no outline or parts')
      const merged = polygonClipping.union(parts[0]!, ...parts.slice(1))
      return merged.map((rings) => ({
        outer: rings[0]! as PointM[],
        holes: rings.slice(1) as PointM[][],
      }))
    }
    const outers = join(
      members.filter((m) => m.role === 'outer' || m.role === '').map(memberPoints),
      true,
    ).map((outer) => ({ outer, holes: [] as PointM[][] }))
    if (!outers.length) throw new Error('Missing outer rings')
    for (const hole of join(members.filter((m) => m.role === 'inner').map(memberPoints), false)) {
      const owners = outers
        .filter((p) => containsPoint(p.outer, hole[0]!))
        .sort((a, b) => Math.abs(signedArea(a.outer)) - Math.abs(signedArea(b.outer)))
      if (!owners.length) throw new Error('Orphan inner ring')
      if (
        ringsIntersect(owners[0]!.outer, hole) ||
        !hole.slice(0, -1).every((p) => containsPoint(owners[0]!.outer, p))
      )
        throw new Error('Inner ring crosses outer')
      if (
        owners[0]!.holes.some(
          (other) =>
            ringsIntersect(other, hole) ||
            containsPoint(other, hole[0]!) ||
            containsPoint(hole, other[0]!),
        )
      )
        throw new Error('Overlapping inner rings')
      owners[0]!.holes.push(hole)
    }
    return outers
  }
  return { get, points, polygons }
}
type BuildingFeature = Extract<AirportFeature, { type: 'building' }>

function reconcileBuildingVolumes(buildings: BuildingFeature[]) {
  const toClip = (polygons: PolygonM[]) => polygons.map((p) => [p.outer, ...p.holes])
  const area = (polygons: PolygonM[]) =>
    polygons.reduce(
      (sum, p) =>
        sum +
        Math.abs(signedArea(p.outer)) -
        p.holes.reduce((holes, ring) => holes + Math.abs(signedArea(ring)), 0),
      0,
    )
  const fromClip = (polygons: ReturnType<typeof polygonClipping.difference>): PolygonM[] =>
    polygons.map((rings) => ({ outer: rings[0]! as PointM[], holes: rings.slice(1) as PointM[][] }))
  const bounds = new Map(
    buildings.map((f) => {
      const points = f.polygons.flatMap((p) => p.outer)
      return [
        f.id,
        [
          Math.min(...points.map((p) => p[0])),
          Math.min(...points.map((p) => p[1])),
          Math.max(...points.map((p) => p[0])),
          Math.max(...points.map((p) => p[1])),
        ],
      ]
    }),
  )
  const areas = new Map(buildings.map((f) => [f.id, area(f.polygons)]))
  const ordered = [...buildings].sort(
    (a, b) => areas.get(a.id)! - areas.get(b.id)! || a.id.localeCompare(b.id, 'en'),
  )
  const rank = new Map(ordered.map((feature, index) => [feature.id, index]))
  for (const parent of ordered.filter((f) => !f.isPart)) {
    const p = bounds.get(parent.id)!
    const components = buildings.filter((child) => {
      if (child.id === parent.id) return false
      const c = bounds.get(child.id)!
      if (c[0]! >= p[2]! || c[2]! <= p[0]! || c[1]! >= p[3]! || c[3]! <= p[1]!) return false
      // Parts can be represented by several overlapping semantic outlines. Their
      // explicit parent ID remains intact, but none of those outlines may cover them.
      if (child.isPart) return true
      // One strict total order prevents tolerance-based cycles between near-equal footprints.
      if (rank.get(child.id)! >= rank.get(parent.id)!) return false
      // A contained, separately mapped building replaces an aggregate envelope;
      // unrelated partial overlaps retain their original physical representation.
      return (
        area(
          fromClip(polygonClipping.difference(toClip(child.polygons), toClip(parent.polygons))),
        ) <= 0.01
      )
    })
    if (!components.length) continue
    const low = parent.minHeight.metres,
      high = parent.height.metres
    const replacesEnvelope = (component: BuildingFeature) =>
      !component.isPart && component.minHeight.metres <= low && component.height.metres > low
    const levels = [
      ...new Set([
        low,
        high,
        ...components
          .filter((component) => !replacesEnvelope(component))
          .flatMap((component) => [component.minHeight.metres, component.height.metres])
          .filter((height) => height > low && height < high),
      ]),
    ].sort((a, b) => a - b)
    parent.volumeSlices = []
    for (let index = 1; index < levels.length; index++) {
      const minHeightM = levels[index - 1]!,
        heightM = levels[index]!
      const intersecting = components.filter(
        (component) =>
          replacesEnvelope(component) ||
          (component.minHeight.metres < heightM && component.height.metres > minHeightM),
      )
      const remainder = intersecting.length
        ? fromClip(
            polygonClipping.difference(
              toClip(parent.polygons),
              ...intersecting.map((component) => toClip(component.polygons)),
            ),
          )
        : parent.polygons
      if (remainder.length) parent.volumeSlices.push({ polygons: remainder, minHeightM, heightM })
    }
    parent.renderFootprint = parent.volumeSlices.length > 0
  }
}

export function normalize(elements: Element[], config: Config, extractSha256: string) {
  if (
    config.centre[1] < 0 ||
    config.centre[1] > 84 ||
    config.centre[0] < -180 ||
    config.centre[0] > 180 ||
    Math.floor((config.centre[0] + 180) / 6) + 1 !== config.zone
  )
    throw new Error('Unsupported UTM region')
  const crs = `EPSG:326${config.zone}`,
    definition = `+proj=utm +zone=${config.zone} +datum=WGS84 +units=m +no_defs`
  const origin = proj4('EPSG:4326', definition, config.centre) as PointM
  const project = (p: PointM): PointM => {
    const v = proj4('EPSG:4326', definition, p)
    return [
      Math.round((v[0]! - origin[0]) * 100) / 100,
      Math.round((v[1]! - origin[1]) * 100) / 100,
    ]
  }
  const a = adapter(elements, project),
    identity = a.get(config.identity),
    tags = identity.tags ?? {}
  if (tags.iata !== config.iata || tags.icao !== config.icao)
    throw new Error(`Airport identity mismatch ${config.identity}`)
  const boundary = a.polygons(identity),
    all = boundary.flatMap((p) => p.outer)
  const boundsM: [number, number, number, number] = [
    Math.min(...all.map((p) => p[0])),
    Math.min(...all.map((p) => p[1])),
    Math.max(...all.map((p) => p[0])),
    Math.max(...all.map((p) => p[1])),
  ]
  if (Math.max(...all.map((p) => Math.hypot(...p))) > 50000)
    throw new Error('Airport exceeds supported 50 km local projection radius')
  const inside = (p: PointM) =>
    boundary.some((b) => containsPoint(b.outer, p) && !b.holes.some((h) => containsPoint(h, p)))
  const diagnostics: { id: string; reason: string }[] = [],
    features: AirportFeature[] = []
  const memberWays = new Set(
    elements
      .filter((e) => e.type === 'relation')
      .flatMap(
        (e) =>
          e.members
            ?.filter(
              (m) =>
                m.type === 'way' &&
                (e.tags?.type === 'multipolygon' ||
                  (e.tags?.type === 'building' && m.role === 'outline')),
            )
            .map((m) => m.ref) ?? [],
      ),
  )
  for (const e of elements) {
    const t = { ...e.tags },
      id = `osm:${e.type}/${e.id}`
    if (`${e.type}/${e.id}` === config.identity || (e.type === 'way' && memberWays.has(e.id)))
      continue
    if (e.type === 'relation' && t.type === 'building') {
      const outlines = (e.members ?? [])
        .filter((m) => m.type === 'way' && m.role === 'outline')
        .map((m) => a.get(`way/${m.ref}`).tags ?? {})
      const keys = new Set(outlines.flatMap((tags) => Object.keys(tags)))
      for (const key of keys) {
        if (t[key] !== undefined) continue
        const values = new Set(
          outlines.map((tags) => tags[key]).filter((value): value is string => value !== undefined),
        )
        if (values.size > 1) throw new Error(`${id}: Conflicting building outline tag ${key}`)
        if (values.size === 1) t[key] = values.values().next().value!
      }
    }
    const controlTower =
      t['tower:type'] === 'control_tower' ||
      t.service === 'aircraft_control' ||
      (t['tower:type'] === 'observation' && t.service === 'air_traffic_control')
    const kind = controlTower ? 'tower' : (t['area:aeroway'] ?? t.aeroway)
    const building =
      !!t.building || !!t['building:part'] || ['terminal', 'hangar', 'tower'].includes(kind ?? '')
    if (
      !building &&
      !['runway', 'taxiway', 'taxilane', 'apron', 'parking_position', 'gate'].includes(kind ?? '')
    )
      continue
    try {
      const pp =
        e.type === 'node'
          ? [project([e.lon!, e.lat!])]
          : e.type === 'way'
            ? a.points(e)
            : a.polygons(e).flatMap((p) => p.outer)
      if (!pp.some(inside)) {
        diagnostics.push({ id, reason: 'outside airport boundary' })
        continue
      }
      const base = {
        id,
        kind: (kind === 'parking_position'
          ? 'stand'
          : kind === 'taxilane'
            ? 'taxiway'
            : ['runway', 'taxiway', 'apron', 'terminal', 'hangar', 'tower', 'gate'].includes(
                  kind ?? '',
                )
              ? kind
              : 'building') as AirportFeature['kind'],
        ...(t['name:en'] || t.name ? { label: t['name:en'] || t.name } : {}),
        ...(t.ref ? { ref: t.ref } : {}),
        ...(t.surface ? { surface: t.surface } : {}),
      }
      if (e.type === 'node') {
        features.push({ ...base, type: 'point', point: pp[0]! })
        continue
      }
      if (building) {
        const levels = t['building:levels'] === undefined ? undefined : Number(t['building:levels'])
        if (levels !== undefined && (!Number.isFinite(levels) || levels < 0))
          throw new Error('Invalid building levels')
        const fallback =
          config.estimates[base.kind as 'terminal' | 'hangar' | 'tower'] ??
          config.estimates.building
        const height = measure(
          t.height,
          levels === undefined ? fallback : levels * config.estimates.level,
          levels === undefined ? 'default' : 'levels',
        )
        if (levels !== undefined && !t.height) height.raw = t['building:levels']
        const minLevel =
          t['building:min_level'] === undefined ? undefined : Number(t['building:min_level'])
        if (minLevel !== undefined && (!Number.isFinite(minLevel) || minLevel < 0))
          throw new Error('Invalid building min level')
        const minHeight = measure(
          t.min_height,
          minLevel === undefined ? 0 : minLevel * config.estimates.level,
          minLevel === undefined ? 'default' : 'levels',
        )
        if (height.metres < minHeight.metres) throw new Error('Building height below min_height')
        features.push({
          ...base,
          type: 'building',
          polygons: a.polygons(e),
          height,
          minHeight,
          isPart: !!t['building:part'],
          renderFootprint: true,
        })
        continue
      }
      const area = !!t['area:aeroway'] || t.area === 'yes' || kind === 'apron'
      if (area) features.push({ ...base, type: 'surface', polygons: a.polygons(e) })
      else
        features.push({
          ...base,
          type: 'line',
          points: pp,
          ...(kind === 'runway'
            ? {
                ...(t.length ? { length: measure(t.length, 0) } : {}),
                geometryLength: {
                  metres: pp
                    .slice(1)
                    .reduce((sum, p, i) => sum + Math.hypot(p[0] - pp[i]![0], p[1] - pp[i]![1]), 0),
                  source: 'geometry' as const,
                },
              }
            : {}),
          width: measure(
            t.width,
            kind === 'runway'
              ? config.estimates.runway
              : kind === 'taxiway'
                ? config.estimates.taxiway
                : 2,
          ),
        })
    } catch (error) {
      const reason = String(error)
      if (building || kind === 'runway' || t['area:aeroway'] === 'runway')
        throw new Error(`${id}: ${reason}`)
      diagnostics.push({ id, reason })
    }
  }
  // Preserve source identities; only the physical extrusion remainder is reconciled.
  const buildings = features.filter(
    (f): f is Extract<AirportFeature, { type: 'building' }> => f.type === 'building',
  )
  for (const part of buildings.filter((f) => f.isPart)) {
    const candidates = buildings
      .filter(
        (f) =>
          !f.isPart && f.polygons.some((p) => containsPoint(p.outer, part.polygons[0]!.outer[0]!)),
      )
      .sort(
        (x, y) =>
          Math.abs(signedArea(x.polygons[0]!.outer)) - Math.abs(signedArea(y.polygons[0]!.outer)),
      )
    const relation = elements.find(
      (e) =>
        e.type === 'relation' &&
        e.tags?.type === 'building' &&
        e.members?.some((m) => m.role === 'part' && part.id === `osm:${m.type}/${m.ref}`),
    )
    const explicitParent = relation && buildings.find((f) => f.id === `osm:relation/${relation.id}`)
    if (explicitParent) part.parentId = explicitParent.id
    else if (candidates[0]) part.parentId = candidates[0].id
  }
  reconcileBuildingVolumes(buildings)
  const runways = features.filter(
    (f): f is Extract<AirportFeature, { type: 'line' }> => f.type === 'line' && f.kind === 'runway',
  )
  const endpointMatch = (x: PointM, y: PointM) => Math.hypot(x[0] - y[0], x[1] - y[1]) < 0.05
  const groups: (typeof runways)[] = []
  const remaining = new Set(runways.filter((f) => f.ref))
  while (remaining.size) {
    const group = [remaining.values().next().value!]
    remaining.delete(group[0]!)
    for (let i = 0; i < group.length; i++)
      for (const candidate of remaining) {
        const line = group[i]!
        if (
          line.ref === candidate.ref &&
          [line.points[0]!, line.points.at(-1)!].some((p) =>
            [candidate.points[0]!, candidate.points.at(-1)!].some((q) => endpointMatch(p, q)),
          )
        ) {
          group.push(candidate)
          remaining.delete(candidate)
        }
      }
    groups.push(group)
  }
  for (const line of runways.filter((f) => !f.ref)) {
    const peers = groups.filter((g) =>
      g.some((f) =>
        [f.points[0]!, f.points.at(-1)!].some((p) =>
          [line.points[0]!, line.points.at(-1)!].some((q) => endpointMatch(p, q)),
        ),
      ),
    )
    if (peers.length !== 1) throw new Error(`Unresolved runway identity ${line.id}`)
    peers[0]!.push(line)
  }
  for (const group of groups) {
    const physicalRunwayId = `runway:${config.iata}:${group[0]!.ref}`
    for (const f of group) {
      f.physicalRunwayId = physicalRunwayId
      f.directions = group[0]!.ref!.split('/').map((s) => s.trim())
    }
    for (const area of features.filter((f) => f.type === 'surface' && f.kind === 'runway')) {
      if (area.type !== 'surface') continue
      if (
        group.some((f) =>
          f.points.some((p) => area.polygons.some((poly) => containsPoint(poly.outer, p))),
        )
      ) {
        if (area.physicalRunwayId && area.physicalRunwayId !== physicalRunwayId)
          throw new Error('Ambiguous runway area')
        area.physicalRunwayId = physicalRunwayId
        area.directions = group[0]!.directions
        for (const f of group)
          f.areaCovered = area.polygons.some(
            (poly) =>
              f.points.every((p) => containsPoint(poly.outer, p)) &&
              !f.points
                .slice(1)
                .some(
                  (p, i) =>
                    ringsIntersect([f.points[i]!, p], poly.outer) ||
                    poly.holes.some(
                      (h) => ringsIntersect([f.points[i]!, p], h) || containsPoint(h, p),
                    ),
                ),
          )
      }
    }
  }
  if (groups.length !== config.expectedRunways)
    throw new Error(`Expected ${config.expectedRunways} physical runways, got ${groups.length}`)
  for (const line of features.filter((f) => f.type === 'line' && f.kind === 'taxiway'))
    if (line.type === 'line')
      line.areaCovered = features.some(
        (f) =>
          f.type === 'surface' &&
          f.kind === 'taxiway' &&
          line.points.every((p) => f.polygons.some((poly) => containsPoint(poly.outer, p))),
      )
  const provenance: SourceProvenance = {
    attribution: '© OpenStreetMap contributors',
    licence: 'ODbL-1.0',
    licenceUrl: 'https://opendatacommons.org/licenses/odbl/1-0/',
    sourceUrl: config.sourceUrl,
    sourceSha256: config.sourceSha256,
    extractSha256,
    fetchedAt: config.fetchedAt,
    osmTimestamp: config.osmTimestamp,
    extractedAt: config.extractedAt,
    generatorVersion: GENERATOR_VERSION,
    identity: config.identity,
    sourceUrls: config.sourceUrls,
    sourceBboxes: config.sourceBboxes,
    acquisition: config.acquisition,
  }
  const span = Math.max(boundsM[2] - boundsM[0], boundsM[3] - boundsM[1]),
    targetM: PointM = [(boundsM[0] + boundsM[2]) / 2, (boundsM[1] + boundsM[3]) / 2]
  const model: AirportModelV1 = {
    schemaVersion: 1,
    iata: config.iata,
    icao: config.icao,
    revision: '',
    projection: { crs, origin },
    boundsM,
    boundary,
    features: features.sort((x, y) => x.id.localeCompare(y.id, 'en')),
    cameras: {
      desktop: { targetM, azimuth: -0.6, elevation: 0.85, verticalSpanM: span * 0.95 },
      mobile: { targetM, azimuth: -0.6, elevation: 0.85, verticalSpanM: span * 2.1 },
    },
    provenance,
  }
  return { model, diagnostics, physicalRunways: groups.length }
}
