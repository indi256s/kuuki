// Draws the lane vehicles with the app's iso Scene (the ladder figures' kernel, parts and tone roles) and installs them.
//
//   pnpm exec tsx scripts/leaderboard-lanes/scene-art.ts
//
// Writes apps/next/src/client/leaderboard/lanes/:
//   art/<KEY>.svg            one <symbol id="lane-KEY"> per airliner type, the locomotive (rail) and the car (road).
//                            The page imports them as static media, so each gets a content-hashed, cached URL and a
//                            board fetches only the files its <use> elements name.
//   vehicles.generated.css   the host rule for the <svg> that holds a <use>.
//   lanes.generated.ts       the URLs plus the geometry a lane needs: viewBox, nose and ground line per family.
// and a preview gallery, .scratch/leaderboard-lanes/scene/gallery.html (serve the folder over http: <use> needs it).
//
// Paints are the Scene's theme roles written as the same CSS variables IsoFigure uses, so the art follows the theme
// through the <use> boundary (custom properties inherit into the clone). The accent ramp is the member's livery.
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { IsoNode, Paint } from '../../apps/next/src/client/overview/iso/scene'
import {
  airliner,
  type AircraftGeometry,
} from '../../apps/next/src/client/leaderboard/lanes/draw/airliner'
import {
  CAR_LENGTH,
  LOCO_LENGTH,
  car,
  locomotive,
} from '../../apps/next/src/client/leaderboard/lanes/draw/ground'
import { LaneScene, W } from '../../apps/next/src/client/leaderboard/lanes/draw/lane-scene'

const DATA = 'packages/data/src/aircraft-geometry'
const OUT = 'apps/next/src/client/leaderboard/lanes'
const PREVIEW = '.scratch/leaderboard-lanes/scene'
const TYPES = [
  'A319',
  'A320',
  'A20N',
  'A321',
  'A21N',
  'A332',
  'A333',
  'A359',
  'A35K',
  'A388',
  'B733',
  'B738',
  'B38M',
  'B763',
  'B788',
  'B77W',
  'E170',
  'E195',
  'SU95',
  'DH8B',
]
const REFERENCE = 'A21N'
/** Drawn length of the reference airliner (and of each ground vehicle), in viewBox units = CSS px at --lane-unit. */
const UNIT = 112
/** Lengths blend true scale and equal weight: drawn length ∝ length^MASS, so big types stay bigger and small ones keep lane weight. */
const MASS = 0.55

const PAINT: Record<string, string> = {
  top: 'var(--lane-top,var(--iso-top))',
  front: 'var(--lane-front,var(--iso-front))',
  side: 'var(--iso-side)',
  line: 'var(--iso-line)',
  crease: 'var(--iso-crease)',
  detail: 'var(--iso-detail)',
  glass: 'var(--iso-glass)',
  ghost: 'var(--iso-ghost)',
  accent: 'var(--lv)',
  'accent-side': 'color-mix(in oklab,var(--lv) 80%,black)',
  'accent-plate': 'var(--lv)',
  shadow: 'var(--iso-shadow)',
  shade: 'var(--iso-shadow)',
  none: 'none',
}
const paint = (p: Paint) => {
  const v = PAINT[p]
  if (!v) throw new Error(`lane art: no paint for ${p}`)
  return v
}

// ---------------------------------------------------------------- drawing

type Drawn = {
  key: string
  title: string
  nodes: IsoNode[]
  nose: number
  tail: number
  ground: number
  slope: number
}

function draw(
  key: string,
  title: string,
  k: number,
  build: (s: LaneScene) => { tail: number; groundY: number },
): Drawn {
  const s = new LaneScene(k)
  const { tail, groundY } = build(s)
  const slope = s.slope()
  const fig = s.done()
  // Nose tip at x = 0 (local x = 0 is the nose on every vehicle); the ground line under the near wheels at y = 0.
  const [nx, ny0] = s.project(W([0, groundY, 0]))
  const ny = ny0 - slope * nx
  const [tx] = s.project(W([tail, 0, 0]))
  return { key, title, nodes: fig.nodes, nose: nx, tail: tx, ground: ny, slope }
}

/** Douglas–Peucker: drops points closer than `eps` to the line through their neighbours (0.06 px at lane size). */
const EPS = 0.06
function simplify(pts: [number, number][], closed: boolean): [number, number][] {
  const dedup = pts.filter(
    (p, i) => i === 0 || Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) > 1e-3,
  )
  if (dedup.length < 4) return dedup
  const rdp = (a: number, b: number, keep: boolean[]) => {
    const [ax, ay] = dedup[a],
      [bx, by] = dedup[b]
    const dx = bx - ax,
      dy = by - ay,
      l = Math.hypot(dx, dy) || 1e-9
    let far = -1,
      best = EPS
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((dedup[i][0] - ax) * dy - (dedup[i][1] - ay) * dx) / l
      if (d > best) {
        best = d
        far = i
      }
    }
    if (far < 0) return
    keep[far] = true
    rdp(a, far, keep)
    rdp(far, b, keep)
  }
  const n = dedup.length
  const keep = dedup.map((_, i) => i === 0 || i === n - 1)
  if (closed) {
    // Split the ring at its farthest point from the first, so both halves are open runs.
    let far = 1
    for (let i = 1; i < n; i++)
      if (
        Math.hypot(dedup[i][0] - dedup[0][0], dedup[i][1] - dedup[0][1]) >
        Math.hypot(dedup[far][0] - dedup[0][0], dedup[far][1] - dedup[0][1])
      )
        far = i
    keep[far] = true
    rdp(0, far, keep)
    rdp(far, n - 1, keep)
  } else rdp(0, n - 1, keep)
  return dedup.filter((_, i) => keep[i])
}

/** Levels and moves every point: shear y' = y − slope·x, then the nose/ground origin to (0, 0). */
function place(d: Drawn) {
  const pt = (x: number, y: number): [number, number] => [x - d.nose, y - d.slope * x - d.ground]
  const r = (n: number) => Math.round(n * 10) / 10
  const box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }
  const grow = (x: number, y: number) => {
    box.x0 = Math.min(box.x0, x)
    box.y0 = Math.min(box.y0, y)
    box.x1 = Math.max(box.x1, x)
    box.y1 = Math.max(box.y1, y)
  }
  const points = (str: string, track: boolean) =>
    simplify(
      str
        .trim()
        .split(/\s+/)
        .map((p) => {
          const [x, y] = p.split(',').map(Number)
          const q = pt(x, y)
          if (track) grow(q[0], q[1])
          return q
        }),
      true,
    )
      .map(([a, b]) => `${r(a)},${r(b)}`)
      .join(' ')
  const path = (d: string) =>
    d
      .split('M')
      .filter(Boolean)
      .map((run) => {
        const closed = run.trimEnd().endsWith('Z')
        const pts = run
          .replace('Z', '')
          .split('L')
          .map((p) => {
            const [x, y] = p.trim().split(/\s+/).map(Number)
            const q = pt(x, y)
            grow(q[0], q[1])
            return q
          })
        return (
          'M' +
          simplify(pts, closed)
            .map(([a, b]) => `${r(a)} ${r(b)}`)
            .join('L') +
          (closed ? 'Z' : '')
        )
      })
      .join('')
  const out: string[] = []
  const emit = (nodes: readonly IsoNode[]) => {
    for (const n of nodes) {
      if (n.kind === 'polygon') {
        const cast = n.fill === 'shadow' && n.stroke === 'none'
        const style = [`fill:${paint(n.fill)}`, `stroke:${paint(n.stroke)}`]
        if (n.strokeOpacity != null) style.push(`stroke-opacity:${n.strokeOpacity}`)
        if (n.opacity != null) style.push(`opacity:${n.opacity}`)
        if (cast) style.push('filter:blur(var(--lane-halo-blur,2px))')
        out.push(
          `<polygon points="${points(n.points, !cast)}"${n.stroke !== 'none' ? ` stroke-width="${n.width ?? 1}"` : ''} style="${style.join(';')}"/>`,
        )
      } else if (n.kind === 'path') {
        const style = [`fill:${paint(n.fill)}`, `stroke:${paint(n.stroke)}`]
        out.push(
          `<path d="${path(n.d)}"${n.stroke !== 'none' ? ` stroke-width="${n.width}"` : ''} style="${style.join(';')}"/>`,
        )
      } else if (n.kind === 'group' || n.kind === 'glow') emit(n.children)
      else throw new Error(`lane art: ${n.kind} nodes are not drawn on lanes`)
    }
  }
  emit(d.nodes)
  return { body: out.join(''), box, length: d.nose - d.tail }
}

// ---------------------------------------------------------------- the fleet and the ground vehicles

const records = new Map<string, AircraftGeometry>()
for (const file of readdirSync(DATA).filter((f) => f.endsWith('.json')))
  for (const rec of JSON.parse(readFileSync(join(DATA, file), 'utf8')) as AircraftGeometry[])
    records.set(rec.icao, rec)
const ref = records.get(REFERENCE)!
const refLen = ref.fuselage.end ?? ref.dims.length
const kAir = UNIT / refLen

const air: Drawn[] = []
for (const icao of [...TYPES, 'GENERIC']) {
  const rec = records.get(icao === 'GENERIC' ? 'A320' : icao)
  if (!rec) throw new Error(`no geometry for ${icao}`)
  const len = rec.fuselage.end ?? rec.dims.length
  const k = kAir * Math.pow(len / refLen, MASS - 1)
  air.push(draw(icao, icao === 'GENERIC' ? 'An airliner' : rec.name, k, (s) => airliner(s, rec)))
}
const ground: Drawn[] = [
  draw('rail', 'An electric locomotive', UNIT / LOCO_LENGTH, locomotive),
  draw('road', 'A coupé', UNIT / CAR_LENGTH, car),
]

// ---------------------------------------------------------------- write

const r2 = (n: number) => Math.round(n * 100) / 100
function family(list: Drawn[], unit: number) {
  const placed = list.map((d) => ({ d, ...place(d) }))
  const pad = 3
  const x0 = Math.min(...placed.map((p) => p.box.x0)) - pad,
    y0 = Math.min(...placed.map((p) => p.box.y0)) - pad,
    x1 = Math.max(...placed.map((p) => p.box.x1)) + pad,
    y1 = Math.max(...placed.map((p) => p.box.y1)) + pad
  const viewBox = [r2(x0), r2(y0), r2(x1 - x0), r2(y1 - y0)]
  return {
    placed,
    viewBox,
    geometry: {
      viewBox,
      nose: Math.round((-x0 / (x1 - x0)) * 10000) / 10000,
      ground: Math.round((-y0 / (y1 - y0)) * 10000) / 10000,
      unit,
    },
  }
}
const airFamily = family(
  air,
  r2(air.find((d) => d.key === REFERENCE)!.nose - air.find((d) => d.key === REFERENCE)!.tail),
)
const groundFamily = family(ground, UNIT)

const symbol = (key: string, title: string, viewBox: number[], body: string) =>
  `<symbol id="lane-${key}" viewBox="${viewBox.join(' ')}"><title>${title}</title><g style="--lv:var(--lane-livery,var(--figure-live-fill))" stroke-linejoin="round" stroke-linecap="round">${body}</g></symbol>`
// The root carries the symbol's size: Next reads image dimensions from every imported SVG.
const file = (key: string, title: string, viewBox: number[], body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(viewBox[2])}" height="${Math.ceil(viewBox[3])}">${symbol(key, title, viewBox, body)}</svg>`

rmSync(join(OUT, 'art'), { recursive: true, force: true })
mkdirSync(join(OUT, 'art'), { recursive: true })
mkdirSync(PREVIEW, { recursive: true })
let bytes = 0
for (const fam of [airFamily, groundFamily])
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
`,
)
const keys = [...air.map((d) => d.key), 'rail', 'road']
const id = (key: string) => `art_${key}`
writeFileSync(
  join(OUT, 'lanes.generated.ts'),
  `// Generated by scripts/leaderboard-lanes/scene-art.ts. Do not edit.
${keys.map((key) => `import ${id(key)} from './art/${key}.svg'`).join('\n')}

export const LANE_TYPES = ${JSON.stringify(air.map((d) => d.key).sort())} as const
export type LaneVehicleKey = (typeof LANE_TYPES)[number] | 'rail' | 'road'

/** Static imports resolve to a URL string under Vite and to image data under Next. */
type Asset = string | { src: string }
export const laneArt: Record<LaneVehicleKey, Asset> = {
${keys.map((key) => `  ${key}: ${id(key)},`).join('\n')}
}

/** Per family: the shared viewBox, where the nose meets the ground (fractions of it), and the reference's drawn length. */
export const laneGeometry = {
  air: ${JSON.stringify(airFamily.geometry)},
  ground: ${JSON.stringify(groundFamily.geometry)},
} as const
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
        ? card(groundFamily, key, 448).replace('<figure>', '<figure style="--lane-livery:#5aa39a">')
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
