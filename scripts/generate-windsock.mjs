// Generates the route loading figure: an airfield windsock on a hinged mast. Kuuki is 空気, air; while a route loads the
// wind builds and the sock fills band by band (windsock-geom.ts has the model). Drawn with the anatomy skill's iso kit,
// pinned with the Concorde's (scripts/concorde/anatomy.lock.json; setup in scripts/concorde/README.md).
//
//   pnpm generate:windsock            writes apps/next/src/client/loading/windsock.generated.{ts,css}
//   pnpm generate:windsock --preview  also writes .scratch/windsock/preview{,-light}.html, with the sock full
//
// The static SVG is the mast and its fittings with the sock drawn limp; windsock.tsx redraws the sock in place.
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const pin = JSON.parse(
  readFileSync(new URL('./concorde/anatomy.lock.json', import.meta.url), 'utf8'),
)
const KIT = resolve(process.env.ANATOMY_KIT ?? '.scratch/concorde/anatomy/kit')
for (const file of ['iso-kit.mjs', 'iso.css']) {
  let actual
  try {
    actual = createHash('sha256')
      .update(readFileSync(join(KIT, file)))
      .digest('hex')
  } catch {
    throw new Error(`Missing anatomy kit file ${file}. See scripts/concorde/README.md for setup.`)
  }
  if (actual !== pin.sha256[file])
    throw new Error(
      `Anatomy kit ${file} differs from pinned commit ${pin.commit}. See scripts/concorde/README.md.`,
    )
}
const k = await import(pathToFileURL(join(KIT, 'iso-kit.mjs')))
const OUT = resolve('apps/next/src/client/loading')
const { SOCK, FULL_KNOTS, poseOf } = await import(pathToFileURL(join(OUT, 'windsock-geom.ts')))

// ---------- World ----------
const WIDTH = 360
const HEIGHT = 300
const AZIMUTH = 58
const Z = SOCK.Z
const PAD = { x: -26, y: -26, w: 52, d: 52, r: 2 }
const PAD_H = 7
const PLATE = { x: -11, y: -11, w: 22, d: 22, r: 1.6 }
const PLATE_TOP = PAD_H + 2
const MAST_R = 3
const HINGE_Z = PLATE_TOP + 9
const COLLAR_R = 4.6
const LOW = [Z - SOCK.R0 - 4, Z - SOCK.R0 + 2]
const HIGH = [Z + SOCK.R0 - 2, Z + SOCK.R0 + 4]
const TOP = HIGH[1] + 3

const P = k.fitProjection(
  [
    ...k.boxCorners(PAD, 0, PAD_H),
    [0, 0, TOP + 6],
    [SOCK.ARM + SOCK.LENGTH + 4, 0, Z + 4],
    [SOCK.ARM + SOCK.LENGTH * 0.95, 12, Z - 16],
    [SOCK.ARM, -SOCK.R0 - 14, Z],
    [SOCK.ARM + 30, 14, Z - SOCK.LENGTH * 0.92],
  ],
  WIDTH,
  HEIGHT,
  { pad: 10, azimuth: AZIMUTH },
)
const at = (point) => k.iso(point, P)
const S = (paths, style) => k.solidSvg(paths, style)
const L = (d, style) => k.lineSvg(d, style)
const D = (points, style) => k.dotsSvg(points, style)
const byDepth = (points) =>
  [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P))

// ---------- Footing ----------
function footing() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PAD, 0, PAD_H, P)}"/>`]
  out.push(
    S(k.slabOf(PAD, 0, PAD_H, P, 3, 1.2), {
      tone: 'lo',
      inner: L(k.sideSeam(PAD, 2.2, P, 3), { tone: 'faint' }),
    }),
  )
  out.push(L(k.planOutline(k.insetPlan(PAD, 3.5), PAD_H, P, 3), { tone: 'faint' }))
  // A cast-in maker's plate in the pad's near corner: three engraved rules stand for its text.
  const plate = { x: 6, y: 13, w: 14, d: 8, r: 0.8 }
  out.push(S(k.slabOf(plate, PAD_H, 0.5, P, 2, 0.3), { tone: 'lo', crease: 'none' }))
  out.push(
    L(
      [
        [8, 15.2, 9],
        [8, 17.2, 6],
        [8, 19.2, 8],
      ]
        .map(([x, y, w]) => k.lineOnTop([x, y], [x + w, y], PAD_H + 0.5, P))
        .join(''),
      { tone: 'faint', free: true },
    ),
  )
  // Base plate and four anchor nuts with washers.
  out.push(S(k.slabOf(PLATE, PAD_H, 2, P, 3, 0.5), { tone: 'mid' }))
  for (const [x, y] of byDepth(k.corners(PLATE, 3))) {
    out.push(L(k.ring(x, y, 2.1, PLATE_TOP, P, 16), { tone: 'lo' }))
    out.push(S(k.cylinder(x, y, 1.5, PLATE_TOP, 1.3, P, 6), { tone: 'mid' }))
    out.push(D([at([x, y, PLATE_TOP + 1.3])], { size: 0.45, tone: 'hi' }))
  }
  return out.join('')
}

// ---------- Hinged mast: the lugs and pin let it tip over for servicing the sock ----------
const lug = (y) => ({ x: -4, y, w: 8, d: 1.6, r: 0.4 })
function lugSvg(y, front) {
  const out = [
    S(k.slabOf(lug(y), PLATE_TOP, HINGE_Z + 3 - PLATE_TOP, P, 2, 0.3), {
      tone: 'mid',
    }),
  ]
  if (front) {
    out.push(L(k.sideRing([0, y + 1.6, HINGE_Z], 1.5, 'y', P, 16), { tone: 'hi' }))
    out.push(D([at([0, y + 1.6, HINGE_Z])], { size: 0.55, tone: 'hi' }))
    out.push(
      L(k.sideRing([2.4, y + 1.6, HINGE_Z - 5.5], 0.9, 'y', P, 12), {
        tone: 'lo',
      }),
    )
  }
  return out.join('')
}

function mast() {
  const out = []
  out.push(lugSvg(-MAST_R - 2.2, false))
  out.push(
    S(k.cylinder(0, 0, MAST_R + 0.6, PLATE_TOP, HINGE_Z + 6 - PLATE_TOP, P, 24), { tone: 'mid' }),
  )
  out.push(lugSvg(MAST_R + 0.6, true))
  // Lower and upper tube, joined by a sleeve; faint bands mark the tube's rolled seams.
  const seams = (z0, z1) =>
    L([z0, z1].map((z) => k.sideArc(0, 0, MAST_R, z, P, 16)).join(''), {
      tone: 'faint',
    })
  out.push(
    S(k.cylinder(0, 0, MAST_R, HINGE_Z + 6, 70 - HINGE_Z - 6, P, 24), {
      tone: 'mid',
      crease: 'none',
      inner: seams(36, 54),
    }),
  )
  out.push(
    S(k.cylinder(0, 0, MAST_R + 0.8, 70, 5, P, 24, 0.3), {
      tone: 'mid',
      inner: L(k.sideArc(0, 0, MAST_R + 0.8, 72.5, P, 16), { tone: 'faint' }),
    }),
  )
  out.push(
    D([at([MAST_R + 0.8, 0.5, 72.5]), at([0.5, MAST_R + 0.8, 72.5])], {
      size: 0.4,
    }),
  )
  out.push(
    S(k.cylinder(0, 0, MAST_R, 75, LOW[0] - 75, P, 24), {
      tone: 'mid',
      crease: 'none',
      inner: seams(100, 118),
    }),
  )

  // The obstruction lamp's feed: a junction box on the mast's lee side, its conduit dropping clear of the hinge lugs
  // into a gland on the base plate.
  const box = { x: MAST_R - 0.2, y: -3, w: 4, d: 6, r: 0.6 }
  const cx = MAST_R + 2.6
  out.push(S(k.cylinder(cx, 0, 1.5, PLATE_TOP, 1.2, P, 12), { tone: 'mid' }))
  out.push(
    S(k.cylinder(cx, 0, 0.9, PLATE_TOP + 1.2, 26 - PLATE_TOP - 1.2, P, 12), {
      tone: 'lo',
      crease: 'none',
    }),
  )
  out.push(
    S(k.slabOf(box, 26, 9, P, 2, 0.3), {
      tone: 'mid',
      inner: L(k.sideSeam(box, 33.2, P, 2), { tone: 'faint' }),
    }),
  )
  out.push(
    D([at([box.x + box.w, box.y + 1, 34]), at([box.x + box.w, box.y + box.d - 1, 27])], {
      size: 0.4,
    }),
  )

  // Swivel: two bearing collars hold the frame; the mast between them carries nothing else.
  const collar = ([z0, z1]) => {
    const o = [
      S(k.cylinder(0, 0, COLLAR_R, z0, z1 - z0, P, 28, 0.4), {
        tone: 'mid',
        inner: L(k.sideArc(0, 0, COLLAR_R, z0 + 1.6, P, 20), { tone: 'faint' }),
      }),
    ]
    o.push(
      S(k.cylinder(-1.2, COLLAR_R + 0.2, 0.7, z1 - 2.4, 0.01, P, 8), {
        tone: 'lo',
        crease: 'none',
      }),
    )
    o.push(D([at([COLLAR_R * 0.7, COLLAR_R * 0.7, z1])], { size: 0.4 }))
    return o.join('')
  }
  out.push(collar(LOW))
  out.push(
    S(k.cylinder(0, 0, MAST_R, LOW[1], HIGH[0] - LOW[1], P, 24), {
      tone: 'mid',
      crease: 'none',
    }),
  )
  out.push(collar(HIGH))
  // Mast cap and the obstruction lamp on top.
  out.push(S(k.cylinder(0, 0, MAST_R + 0.4, HIGH[1], 1.4, P, 24), { tone: 'mid' }))
  out.push(
    S(k.cylinder(0, 0, 2.4, HIGH[1] + 1.4, 3, P, 24, 0.3), {
      tone: 'hi',
      crease: 'lo',
    }),
  )
  out.push(
    L([0.8, 1.8].map((dz) => k.sideArc(0, 0, 2.4, HIGH[1] + 1.4 + dz, P, 16)).join(''), {
      tone: 'lo',
    }),
  )
  out.push(S(k.cylinder(0, 0, 1.4, HIGH[1] + 4.4, 0.8, P, 16), { tone: 'mid' }))
  return out.join('')
}

// ---------- The sock's slot: the client rewrites these paths; the generator fills them with one pose ----------
function sockSvg(knots) {
  const pose = poseOf({ knots, heading: 0, time: 0 }, P)
  const grads = []
  const bands = []
  for (let band = 0; band < SOCK.BANDS; band++) {
    grads.push(
      `<linearGradient id="ws-light-${band}" gradientUnits="userSpaceOnUse"><stop offset="0" class="ws-light-top"/><stop offset=".45" class="ws-light-mid"/><stop offset="1" class="ws-light-low"/></linearGradient>`,
    )
  }
  for (const b of pose.bands) {
    const [x1, y1, x2, y2] = b.light.map((n) => Math.round(n * 10) / 10)
    bands.push(
      `<g class="ws-band" data-band="${b.band}"><path class="ws-cloth" d="${b.d}"/><path class="ws-light" d="${b.d}" fill="url(#ws-light-${b.band})" data-x1="${x1}" data-y1="${y1}" data-x2="${x2}" data-y2="${y2}"/><path class="ws-seam" d="${b.seam}"/></g>`,
    )
  }
  const glow = pose.bands.map((b) => `<path data-band="${b.band}" d="${b.d}"/>`).join('')
  return {
    defs: `<defs>${grads.join('')}</defs>`,
    body:
      `<g class="ws-sock" data-sock>` +
      `<path class="ws-arm" data-arm="0" d="${pose.arms[0]}"/><path class="ws-arm" data-arm="1" d="${pose.arms[1]}"/>` +
      `<g class="ws-glow">${glow}</g>` +
      `<g class="ws-bands">${bands.join('')}</g>` +
      `<path class="ws-hoop" d="${pose.hoop}"/>` +
      `</g>`,
    pose,
  }
}

// Decorative: the status line under it carries the words, so the drawing is hidden from assistive tech.
const svgOf = (knots) => {
  const sock = sockSvg(knots)
  let svg = k
    .figureSvg({
      width: WIDTH,
      height: HEIGHT,
      label: '',
      body: [sock.defs, footing(), mast(), sock.body],
    })
    .replace(/ role="img" aria-label="[^"]*"/, ' aria-hidden="true" focusable="false"')
  // Gradient endpoints start on the first pose; the client moves them each frame.
  for (const b of sock.pose.bands) {
    const [x1, y1, x2, y2] = b.light.map((n) => Math.round(n * 10) / 10)
    svg = svg.replace(
      `<linearGradient id="ws-light-${b.band}" gradientUnits="userSpaceOnUse">`,
      `<linearGradient id="ws-light-${b.band}" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">`,
    )
  }
  return svg.replace(/ data-x1="[^"]*" data-y1="[^"]*" data-x2="[^"]*" data-y2="[^"]*"/g, '')
}
const svg = svgOf(0)

// ---------- CSS: the kit's rules scoped under .windsock, keeping only those the figure can match ----------
const SCOPE = '.windsock'
function rulesOf(css) {
  const rules = []
  let depth = 0
  let start = 0
  for (let i = 0; i < css.length; i++) {
    if (css[i] === '{') depth++
    else if (css[i] === '}' && --depth === 0) {
      rules.push(css.slice(start, i + 1).trim())
      start = i + 1
    }
  }
  return rules.filter(Boolean)
}
const UNUSED =
  /data-mat|iso-(plate|legend|key|swatch|wire|figure|flow|pulse|face-text|stage)|\.tb\b|tb-|data-(flow|pulse|dashed|seamless|dotted)|"(red|green|blue)"|@keyframes|data-lit/
function scope(css) {
  return rulesOf(css)
    .flatMap((rule) => {
      const open = rule.indexOf('{')
      const head = rule.slice(0, open).trim()
      const inner = rule.slice(open + 1, -1)
      if (UNUSED.test(head)) return []
      if (head.startsWith('@media')) {
        const kept = scope(inner)
        return kept ? [`${head}{${kept}}`] : []
      }
      // The kit's palettes: windsock.css maps every --anatomy-* role onto Kuuki's tokens.
      if (/^\.iso(\[data-theme="(dark|light)"\])?$/.test(head)) return []
      return [
        `${head
          .split(',')
          .map((part) => `${SCOPE} ${part.trim()}`)
          .join(',')}{${inner}}`,
      ]
    })
    .join('\n')
}
const css = `/* Generated by scripts/generate-windsock.mjs from the anatomy kit's iso.css (MIT). Do not edit by hand. */\n${SCOPE} .iso-svg{aspect-ratio:${WIDTH}/${HEIGHT}}\n${scope(readFileSync(join(KIT, 'iso.css'), 'utf8'))}\n`

mkdirSync(OUT, { recursive: true })
const header = `// Generated by scripts/generate-windsock.mjs (pnpm generate:windsock). Do not edit by hand.\n`
writeFileSync(
  join(OUT, 'windsock.generated.ts'),
  `${header}// The mast's static markup with the sock drawn limp, and the projection windsock.tsx redraws the sock with.
export const WINDSOCK: { svg: string; projection: { origin: [number, number]; scale: number; azimuth: number; elevation: number } } = ${JSON.stringify({ svg, projection: P })}
`,
)
writeFileSync(join(OUT, 'windsock.generated.css'), css)
console.log(
  `windsock: viewBox ${WIDTH}×${HEIGHT} · svg ${(svg.length / 1024).toFixed(1)} KB · css ${(css.length / 1024).toFixed(1)} KB`,
)

if (process.argv.includes('--preview')) {
  const dir = resolve('.scratch/windsock')
  mkdirSync(dir, { recursive: true })
  const style = readFileSync(join(OUT, 'windsock.css'), 'utf8')
  const poses = [0, 4.5, 9, FULL_KNOTS + 1.5]
  for (const theme of ['dark', 'light']) {
    const page = `<!doctype html><html data-theme="${theme}"><meta charset="utf-8"><title>Windsock</title>
<style>
:root{--font-sans:system-ui,sans-serif;--surface:#fbfaf8;--background:#fbfaf8;--text:#302d2a;--text-muted:#6f6a64;--accent:#d9480f;--iso-top:#fbfaf8;--iso-front:#f1eeea;--iso-side:#dcd7d1;--iso-line:#8a837b;--iso-crease:#b9b2aa;--iso-detail:#cfc9c1;--iso-shadow:rgba(48,45,42,.14);--iso-glow:.4;--surface-inset:#f3f1ed}
:root[data-theme=dark]{--surface:#292827;--background:#292827;--text:#f1efeb;--text-muted:#aaa49c;--accent:#ff6a33;--iso-top:#4b4844;--iso-front:#393735;--iso-side:#292725;--iso-line:#8d877f;--iso-crease:#5e5a55;--iso-detail:#4a4744;--iso-shadow:rgba(0,0,0,.4);--iso-glow:.75;--surface-inset:#222120}
body{margin:0;background:var(--background);color:var(--text);font-family:var(--font-sans);display:flex;flex-wrap:wrap;gap:24px;padding:24px}
.windsock{width:320px}
${css}
${style}
</style>
<body>${poses.map((kn) => `<div class="windsock">${svgOf(kn)}</div>`).join('')}</body></html>`
    writeFileSync(join(dir, theme === 'dark' ? 'preview.html' : 'preview-light.html'), page)
  }
  console.log('wrote .scratch/windsock/preview{,-light}.html')
}
