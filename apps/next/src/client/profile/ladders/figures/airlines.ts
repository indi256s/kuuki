import { hull, Scene, roundRect, type P3, type Paint, type Pt } from '../../../overview/iso/scene'
import { shadowDisc } from '../../../overview/iso/solids'
import { add, beam, LIGHT, mul, screw, spline, stamp, sub, unit, D2R } from './parts'
import type { LadderFigureDef } from './types'

/**
 * Airlines: the boarding queue barrier at the gate. Free agent, no status, alliance-agnostic: you wait in the general queue.
 * Each post is turned: a rubber foot ring, a weighted domed base with its trim seam, the socket collar, the pole, the belt cassette head
 * with its receiver slots, and a domed top cap. Each belt is a flat webbing strip that sags a little between posts; it runs out of the
 * nearer post's cassette and its clip hooks into the farther post's receiver slot.
 * Everything stands on a terminal floor slab with tile seams.
 * Rung 1 is two posts and one belt. Rung 2 is two parallel lanes and one U-turn. Rung 3 is a four-lane maze, and in front of it a short,
 * wide priority lane on a full-length carpet runner, two posts a side, its mouth belted shut and nobody in it.
 * Lit: the newest belt run, a front-row belt facing the viewer with nothing in front of it. The priority lane stays grey.
 * Frame: z up, rows of posts along x; the viewer sees the +x and +y faces.
 */

/** Post heights (z) and radii: the foot ring, the domed base, the socket collar, the pole, the head, the cap. */
const H = {
  foot: 0.45,
  dome: 2.9,
  collar: 3.7,
  head0: 23.6,
  head1: 29.2,
  cap: 30.7,
  rFoot: 6.05,
  rPole: 1.15,
  rHead: 2.0,
}
/** Belt webbing, a ribbon on edge about twice the pole's width high: bottom and top edge at the head, and how far a 28-unit span sags at its middle. */
const BELT = { z0: 24.5, z1: 28.5, sag: 0.55 }
/** Grid pitch of the maze: along a row, and between rows (the lane width). */
const SX = 28,
  SY = 17

/** The domed base from the top of the foot ring to the collar: a rounded rim, then a low dome. */
const BASE = spline([
  [H.foot, 6.2],
  [0.75, 6.45],
  [1.1, 6.42],
  [1.4, 6.05],
  [1.85, 5.0],
  [2.35, 3.45],
  [2.7, 2.1],
  [H.dome, 1.6],
])
/** Socket collar: a short sleeve with a rounded top shoulder. */
const COLLAR = spline([
  [H.dome - 0.15, 1.55],
  [3.3, 1.55],
  [3.55, 1.48],
  [H.collar, 1.35],
])
/** The cassette head: a chamfered foot, a straight barrel, and a slight waist under the cap. */
const HEAD = spline([
  [H.head0, 1.15],
  [23.9, 1.7],
  [24.3, 2.0],
  [28.7, 2.0],
  [H.head1, 1.92],
])
/** Top cap: a low dome over the head. */
const CAP = spline([
  [H.head1, 1.94],
  [29.6, 1.9],
  [30.1, 1.58],
  [30.45, 1.0],
  [H.cap, 0.15],
])

type Post = { x: number; y: number }
type Belt = { a: number; b: number; lit?: boolean }
type Layout = {
  posts: Post[]
  belts: Belt[]
  lane?: { x0: number; x1: number; y0: number; y1: number }
}

/**
 * A serpentine maze of `cols` × `rows` posts, `sx` apart along a row. The outer rows run full length; each inner row leaves one end open
 * in turn (odd rows the right, even rows the left), so the queue snakes between them, and one long belt closes the outside of each U-turn.
 * The front row's belt `litCol` is the newest run: it faces the viewer with nothing in front of it.
 */
function maze(cols: number, rows: number, sx: number, litCol: number): Layout {
  const posts: Post[] = []
  const ids = new Map<string, number>()
  const id = (c: number, r: number) => {
    const key = `${c},${r}`
    if (!ids.has(key)) ids.set(key, posts.push({ x: c * sx, y: r * SY }) - 1)
    return ids.get(key)!
  }
  const belts: Belt[] = []
  for (let r = 0; r < rows; r++) {
    const inner = r > 0 && r < rows - 1
    const c0 = inner && r % 2 === 0 ? 1 : 0,
      c1 = inner && r % 2 === 1 ? cols - 2 : cols - 1
    for (let c = c0; c < c1; c++)
      belts.push({ a: id(c, r), b: id(c + 1, r), lit: r === rows - 1 && c === litCol })
  }
  for (let r = 1; r < rows - 1; r++) {
    const c = r % 2 === 1 ? cols - 1 : 0
    belts.push({ a: id(c, r - 1), b: id(c, r + 1) })
  }
  return { posts, belts }
}

function layout(rung: number): Layout {
  if (rung === 1)
    return {
      posts: [
        { x: 0, y: 0 },
        { x: SX, y: 0 },
      ],
      belts: [{ a: 0, b: 1, lit: true }],
    }
  // Two parallel lanes and one U-turn.
  if (rung === 2) return maze(3, 3, SX, 1)
  // Four lanes. In front of the maze, parallel to its lanes and clear of the lit belt (the front row's first, at the left), the priority lane: a short, wide corridor, two posts a side, its mouth belted shut.
  const L = maze(4, 5, 22, 0)
  const n = L.posts.length,
    px = 30,
    pl = SX + 6,
    py0 = 4 * SY + 13,
    py1 = py0 + 23
  L.posts.push({ x: px, y: py0 }, { x: px + pl, y: py0 }, { x: px, y: py1 }, { x: px + pl, y: py1 })
  L.belts.push({ a: n, b: n + 1 }, { a: n + 2, b: n + 3 }, { a: n, b: n + 2 })
  L.lane = { x0: px - 1, x1: px + pl + 3, y0: py0 + 4.6, y1: py1 - 4.6 }
  return L
}

export const airlines: LadderFigureDef = {
  id: 'airlines',
  rungs: 3,
  build(k, { rung, lod }) {
    const s = new Scene(k)
    const hero = lod === 'hero'
    const { posts, belts, lane } = layout(rung)

    // ---------------------------------------------------------------- floor: the terminal floor slab, the priority carpet, contact shadows

    {
      const m = 9
      const xs = posts.map((p) => p.x),
        ys = posts.map((p) => p.y)
      const x0 = Math.min(...xs) - m,
        y0 = Math.min(...ys) - m,
        w = Math.max(...xs) + m - x0,
        d = Math.max(...ys) + m - y0
      // A plinth with a stepped bevel round its top.
      s.box(x0, y0, -3.2, w, d, 2.6)
      s.box(x0 + 0.6, y0 + 0.6, -0.6, w - 1.2, d - 1.2, 0.6)
      if (hero) {
        // Terrazzo tiles: an inset border band, then tile seams running border to border.
        const b = 2.4,
          T = 15
        const on = (x: number, y: number): P3 => [x, y, 0]
        s.poly(
          [
            on(x0 + b, y0 + b),
            on(x0 + w - b, y0 + b),
            on(x0 + w - b, y0 + d - b),
            on(x0 + b, y0 + d - b),
          ],
          'none',
          'crease',
          undefined,
          0.5,
        )
        const seams: P3[][] = []
        for (let x = x0 + b + T; x < x0 + w - b - 4; x += T)
          seams.push([on(x, y0 + b), on(x, y0 + d - b)])
        for (let y = y0 + b + T; y < y0 + d - b - 4; y += T)
          seams.push([on(x0 + b, y), on(x0 + w - b, y)])
        s.segs(seams, 'detail', 0.5)
      }
    }

    if (lane) {
      const { x0, x1, y0, y1 } = lane
      const plan = roundRect(x0, y0, x1 - x0, y1 - y0, 0.8)
      const at = (z: number) => plan.map(([x, y]): P3 => [x, y, z])
      s.poly(at(0.35), 'side', hero ? 'line' : 'crease', undefined, hero ? 0.7 : 1)
      if (hero) {
        // A woven border inset from the edge, and fringe along both short ends.
        s.poly(
          roundRect(x0 + 1.6, y0 + 1.6, x1 - x0 - 3.2, y1 - y0 - 3.2, 0.4).map(([x, y]): P3 => [
            x,
            y,
            0.35,
          ]),
          'none',
          'crease',
          undefined,
          0.5,
        )
        s.poly(
          roundRect(x0 + 2.4, y0 + 2.4, x1 - x0 - 4.8, y1 - y0 - 4.8, 0.3).map(([x, y]): P3 => [
            x,
            y,
            0.35,
          ]),
          'none',
          'detail',
          undefined,
          0.4,
        )
        const fringe: P3[][] = []
        for (let y = y0 + 1; y <= y1 - 1 + 1e-6; y += (y1 - y0 - 2) / 12)
          fringe.push(
            [
              [x0, y, 0.2],
              [x0 - 1.4, y, 0],
            ],
            [
              [x1, y, 0.2],
              [x1 + 1.4, y, 0],
            ],
          )
        s.segs(fringe, 'crease', 0.45)
      }
    }
    if (hero) {
      const shadow = stamp(s, (r) => shadowDisc(r, 1.2, 1.2, 7.6, 7))
      for (const p of posts) shadow(p.x, p.y)
    }

    // ---------------------------------------------------------------- painter's order: posts and belts, far to near

    type Item = { key: number; draw: () => void }
    // Every post is the same turned part, drawn once and stamped at each position.
    const placePost = stamp(s, (r) => post(r, hero))
    const items: Item[] = posts.map((p) => ({ key: p.x + p.y, draw: () => placePost(p.x, p.y) }))
    for (const b of belts) {
      const pa = posts[b.a],
        pb = posts[b.b]
      const [far, near] = pa.x + pa.y <= pb.x + pb.y ? [pa, pb] : [pb, pa]
      items.push({
        key: (pa.x + pa.y + pb.x + pb.y) / 2,
        draw: () => belt(s, far, near, !!b.lit, hero),
      })
    }
    items.sort((a, b) => a.key - b.key)
    for (const it of items) it.draw()

    return s.done()
  },
}

// ---------------------------------------------------------------- one post

// Every part of a post is an upright convex turned part, so each is drawn as one hull for its silhouette, nested bands round the light's
// azimuth on its walls, and nested crown layers on its domes. It costs a fraction of a general lathe, which matters with twenty-odd posts.
/** On an upright wall the light falls as LA·cos(θ − LPHI): the side tone at θ = 0 (+x), the front tone at 90° (+y). */
const LA = Math.hypot(LIGHT[0], LIGHT[1]),
  LPHI = Math.atan2(LIGHT[1], LIGHT[0]) / D2R
/** The visible half of an upright wall: from −45° to 135°. */
const V0 = -45,
  V1 = 135

const pt = (r: number, deg: number, z: number): P3 => [
  r * Math.cos(deg * D2R),
  r * Math.sin(deg * D2R),
  z,
]
/** Points on the ring (r, z) from a0 to a1 degrees, about every `step`. */
function arc(r: number, z: number, a0: number, a1: number, step = 12): P3[] {
  const n = Math.max(1, Math.ceil(Math.abs(a1 - a0) / step))
  return Array.from({ length: n + 1 }, (_, i) => pt(r, a0 + ((a1 - a0) * i) / n, z))
}
/** The hull of the rings through stations [r, z], as 3D points on them (hull keeps the projected points it picks). */
function hullOf(s: Scene, st: readonly (readonly [number, number])[]): P3[] {
  const of = new Map<Pt, P3>()
  for (const [r, z] of st)
    for (let j = 0; j < 28; j++) {
      const p = pt(r, (j * 360) / 28, z)
      of.set(s.project(p), p)
    }
  return hull([...of.keys()]).map((q) => of.get(q)!)
}
/** A part's silhouette: its hull, filled in the dark tone and outlined. */
function outline(
  s: Scene,
  st: readonly (readonly [number, number])[],
  width: number,
  fill: Paint = 'side',
) {
  s.poly(hullOf(s, st), fill, 'line', undefined, width)
}
/** Smooth shading on a near-vertical wall from (r0, z0) to (r1, z1): `n` nested bands of the mid tone, each adding a step, round the light. */
function wall(s: Scene, r0: number, z0: number, r1: number, z1: number, n: number, sheen = false) {
  const band = (thr: number, paint: Paint, op: number) => {
    const w = Math.acos(Math.min(1, thr / LA)) / D2R
    const a = Math.max(V0, LPHI - w),
      b = Math.min(V1, LPHI + w)
    s.poly(
      [...arc(r0, z0, a, b), ...arc(r1, z1, b, a)],
      paint,
      'none',
      undefined,
      undefined,
      Math.round(1000 * op) / 1000,
    )
  }
  for (let i = 1; i <= n; i++)
    band(LIGHT[0] + ((LIGHT[1] - LIGHT[0]) * (i - 0.5)) / n, 'front', 1 / (n - i + 1))
  // Chrome: a narrow highlight where the wall faces the light squarely.
  if (sheen) band(LA * 0.985, 'top', 0.7)
}
/** Smooth shading on an up-facing dome through stations [r, z] (rising): the front tone over all of it, then nested top-tone layers towards its crown. */
function crown(s: Scene, st: readonly (readonly [number, number])[], n: number) {
  s.poly(hullOf(s, st), 'front', 'none')
  for (let i = 0; i < n; i++) {
    const lo = st.slice(Math.min(st.length - 2, Math.floor((i * (st.length - 1)) / (n + 1))))
    s.poly(hullOf(s, lo), 'top', 'none', undefined, undefined, Math.round(1000 / (n - i)) / 1000)
  }
}
/** A ring seam across the visible half of a wall. */
const seam = (s: Scene, r: number, z: number, paint: Paint = 'crease', w = 0.5) =>
  s.line(arc(r, z, V0, V1, 9), paint, w)

/** Stations [r, z] of a profile at the given heights. */
const stations = (prof: (z: number) => number[], zs: readonly number[]) =>
  zs.map((z) => [prof(z)[0], z] as const)

/** One post standing at the origin. */
function post(s: Scene, hero: boolean) {
  const baseSt = stations(BASE, [H.foot, 0.75, 1.1, 1.4, 1.85, 2.35, 2.7, H.dome])
  const headSt = stations(HEAD, [H.head0, 23.9, 24.3, 28.7, H.head1])
  const capSt = stations(CAP, [H.head1, 29.6, 30.1, 30.45, H.cap])
  if (!hero) {
    outline(s, baseSt, 1)
    outline(
      s,
      [
        [H.rPole, H.dome],
        [H.rPole, H.head0 + 0.3],
      ],
      1,
    )
    outline(s, [...headSt, ...capSt], 1)
    return
  }
  // A fit probe (Scene measuring for fitBox) only needs bounds, and every tone layer sits inside a silhouette: draw those alone.
  if (s.str([[0, 0]]) === '') {
    for (const st of [[[H.rFoot, 0] as const, ...baseSt], headSt, capSt]) outline(s, st, 1)
    return
  }
  const n = s.k < 1.4 ? 3 : 5
  // Rubber foot ring under the rim.
  outline(
    s,
    [
      [H.rFoot, 0],
      [H.rFoot, H.foot],
    ],
    0.8,
  )
  wall(s, H.rFoot, 0, H.rFoot, H.foot, 2)
  s.poly(
    hullOf(s, [
      [H.rFoot, 0],
      [H.rFoot, H.foot],
    ]),
    'shade',
    'none',
  )
  // The weighted base: a rounded rim, a trim seam, a low dome.
  outline(s, baseSt, 1)
  wall(s, BASE(H.foot)[0], H.foot, BASE(1.15)[0], 1.15, n)
  crown(s, stations(BASE, [1.15, 1.5, 1.85, 2.2, 2.5, 2.75, H.dome]), n)
  seam(s, BASE(1.15)[0], 1.15)
  // The socket collar and two grub screws.
  outline(s, stations(COLLAR, [H.dome - 0.15, 3.3, 3.55, H.collar]), 0.8)
  wall(s, 1.55, H.dome, 1.55, 3.3, Math.min(n, 3))
  crown(s, stations(COLLAR, [3.3, 3.45, 3.6, H.collar]), 2)
  for (const deg of [20, 70]) {
    const nn = pt(1, deg, 0)
    screw(s, pt(1.57, deg, 3.05), nn, 0.22)
  }
  // The pole, chrome.
  outline(
    s,
    [
      [H.rPole, H.collar - 0.15],
      [H.rPole, H.head0 + 0.4],
    ],
    1,
  )
  wall(s, H.rPole, H.collar - 0.15, H.rPole, H.head0 + 0.4, n, true)
  // The cassette head: a chamfered foot, a banded barrel with receiver slots towards +x and +y.
  outline(s, headSt, 1)
  wall(s, H.rHead, 24.3, H.rHead, 28.7, n)
  seam(s, H.rHead, 24.3)
  seam(s, H.rHead, 28.7)
  for (const deg of [0, 90]) {
    const r = H.rHead + 0.02
    s.poly(
      [...arc(r, 24.4, deg - 17, deg + 17, 6), ...arc(r, 28.6, deg + 17, deg - 17, 6)],
      'front',
      'crease',
      undefined,
      0.45,
    )
    s.poly(
      [...arc(r, 24.6, deg - 7, deg + 7, 7), ...arc(r, 28.4, deg + 7, deg - 7, 7)],
      'shade',
      'line',
      undefined,
      0.45,
    )
  }
  // The domed top cap.
  outline(s, capSt, 1)
  crown(s, stations(CAP, [29.45, 29.8, 30.1, 30.35, 30.55, H.cap]), n)
  seam(s, CAP(H.head1)[0], H.head1)
}

// ---------------------------------------------------------------- one belt

/** The belt from `far`'s receiver (its clip) to `near`'s cassette slot, which sits on the head's hidden side, so the belt runs in under it. */
function belt(s: Scene, far: Post, near: Post, lit: boolean, hero: boolean) {
  const A: P3 = [far.x, far.y, 0],
    B: P3 = [near.x, near.y, 0]
  const dir = unit(sub(B, A))
  // The face that looks at the viewer: +y for a belt along x, +x for one along y.
  const n: P3 = dir[0] > dir[1] ? [0, 1, 0] : [1, 0, 0]
  const start = add(A, mul(dir, H.rHead + 0.9))
  const L = Math.hypot(near.x - far.x, near.y - far.y) - H.rHead - 0.9
  const sag = (BELT.sag * L) / SX
  const N = hero ? 14 : 6
  const edge = (z: number, inset = 0) =>
    Array.from({ length: N + 1 }, (_, i): P3 => {
      const t = i / N
      return add(add(start, mul(dir, t * L)), [0, 0, z - sag * Math.sin(Math.PI * t) + inset])
    })
  const top = edge(BELT.z1),
    bottom = edge(BELT.z0)
  const face = [...top, ...[...bottom].reverse()]
  // Dark webbing against the light chrome posts: the face tone darkened by a shade layer, hems stitched in a light thread. A thumb is
  // line-only, so there the strap is filled with the line colour instead.
  const draw = () => {
    if (hero) {
      // Three shade layers: dark on paper as well as in the dark theme.
      s.poly(face, 'side', 'none')
      for (let i = 0; i < 3; i++) s.poly(face, 'shade', 'none')
      if (lit) s.poly(face, 'accent', 'none', undefined, undefined, 0.28)
      s.poly(face, 'none', lit ? 'accent' : 'line', undefined, lit ? 1 : 0.7)
      const hem: Paint = lit ? 'accent' : 'top'
      s.line(edge(BELT.z1, -0.55), hem, 0.45)
      s.line(edge(BELT.z0, 0.55), hem, 0.45)
    } else if (lit) {
      s.poly(face, 'accent', 'none', undefined, undefined, 0.3)
      s.poly(face, 'none', 'accent', undefined, 1.3)
    } else s.poly(face, 'line', 'line', undefined, 0.8)
  }
  if (lit) s.group('lit', draw)
  else draw()
  if (!hero) return
  // The clip: a metal tongue hooked into the receiver slot, the webbing folded through it and riveted.
  const zc = (BELT.z0 + BELT.z1) / 2
  const c0 = add(A, mul(dir, H.rHead - 0.2)),
    c1 = add(A, mul(dir, H.rHead + 1.7))
  beam(s, [c0[0], c0[1], zc], [c1[0], c1[1], zc], 0.6, BELT.z1 - BELT.z0 + 0.7, { width: 0.7 })
  const cf = add(add(A, mul(dir, H.rHead + 1.05)), [n[0] * 0.31, n[1] * 0.31, zc])
  screw(s, cf, n, 0.32, { ring: 0.6 })
}
