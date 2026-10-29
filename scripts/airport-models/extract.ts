/** One-time import of an explicitly supplied official OSM snapshot. No network access. */
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { adapter, type Config, type Element } from './normalize'
import { containsPoint } from '../../apps/next/src/lib/airport-models/geometry'
const [code, path] = process.argv.slice(2)
if (!code || !path)
  throw new Error('Usage: tsx scripts/airport-models/extract.ts TBS|BER snapshot.json')
const config = JSON.parse(
  readFileSync(`scripts/airport-models/sources/${code}.config.json`, 'utf8'),
) as Config
const raw = readFileSync(path),
  doc = JSON.parse(raw.toString()),
  elements = doc.elements as Element[]
const hash = createHash('sha256').update(raw).digest('hex')
if (hash !== config.sourceSha256) throw new Error('Snapshot hash differs from configured source')
const a = adapter(elements, (p) => [p[0] * 100000, p[1] * 100000]),
  boundary = a.polygons(a.get(config.identity))
const selected = new Set<string>([config.identity]),
  index = new Map(elements.map((e) => [`${e.type}/${e.id}`, e]))
const omitted: { id: string; reason: string }[] = []
for (const e of elements) {
  const t = e.tags ?? {}
  if (
    !t.building &&
    !t['building:part'] &&
    !t['area:aeroway'] &&
    ![
      'runway',
      'taxiway',
      'taxilane',
      'apron',
      'parking_position',
      'gate',
      'terminal',
      'hangar',
      'tower',
    ].includes(t.aeroway ?? '')
  )
    continue
  try {
    const p =
      e.type === 'node'
        ? [[e.lon! * 100000, e.lat! * 100000] as [number, number]]
        : e.type === 'way'
          ? a.points(e)
          : a.polygons(e).flatMap((p) => p.outer)
    if (p.some((p) => boundary.some((b) => containsPoint(b.outer, p))))
      selected.add(`${e.type}/${e.id}`)
  } catch (error) {
    omitted.push({ id: `${e.type}/${e.id}`, reason: String(error) })
  }
}
function dependencies(key: string, visiting = new Set<string>()) {
  if (visiting.has(key)) return
  visiting.add(key)
  const e = index.get(key)
  if (!e) throw new Error(`Missing source dependency ${key}`)
  for (const id of e.nodes ?? []) {
    const k = `node/${id}`
    selected.add(k)
    dependencies(k, visiting)
  }
  for (const m of e.members ?? []) {
    const k = `${m.type}/${m.ref}`
    selected.add(k)
    dependencies(k, visiting)
  }
}
for (const key of [...selected]) dependencies(key)
const extract = {
  version: doc.version,
  generator: doc.generator,
  bounds: doc.bounds ?? null,
  copyright: 'OpenStreetMap contributors',
  licence: 'ODbL-1.0',
  elements: elements
    .filter((e) => selected.has(`${e.type}/${e.id}`))
    .sort((a, b) => a.type.localeCompare(b.type) || a.id - b.id),
}
writeFileSync(`scripts/airport-models/sources/${code}.osm.json`, JSON.stringify(extract) + '\n')
writeFileSync(
  `scripts/airport-models/sources/${code}.extraction.json`,
  JSON.stringify(
    { sourceElements: elements.length, extractElements: extract.elements.length, omitted },
    null,
    2,
  ) + '\n',
)
