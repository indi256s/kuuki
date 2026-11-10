// Draws the lane vehicles and installs them: the airliners as 1:N models with the pinned anatomy kit (./airliner); the
// locomotive, the car, the yacht and the balloon with the same pinned kit and parametric surfaces.
//
//   pnpm exec tsx scripts/leaderboard-lanes/scene-art.ts
//
// Writes apps/next/src/client/leaderboard/lanes/:
//   art/<KEY>.svg            one <symbol id="lane-KEY"> per airliner type, the locomotive (rail), the car (road) and,
//                            for the Passport atlas only, the yacht (sea) and the balloon (other).
//                            The page imports them as static media, so each gets a content-hashed, cached URL and a
//                            board fetches only the files its <use> elements name.
//   vehicles.generated.css   the host rule for the <svg> that holds a <use>, and the airliners' material ramps.
//   lanes.generated.ts       the URLs plus the geometry a lane needs: viewBox, nose, centre line, taxiway strip and
//                            its slant per family; each airliner's beacon, frame and measured size for its spotter card.
// and a preview gallery, .scratch/leaderboard-lanes/scene/gallery.html (serve the folder over http: <use> needs it).
//
// Paints are the theme's iso roles written as CSS variables, so the art follows the theme through the <use> boundary
// (custom properties inherit into the clone). The accent ramp is the member's livery.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { LaneScene, W } from '../../apps/next/src/client/leaderboard/lanes/draw/lane-scene'
import { AIR_UNIT, airSkew, buildAir } from './airliner/build'
import { AIRCRAFT_CSS } from './airliner/svg'
import { BALLOON_CSS, buildBalloon } from './balloon/balloon'
import { buildCar } from './car/car'
import { buildLocomotive } from './locomotive/locomotive'
import { LENGTH as LOCO_LENGTH, RAIL } from './locomotive/model'
import { YACHT_CSS, buildYacht } from './yacht/yacht'

const OUT = 'apps/next/src/client/leaderboard/lanes'
const PREVIEW = '.scratch/leaderboard-lanes/scene'
/** Drawn length of each ground vehicle, in viewBox units = CSS px at --lane-unit. */
const UNIT = 112

// ---------------------------------------------------------------- the ground vehicles

/** The ground camera's across-the-lane direction (CSS skewX, deg) and the rails' offset from the centre line. */
function groundCross() {
  const s = new LaneScene(UNIT / LOCO_LENGTH)
  const slope = s.slope()
  const level = (p: [number, number, number]) => {
    const [x, y] = s.project(W(p))
    return [x, y - slope * x]
  }
  const [o, y, r] = [level([0, 0, 0]), level([0, 1, 0]), level([0, RAIL, 0])]
  return { skew: (Math.atan2(y[0] - o[0], y[1] - o[1]) * 180) / Math.PI, rail: r[1] - o[1] }
}

// ---------------------------------------------------------------- write

const r2 = (n: number) => Math.round(n * 100) / 100
type Placed = {
  d: { key: string; title: string }
  body: string
  box: { x0: number; y0: number; x1: number; y1: number }
  gear: number
}
/** The taxiway strip's half-height: the widest main gear in the family, with a margin of tarmac either side. */
const DECK = (gear: number) => gear * 1.5 + 2
function family(placed: Placed[], unit: number, skew: number) {
  const pad = 3
  const x0 = Math.min(...placed.map((p) => p.box.x0)) - pad,
    y0 = Math.min(...placed.map((p) => p.box.y0)) - pad,
    x1 = Math.max(...placed.map((p) => p.box.x1)) + pad,
    y1 = Math.max(...placed.map((p) => p.box.y1)) + pad
  const viewBox = [r2(x0), r2(y0), r2(x1 - x0), r2(y1 - y0)]
  const f4 = (n: number) => Math.round(n * 10000) / 10000
  return {
    placed,
    viewBox,
    geometry: {
      viewBox,
      nose: f4(-x0 / (x1 - x0)),
      ground: f4(-y0 / (y1 - y0)),
      deck: f4(DECK(Math.max(...placed.map((p) => p.gear))) / (y1 - y0)),
      skew: Math.round(skew * 100) / 100,
      unit,
    },
  }
}
async function main() {
  const built = await buildAir()
  const air = built.map((a) => ({
    d: { key: a.key, title: a.title },
    body: a.body,
    box: a.box,
    gear: a.gear,
  }))
  const airFamily = family(air, AIR_UNIT, await airSkew())
  const cross = groundCross()
  const loco = await buildLocomotive(UNIT)
  const groundFamily = family([loco, await buildCar(UNIT)], UNIT, cross.skew)
  // The atlas's own vehicles: each its own frame, so a tall balloon never resizes the ground lanes.
  const solo = {
    sea: family([await buildYacht(UNIT)], UNIT, cross.skew),
    other: family([await buildBalloon(UNIT)], UNIT, cross.skew),
  }
  const f4 = (n: number) => Math.round((n / groundFamily.viewBox[3]) * 10000) / 10000
  // The locomotive runs on a narrower bed than the car's road: its own strip, and the rails on it.
  const rail = { offset: f4(cross.rail), deck: f4(DECK(loco.gear)) }
  const r1 = (n: number) => Math.round(n * 10) / 10
  const spots = Object.fromEntries(
    built.map((a) => [
      a.key,
      {
        name: a.title,
        length: a.length,
        span: a.span,
        box: [r1(a.box.x0), r1(a.box.y0), r1(a.box.x1 - a.box.x0), r1(a.box.y1 - a.box.y0)],
        beacon: [r1(a.beacon[0]), r1(a.beacon[1])],
      },
    ]),
  )

  const symbol = (key: string, title: string, viewBox: number[], body: string) =>
    `<symbol id="lane-${key}" viewBox="${viewBox.join(' ')}"><title>${title}</title><g style="--lv:var(--lane-livery,var(--figure-live-fill))" stroke-linejoin="round" stroke-linecap="round">${body}</g></symbol>`
  // The root carries the symbol's size: Next reads image dimensions from every imported SVG.
  const file = (key: string, title: string, viewBox: number[], body: string) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(viewBox[2])}" height="${Math.ceil(viewBox[3])}">${symbol(key, title, viewBox, body)}</svg>`

  rmSync(join(OUT, 'art'), { recursive: true, force: true })
  mkdirSync(join(OUT, 'art'), { recursive: true })
  mkdirSync(PREVIEW, { recursive: true })
  let bytes = 0
  for (const fam of [airFamily, groundFamily, ...Object.values(solo)])
    for (const p of fam.placed) {
      const svg = file(p.d.key, p.d.title, fam.viewBox, p.body)
      bytes += svg.length
      writeFileSync(join(OUT, 'art', `${p.d.key}.svg`), svg)
      writeFileSync(join(PREVIEW, `${p.d.key}.svg`), svg)
    }

  writeFileSync(
    join(OUT, 'vehicles.generated.css'),
    `/* Generated by scripts/leaderboard-lanes/scene-art.ts. Do not edit. */
.lane-vehicle{display:block;width:100%;height:auto;overflow:visible}
/* Dark faces sit one step off the surface, as on the ladder heroes, or a vehicle reads as a wireframe. */
:root[data-theme='dark'] .lane-vehicle{--lane-top:color-mix(in oklab,var(--iso-top) 86%,var(--text));--lane-front:color-mix(in oklab,var(--iso-front) 90%,var(--text))}
${AIRCRAFT_CSS}
${YACHT_CSS}
${BALLOON_CSS}
`,
  )
  const keys = [...air.map((p) => p.d.key), 'rail', 'road', ...Object.keys(solo)]
  const id = (key: string) => `art_${key}`
  const atlasKeys = Object.keys(solo)
    .map((k) => `'${k}'`)
    .join(' | ')
  writeFileSync(
    join(OUT, 'lanes.generated.ts'),
    `// Generated by scripts/leaderboard-lanes/scene-art.ts. Do not edit.
${keys.map((key) => `import ${id(key)} from './art/${key}.svg'`).join('\n')}

export const LANE_TYPES = ${JSON.stringify(air.map((p) => p.d.key).sort())} as const
export type LaneVehicleKey = (typeof LANE_TYPES)[number] | 'rail' | 'road'
/** The Passport atlas's own vehicles, never on a lane. */
export type AtlasVehicleKey = ${atlasKeys}

/** Static imports resolve to a URL string under Vite and to image data under Next. */
type Asset = string | { src: string }
export const laneArt: Record<LaneVehicleKey | AtlasVehicleKey, Asset> = {
${keys.map((key) => `  ${key}: ${id(key)},`).join('\n')}
}

/**
 * Per family: the shared viewBox; as fractions of it, where the nose stands, where the centre line meets the ground and
 * the taxiway strip's half-height; the strip's slant across the lane (skewX, deg); the reference's drawn length. The
 * ground family adds the locomotive's bed: its half-height and the rails' offset from the centre line. The atlas's own
 * vehicles (sea, other) each have a frame of their own.
 */
export const laneGeometry = {
  air: ${JSON.stringify(airFamily.geometry)},
  ground: ${JSON.stringify({ ...groundFamily.geometry, rail })},
${Object.entries(solo)
  .map(([k, f]) => `  ${k}: ${JSON.stringify(f.geometry)},`)
  .join('\n')}
} as const

/** Each airliner: its name and measured length and span (m), its own frame and its upper beacon, in viewBox units. */
export const laneSpots: Record<(typeof LANE_TYPES)[number], {
  name: string
  length: number
  span: number
  box: readonly [number, number, number, number]
  beacon: readonly [number, number]
}> = ${JSON.stringify(spots)}
`,
  )

  // Preview: every vehicle on a lane-width card, at desktop (unit 112) and phone (unit 64) size, in both themes.
  const styles = readFileSync('apps/next/src/app/styles.css', 'utf8')
  const card = (fam: ReturnType<typeof family>, key: string, unitPx: number) => {
    const w = (fam.viewBox[2] / fam.geometry.unit) * unitPx
    const [x, y, vw, vh] = fam.viewBox
    return `<figure><svg class="lane-vehicle" style="width:${r2(w)}px" viewBox="${fam.viewBox.join(' ')}"><use href="${key}.svg#lane-${key}" x="${x}" y="${y}" width="${vw}" height="${vh}"/></svg><figcaption>${key}</figcaption></figure>`
  }
  const inks = ['#c86b8a', '#6c86c8', '#5aa39a', '#c89a5a']
  const section = () =>
    `<section>${[112, 64]
      .map(
        (u) =>
          `<div class="grid" data-unit="${u}">${[
            ...airFamily.placed.map((p, i) =>
              card(airFamily, p.d.key, u).replace(
                '<figure>',
                `<figure style="--lane-livery:${inks[i % 4]}">`,
              ),
            ),
            ...groundFamily.placed.map((p, i) =>
              card(groundFamily, p.d.key, u).replace(
                '<figure>',
                `<figure style="--lane-livery:${inks[(i + 1) % 4]}">`,
              ),
            ),
          ].join('')}</div>`,
      )
      .join('')}</section>`
  const zoom = (keys: string[]) =>
    `<section><div class="grid">${keys
      .map((key) =>
        key === 'rail' || key === 'road'
          ? card(groundFamily, key, 448).replace(
              '<figure>',
              '<figure style="--lane-livery:#5aa39a">',
            )
          : card(airFamily, key, 448).replace('<figure>', '<figure style="--lane-livery:#c86b8a">'),
      )
      .join('')}</div></section>`
  const ZOOM = (process.env.ZOOM ?? 'A21N B77W DH8B B38M A388 E170 rail road').split(' ')
  for (const [name, body] of [
    ['gallery', section()],
    ['zoom', zoom(ZOOM)],
  ] as const)
    for (const theme of ['light', 'dark'])
      writeFileSync(
        join(PREVIEW, `${name}-${theme}.html`),
        `<!doctype html><html data-theme="${theme}"><meta charset="utf-8"><title>Lane vehicles</title><style>${styles.replace(/@import[^;]+;/g, '')}
body{margin:0;font:12px system-ui;background:var(--background);color:var(--text)}section{padding:24px}
.grid{display:flex;flex-wrap:wrap;gap:28px 36px;align-items:end;margin-bottom:32px}figure{margin:0}
figcaption{color:var(--text-muted);margin-top:4px}</style><style>${readFileSync(join(OUT, 'vehicles.generated.css'), 'utf8')}</style>
${body}`,
      )
  console.log(
    `lane art: ${air.length} airliners + rail + road, ${Math.round(bytes / 1024)} KB · air viewBox ${airFamily.viewBox.join(' ')} · ground ${groundFamily.viewBox.join(' ')}`,
  )
}
void main()
