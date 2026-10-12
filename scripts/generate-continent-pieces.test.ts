import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { pieces } from './generate-continent-pieces'

type Point = [number, number]
const side = ([ax, ay]: Point, [bx, by]: Point, [x, y]: Point) =>
  (bx - ax) * (y - ay) - (by - ay) * (x - ax)
const crosses = (a: Point, b: Point, c: Point, d: Point) =>
  side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0

const geo = JSON.parse(
  readFileSync(
    new URL('../apps/next/public/maps/countries-110m-2.0.2-r2.geojson', import.meta.url),
    'utf8',
  ),
)
geo.features = geo.features.filter(
  (feature: { properties: { id: string } }) => feature.properties.id === 'TR',
)
const asia = pieces(geo, {}).get('asia')!
assert.equal(asia.length, 1, 'Asian Turkey must form one connected outline')
for (const ring of asia) {
  for (let i = 0; i < ring.length; i++) {
    for (let j = i + 1; j < ring.length; j++) {
      assert.ok(
        !crosses(ring[i], ring[(i + 1) % ring.length], ring[j], ring[(j + 1) % ring.length]),
        `Asian Turkey outline crosses itself at edges ${i} and ${j}`,
      )
    }
  }
}
console.log('continent generation cases passed')
