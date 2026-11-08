// Generates two files in apps/next/src/client/passport/atlas/: small-states.ts (one label point for every catalog
// country that the pinned 110m polygons do not draw; the atlas renders them as point markers) and label-points.ts (the
// same for every country the polygons do draw, where the atlas puts its name label). Drawn countries the source does
// not cover (or place outside the country's largest ring) are left out and the atlas falls back to that ring's
// bounding-box centre.
//
//   node scripts/generate-atlas-points.mjs <ne_10m_admin_0_label_points.geojson>
//
// Source (pinned, supplied by path so this script never fetches silently):
// https://raw.githubusercontent.com/nvkelso/natural-earth-vector/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_label_points.geojson
//
// That file is keyed by ISO 3166-1 alpha-3 (`sr_su_a3`, `sr_adm0_a3`), not alpha-2, so catalog codes are translated
// through the ISO3 column of the stamp index. Where one country has several points (archipelagos), the lowest
// `scalerank` wins (Natural Earth's own "most important label first"), then file order.
import { readFileSync, writeFileSync } from 'node:fs'

const [labelPath] = process.argv.slice(2)
if (!labelPath)
  throw new Error('usage: node scripts/generate-atlas-points.mjs <label-points.geojson>')

const outputDir = 'apps/next/src/client/passport/atlas'
const catalog = JSON.parse(readFileSync('packages/data/src/countries.json', 'utf8'))
const polygons = JSON.parse(
  readFileSync('apps/next/public/maps/countries-110m-2.0.2-r2.geojson', 'utf8'),
)
const stamps = JSON.parse(
  readFileSync('apps/next/src/lib/stamp-art/stamp-index.generated.json', 'utf8'),
)
const labels = JSON.parse(readFileSync(labelPath, 'utf8')).features

// Natural Earth files Svalbard and Kosovo under their own subunit/country codes, not the catalog's ISO3.
const NE_CODE = { SJ: 'NSV', XK: 'KOS' }

const drawn = new Set(polygons.features.map((feature) => feature.properties.id))
const iso3Of = (code) => NE_CODE[code] ?? stamps[code]?.iso3
const pointsFor = (iso3, key) =>
  labels.filter((feature) => feature.properties[key] === iso3 && feature.geometry?.type === 'Point')
const round = (feature) =>
  feature?.geometry.coordinates.map((value) => Math.round(value * 1e4) / 1e4) ?? null
/** The lowest scalerank wins; `closer` breaks a tie, else file order. */
const best = (features, closer = () => false) =>
  features.reduce(
    (current, feature) =>
      !current ||
      feature.properties.scalerank < current.properties.scalerank ||
      (feature.properties.scalerank === current.properties.scalerank && closer(feature, current))
        ? feature
        : current,
    null,
  )

const lookup = (code) => {
  const iso3 = iso3Of(code)
  const subunits = pointsFor(iso3, 'sr_su_a3')
  return round(best(subunits.length ? subunits : pointsFor(iso3, 'sr_adm0_a3')))
}

// A drawn country's label must sit on its main landmass: the file lists subunit points too (Corsica, Alaska, Svalbard),
// all tied at scalerank 0, so keep only points inside the largest outer ring and take the one nearest its centre.
const outerRings = (geometry) =>
  (geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates).map(
    ([ring]) => ring,
  )
const boxOf = (ring) => {
  const xs = ring.map((point) => point[0]),
    ys = ring.map((point) => point[1])
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
}
const inside = ([x, y], ring) => {
  let result = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i],
      [xj, yj] = ring[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) result = !result
  }
  return result
}
const mainland = (code) => {
  const iso3 = iso3Of(code)
  const feature = polygons.features.find((item) => item.properties.id === code)
  const main = outerRings(feature.geometry).reduce((best, ring) => {
    const [w, s, e, n] = boxOf(ring)
    const area = (e - w) * (n - s)
    return !best || area > best.area ? { ring, area, box: [w, s, e, n] } : best
  }, null)
  const [w, s, e, n] = main.box
  const centre = [(w + e) / 2, (s + n) / 2]
  const candidates = labels.filter(
    (feature) =>
      feature.geometry?.type === 'Point' &&
      (feature.properties.sr_su_a3 === iso3 || feature.properties.sr_adm0_a3 === iso3) &&
      inside(feature.geometry.coordinates, main.ring),
  )
  const distance = (feature) =>
    Math.hypot(
      feature.geometry.coordinates[0] - centre[0],
      feature.geometry.coordinates[1] - centre[1],
    )
  return round(best(candidates, (feature, current) => distance(feature) < distance(current)))
}
const points = { markers: {}, polygons: {} }
const unplaced = { markers: [], polygons: [] }
for (const code of Object.keys(catalog).sort()) {
  const kind = drawn.has(code) ? 'polygons' : 'markers'
  const point = kind === 'polygons' ? mainland(code) : lookup(code)
  if (point) points[kind][code] = point
  else unplaced[kind].push(code)
}

const source = `// Source: Natural Earth 10m admin-0 label points, pinned at
// https://raw.githubusercontent.com/nvkelso/natural-earth-vector/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_label_points.geojson`
const emit = (file, name, description, kind) => {
  const body = Object.entries(points[kind])
    .map(([code, [lon, lat]]) => `  ${code}: [${lon}, ${lat}],`)
    .join('\n')
  const missing = unplaced[kind]
  writeFileSync(
    `${outputDir}/${file}`,
    `// Generated by scripts/generate-atlas-points.mjs; do not edit by hand.
${source}
// ${description} (${Object.keys(points[kind]).length} placed, ${missing.length} unplaced${missing.length ? `: ${missing.join(', ')}` : ''}).
export const ${name}: Record<string, [number, number]> = {
${body}
}
`,
  )
  console.log(
    `${file}: placed ${Object.keys(points[kind]).length}, unplaced ${missing.length} ${missing.join(' ')}`,
  )
}
emit(
  'small-states.ts',
  'SMALL_STATE_POINTS',
  'One [lon, lat] per catalog country the 110m polygons do not draw',
  'markers',
)
emit(
  'label-points.ts',
  'LABEL_POINTS',
  'One [lon, lat] name-label point per catalog country the 110m polygons draw',
  'polygons',
)
