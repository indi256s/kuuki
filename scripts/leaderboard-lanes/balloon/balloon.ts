// Build-time hot-air balloon artwork. Shares the airliner's pinned anatomy kit, surface renderer, material ramps and
// serializer, and the car's ground camera, so it drifts across the same lane as the road vehicles.
import { closed, ringsOfPath, roundedUV, type Draw } from '../airliner/draw'
import {
  LaneScene,
  W as lane,
} from '../../../apps/next/src/client/leaderboard/lanes/draw/lane-scene'
import { loadKit } from '../airliner/kit'
import { laneCamera } from '../lane-camera'
import type { Ink, Item, Mat } from '../airliner/model'
import { serialize } from '../airliner/svg'
import { add, dot, mul, normalAt, sub, type Pt, type Surface, type V3 } from '../airliner/surface'
import {
  BASKET,
  CROWN_R,
  CROWN_Z,
  CX,
  FRAME_Z,
  GORES,
  TAPES,
  TAU,
  W,
  WIDTH,
  angleOf,
  band,
  basketInner,
  basketOuter,
  cornerT,
  envelope,
  gore,
  hemPoint,
  nearT,
  phase,
  rimAt,
  skirt,
  uAtHeight,
} from './model'

/** Turns a surface's normal outward from an axis point (or inward when asked), judged at one probe. */
function oriented(s: Surface, u: number, v: number, centre: V3 | 'axis', inward = false): Surface {
  const p = s.at(u, v)
  if (centre === 'axis') centre = [CX, 0, p[2]]
  const n = normalAt({ ...s, flip: false }, u, v)
  const out = dot(n, sub(p, centre)) >= 0
  return { ...s, flip: out === inward }
}

const sample = (n: number, f: (t: number) => V3) =>
  Array.from({ length: n + 1 }, (_, i) => f(i / n))

/** Items painted in the wicker ramp (the metal tones, warmed and lifted in the dark theme). */
const wicker = new WeakSet<Item>()

export function balloon(d: Draw): Item[] {
  const { cam, G, P, solid, kitSolid, seam } = d
  const V = cam.V
  const out: Item[] = []
  // A view-facing horizontal direction decides the gore layout and which half of a loop is the far one.
  const hv = Math.atan2(V[1], V[0])
  phase.value = hv - Math.PI / GORES
  const depth = (p: V3) => (p[0] - CX) * V[0] + p[1] * V[1]

  const line = (pts: V3[], ink: Ink = 'seam', width = 0.22, into: Item[] = out) =>
    into.push({ kind: 'lines', lines: { runs: [pts.map(cam.project)], ink, width } })
  const runs = (rs: Pt[][], ink: Ink, width: number, into: Item[] = out) =>
    rs.length && into.push({ kind: 'lines', lines: { runs: rs, ink, width } })
  const tube = (pts: V3[], core: number, into: Item[] = out) => {
    line(pts, 'line', core + 0.4, into)
    line(pts, 'faint', core, into)
  }
  const rod = (a: V3, b: V3, r: number, mat: Mat = 'metal', edge = 0.4): Item => {
    const F = G.frameAlong(a, sub(b, a))
    const len = Math.hypot(...sub(b, a))
    return kitSolid(G.disc(0, len, r, F, P, { steps: 16 }), mat, [], edge)
  }
  const ball = (c: V3, r: number, mat: Mat = 'metal'): Item =>
    kitSolid(G.sphereOf(c, r, P, { steps: 24 }), mat, [], 0.3)

  // ------------------------------------------------------------------ the layout of the rigging
  const pole = (sx: number, sy: number) => [sx * 1.12, sy * 0.68] as const
  const corners = [
    [1, 1],
    [-1, 1],
    [-1, -1],
    [1, -1],
  ].map(([sx, sy]) => W(...pole(sx, sy), FRAME_Z))
  const cornerAngle = (c: V3) => Math.atan2(c[1], c[0] - CX)
  const cableTo = (i: number): V3 => {
    const a = angleOf(i / GORES)
    let best = corners[0],
      gap = Infinity
    for (const c of corners) {
      const g = Math.abs(Math.atan2(Math.sin(a - cornerAngle(c)), Math.cos(a - cornerAngle(c))))
      if (g < gap) {
        gap = g
        best = c
      }
    }
    return best
  }
  const cable = (i: number, into: Item[]) => {
    const top = hemPoint(i),
      bottom = cableTo(i)
    const near = depth(top) > 0
    line([top, bottom], near ? 'line' : 'seam', near ? 0.3 : 0.24, into)
  }
  const far: Item[] = [],
    nearCables: Item[] = []
  for (let i = 0; i < GORES; i++) cable(i, depth(hemPoint(i)) > 0 ? nearCables : far)

  // ------------------------------------------------------------------ behind the envelope: far poles and frame
  const poleList = [
    [1, 1],
    [-1, 1],
    [-1, -1],
    [1, -1],
  ].map(([sx, sy]) => [W(...pole(sx, sy), 0.14), W(...pole(sx, sy), FRAME_Z)] as const)
  const farPoles = poleList.filter(([a]) => depth(a) <= 0)
  const nearPoles = poleList.filter(([a]) => depth(a) > 0)
  const farRig: Item[] = farPoles.map(([a, b]) => rod(a, b, 0.045))
  const frameEdges = corners.map((c, i) => [c, corners[(i + 1) % 4]] as const)
  for (const [a, b] of frameEdges) if (depth(add(a, b)) <= 0) far.push(rod(a, b, 0.04))
  out.push(...far)

  // ------------------------------------------------------------------ the envelope
  const env = oriented(envelope, 0.5, 0.3, 'axis')
  const base = solid(env, 'body', [], 0)
  out.push(base)
  for (let i = 0; i < GORES; i += 2) {
    out.push(solid({ ...gore(i, i + 1), flip: env.flip }, 'livery', [], 0))
  }
  const withFlip = (s: Surface): Surface => ({ ...s, flip: env.flip })
  // Vertical load tapes on every seam; horizontal tapes at three heights, over the gores.
  const tw = 0.003
  for (let i = 0; i < GORES; i++) {
    const s = withFlip(gore(i - tw * GORES, i + tw * GORES))
    out.push(
      solid(
        s,
        'body',
        [seam(s, 120, (t) => [t, 0], 'faint', 0.14), seam(s, 120, (t) => [t, 1], 'faint', 0.14)],
        0,
      ),
    )
  }
  const tapeWidth = 0.14 / 24
  for (const h of TAPES) {
    const u = uAtHeight(h)
    const s = withFlip(band(u - tapeWidth, u + tapeWidth))
    out.push(
      solid(
        s,
        'body',
        [seam(s, 220, (t) => [0, t], 'seam', 0.18), seam(s, 220, (t) => [1, t], 'seam', 0.18)],
        0,
      ),
    )
  }
  out.push({ kind: 'lines', lines: { runs: closed(base.outline), ink: 'line', width: 0.75 } })

  // Crown: a metal ring holding the parachute vent, a cloth disc with its closing line.
  {
    const F = G.frameAlong(W(0, 0, CROWN_Z - 0.02), [0, 0, 1])
    out.push(
      kitSolid(G.ringBand(-0.02, 0.1, 0.6, CROWN_R + 0.08, F, P, { steps: 48 }), 'metal', [], 0.4),
    )
    out.push(kitSolid(G.disc(0, 0.07, 0.6, F, P, { steps: 40 }), 'body', [], 0.3))
    out.push({
      kind: 'lines',
      lines: { runs: ringsOfPath(G.circleOf(F, 0.072, 0.3, P)), ink: 'faint', width: 0.14 },
    })
  }

  // Skirt: a dark Nomex band under the mouth, with a thimble where each load tape ends.
  {
    const s = oriented(skirt, 0.5, 0.3, 'axis')
    const sk = solid(s, 'metal', [seam(s, 160, (t) => [0.0, t], 'seam', 0.2)], 0.6)
    wicker.add(sk)
    out.push(sk)
    for (let i = 0; i < GORES; i++) {
      const p = hemPoint(i, 2.31)
      if (depth(p) > -0.8) out.push(ball(p, 0.085))
    }
  }

  // ------------------------------------------------------------------ the burner frame, burners and hoses
  const burners: Item[] = []
  for (const sx of [1, -1]) {
    const o = W(sx * 0.5, 0, FRAME_Z + 0.03)
    const a: V3 = [-sx * 0.16, 0, 1]
    const F = G.frameAlong(o, a)
    const ax = (s: number): V3 => add(o, mul(F.a, s))
    const radial = (ang: number): V3 => add(mul(F.u, Math.cos(ang)), mul(F.v, Math.sin(ang)))
    const back: Pt[][] = [],
      front: Pt[][] = []
    let run: Pt[] = [],
      side = 0
    const turns = 4.5,
      n = 120
    for (let k = 0; k <= n; k++) {
      const t = k / n,
        ang = turns * TAU * t
      const r = radial(ang)
      const p = add(ax(0.22 + 0.5 * t), mul(r, 0.1))
      const s = dot(r, V) > 0 ? 1 : -1
      if (s !== side && run.length) {
        ;(side > 0 ? front : back).push(run)
        run = []
      }
      side = s
      run.push(cam.project(p))
    }
    if (run.length) (side > 0 ? front : back).push(run)
    burners.push(kitSolid(G.disc(0, 0.22, 0.09, F, P, { steps: 20 }), 'metal', [], 0.4))
    runs(back, 'line', 0.85, burners)
    runs(back, 'faint', 0.42, burners)
    burners.push(kitSolid(G.disc(0.1, 0.8, 0.04, F, P, { steps: 16 }), 'metal', [], 0.4))
    runs(front, 'line', 0.85, burners)
    runs(front, 'faint', 0.42, burners)
    // Blast valve: a short lever across the stem with a knob on its end.
    const vb = ax(0.15)
    burners.push(rod(add(vb, [0, -0.1, 0]), add(vb, [0, 0.12, 0]), 0.022))
    burners.push(ball(add(vb, [0, 0.14, 0]), 0.04))
    // The head: a cup with the dark jet bore on top.
    burners.push(kitSolid(G.disc(0.74, 0.92, 0.17, F, P, { steps: 28 }), 'metal', [], 0.4))
    burners.push(kitSolid(G.disc(0.915, 0.93, 0.125, F, P, { steps: 24 }), 'void', [], 0.2))
  }
  const hoses: Item[] = []
  for (const sx of [1, -1]) {
    const a = W(sx * 0.68, -0.1, 2.05),
      b = W(sx * 0.5, 0, FRAME_Z + 0.1)
    const c = W(sx * 1.0, 0.4, 2.8)
    tube(
      sample(24, (t) => add(add(mul(a, (1 - t) ** 2), mul(c, 2 * t * (1 - t))), mul(b, t * t))),
      0.3,
      hoses,
    )
  }

  // ------------------------------------------------------------------ the basket
  const basket: Item[] = []
  const inner = oriented(basketInner, 0.5, 0.3, 'axis', true)
  basket.push(solid(inner, 'rubber', [], 0.5))
  const tanks: Item[] = []
  for (const sx of [1, -1]) {
    const F = G.frameAlong(W(sx * 0.68, -0.1, 0.12), [0, 0, 1])
    tanks.push(
      kitSolid(
        G.solidOf(
          [
            [0, 0.17, 1],
            [0.04, 0.2, 1],
            [1.6, 0.2],
            [1.75, 0.18, 1],
            [1.89, 0.1, 1],
            [1.95, 0.07],
          ],
          F,
          P,
          { steps: 36 },
        ),
        'body',
        [],
        0.5,
      ),
    )
    tanks.push(kitSolid(G.ringBand(1.89, 2.07, 0.12, 0.14, F, P, { steps: 24 }), 'rubber', [], 0.3))
    tanks.push(kitSolid(G.disc(1.93, 2.01, 0.045, F, P, { steps: 16 }), 'metal', [], 0.3))
  }
  // Rim: the far half goes behind the tanks, the near half in front of them.
  const rimSeg = (t0: number, t1: number): Surface => ({
    at: rimAt(t0, t1),
    u: Math.max(12, Math.ceil((t1 - t0) * 260)),
    v: 20,
    closed: true,
  })
  // Split the loop where its depth crosses zero: start at the far-to-near crossing.
  const dz = (t: number) => depth(rimAt(0, 1)(t, 0))
  let t0 = 0
  for (let i = 0; i < 400; i++) {
    const t = i / 400
    if (dz(t) <= 0 && dz(t + 1 / 400) > 0) {
      t0 = t
      break
    }
  }
  let tm = t0 + 0.5
  for (let i = 0; i < 400; i++) {
    const t = t0 + i / 400
    if (dz(t) > 0 && dz(t + 1 / 400) <= 0) {
      tm = t + 1 / 400
      break
    }
  }
  const rimFlipOf = (a: number, b: number): Surface => {
    const s = rimSeg(a, b)
    const mid = rimAt(a, b)(0.5, 0)
    const cen = rimAt(a, b)(0.5, 0.5)
    // v = 0 is the tube's outermost point: its outward normal points from the tube centre to it.
    const n = normalAt({ ...s, flip: false }, 0.5, 0)
    return { ...s, flip: dot(n, sub(mid, cen)) < 0 }
  }
  const farRim = rimFlipOf(tm, t0 + 1)
  const nearRim = rimFlipOf(t0, tm)
  const farRimItem = solid(farRim, 'livery', [], 0.5)

  const outer = oriented(basketOuter(), 0.5, 0.3, 'axis')
  const wall = solid(outer, 'metal', [], 0.6)
  wicker.add(wall)
  const front: Item[] = [wall]
  const sub1 = (u0: number, u1: number, v0 = 0, v1 = 1) => ({
    ...basketOuter(u0, u1, v0, v1),
    flip: outer.flip,
  })
  // Suede: runner at the foot, a trim under the rim, and straps up the corners.
  front.push(solid(sub1(0, 0.09), 'rubber', [], 0.3))
  front.push(solid(sub1(0.82, 1), 'rubber', [], 0.3))
  for (let k = 0; k < 4; k++) {
    const t = cornerT(BASKET.a, BASKET.b, BASKET.r, k)
    front.push(solid(sub1(0.08, 0.84, t - 0.012, t + 0.012), 'rubber', [], 0.2))
  }
  // Rope handles: two cut-outs in the wall under the rim, edged in rope.
  for (const x of [0.75, -0.75]) {
    const v = nearT(BASKET.a + BASKET.flare * 0.8, BASKET.b + BASKET.flare * 0.8, BASKET.r, x)
    const rings = d.patch(outer, roundedUV(0.7, v, 0.05, 0.022, 0.9, 5), 0.02)
    if (rings.length) front.push({ kind: 'fill', rings, mat: 'void', edge: 'line', width: 0.4 })
  }
  // Weave: a basket-weave check, each cell one short rod lying up or across, alternating.
  const rows = 8,
    cols = 44
  const rowU = (r: number) => 0.08 + (0.78 * r) / rows
  const weave: Pt[][] = []
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const u0 = rowU(r),
        u1 = rowU(r + 1),
        um = (u0 + u1) / 2
      const v0 = c / cols,
        vm = (c + 0.5) / cols
      weave.push(
        ...((r + c) % 2
          ? seam(outer, 3, (t) => [um, v0 + (0.2 + 0.6 * t) / cols], 'seam', 0.16).runs
          : seam(outer, 3, (t) => [u0 + (0.2 + 0.6 * t) * (u1 - u0), vm], 'seam', 0.16).runs),
      )
    }
  runs(weave, 'seam', 0.16, front)
  front.push(solid(nearRim, 'livery', [], 0.5))
  // Drop line: a coil of rope hanging on the near wall.
  {
    const a = BASKET.a + BASKET.flare * 0.6,
      b = BASKET.b + BASKET.flare * 0.6
    const p = outer.at(0.55, nearT(a, b, BASKET.r, -0.2))
    const F = G.frameAlong(add(p, [0, 0.03, 0]), [0, 1, 0])
    front.push(kitSolid(G.ringBand(0, 0.07, 0.07, 0.22, F, P, { steps: 32 }), 'body', [], 0.35))
    for (const r of [0.11, 0.15, 0.19])
      front.push({
        kind: 'lines',
        lines: { runs: ringsOfPath(G.circleOf(F, 0.075, r, P)), ink: 'seam', width: 0.14 },
      })
    line(
      [add(p, [0.15, 0.04, 0.12]), add(p, [0.02, 0.05, 0.3]), add(p, [0, 0.03, 0.68])],
      'line',
      0.28,
      front,
    )
  }
  // Near poles stand inside the rim, so the wall and rim cover their feet; the frame's near edge is above them all.
  const nearRig: Item[] = nearPoles.map(([a, b]) => rod(a, b, 0.045))
  for (const [a, b] of frameEdges) if (depth(add(a, b)) > 0) nearRig.push(rod(a, b, 0.04))
  // Karabiners where the flying wires meet the frame.
  for (const c of corners) nearRig.push(ball(c, 0.075))

  out.push(...burners)
  out.push(basket[0], farRimItem, ...farRig, ...tanks, ...hoses, ...nearRig, ...front)
  out.push(...nearCables)
  return out
}

export async function buildBalloon(unit = 112) {
  const kit = await loadKit()
  // The ground camera, as the car derives it; the scale makes the envelope's width the lane unit on screen.
  const probe = new LaneScene(1)
  const h1 = Math.hypot(probe.project(lane([1, 0, 0]))[0], probe.project(lane([0, 1, 0]))[0])
  const { cam, draw, place } = laneCamera(kit, unit / WIDTH / h1)
  const items = balloon(draw)
  // The envelope's cloth and the basket's wicker have their own ramps (BALLOON_CSS), so both stay bright in the dark
  // theme; the serializer writes the aircraft ramps, which are renamed per item.
  const parts = items.map((it) => {
    const s = serialize([it], place, 1)
    return {
      ...s,
      body: s.body
        .replace(/--ab(\w)/g, '--ac$1')
        .replace(wicker.has(it) ? /--am(\w)/g : /^$/g, '--aw$1'),
    }
  })
  const drawn = parts.filter((p) => p.body)
  const built = {
    body: parts.map((p) => p.body).join(''),
    box: {
      x0: Math.min(...drawn.map((p) => p.box.x0)),
      y0: Math.min(...drawn.map((p) => p.box.y0)),
      x1: Math.max(...drawn.map((p) => p.box.x1)),
      y1: Math.max(...drawn.map((p) => p.box.y1)),
    },
  }
  return {
    ...built,
    d: { key: 'other', title: 'A hot-air balloon' },
    gear: place(cam.project([0, BASKET.b + BASKET.flare, 0]))[1],
  }
}

/** The cloth ramp: the aircraft body ramp in light, and a bright cream in dark so the envelope reads against the dark page. */
export const BALLOON_CSS = `.lane-vehicle{--ac4:var(--ab4);--ac3:var(--ab3);--ac2:var(--ab2);--ac1:var(--ab1);--ac0:var(--ab0);--acp:var(--ab2);
  --aw4:var(--am4);--aw3:var(--am3);--aw2:var(--am2);--aw1:var(--am1);--aw0:var(--am0);--awp:var(--amp)}
:root[data-theme='dark'] .lane-vehicle{
  --ac4:color-mix(in oklab,var(--text) 92%,var(--iso-front));--ac3:color-mix(in oklab,var(--text) 84%,var(--iso-front));
  --ac2:color-mix(in oklab,var(--text) 74%,var(--iso-front));--ac1:color-mix(in oklab,var(--text) 62%,var(--iso-front));
  --ac0:color-mix(in oklab,var(--text) 50%,var(--iso-front));--acp:var(--ac2);
  --aw4:color-mix(in oklab,var(--text) 64%,var(--iso-front));--aw3:color-mix(in oklab,var(--text) 56%,var(--iso-front));
  --aw2:color-mix(in oklab,var(--text) 48%,var(--iso-front));--aw1:color-mix(in oklab,var(--text) 40%,var(--iso-front));
  --aw0:color-mix(in oklab,var(--text) 32%,var(--iso-front));--awp:var(--aw2);
}`
