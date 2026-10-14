// Roman amphitheatre seen from outside (Colosseum): an elliptical wall of arcade storeys topped by
// an attic, drawn bay by bay so the arches foreshorten toward the ends. The wall can be broken on
// one side: `profile` gives the number of standing storeys per bay, and where the wall is lower
// the taller inner ring shows behind it in shade.
import { type Pt, type SvgNode, body, fill, occlude, rectPts, stroke, toneFill } from '../grid'
import { type KitModule, nums, num } from './util'

/** Cumulative storey heights (fraction of the wall): three arcades and the attic. */
const CUM = [0, 0.25, 0.5, 0.75, 1]

/**
 * `arcade`: one arched storey over a straight run, used by the amphitheatre bay by bay. Returns the
 * dark openings (solid) for a bay whose floor is at `yb`, ceiling at `yt`, centred on `xm`.
 */
export function arcade(xm: number, yb: number, yt: number, width: number, rise: number): SvgNode[] {
  const h = yb - yt
  const r = width / 2
  const spring = yt + Math.min(h, r + rise)
  const pts: Pt[] = [
    [xm - r, yb],
    [xm - r, spring],
    ...Array.from({ length: 7 }, (_, k): Pt => {
      const a = (Math.PI * (k + 1)) / 8
      return [xm - r * Math.cos(a), spring - r * Math.sin(a)]
    }),
    [xm + r, spring],
    [xm + r, yb],
  ]
  return [fill(pts)]
}

/**
 * The box is the whole ellipse: its width is the wall length, its height runs from the highest
 * point of the top rim to the lowest point of the base curve. `bays` equal angular bays, `profile`
 * standing storeys (0-4) for each bay from left to right, `ryBase` and `ryTop` the vertical bulge of
 * the base and top curves, `open` the arch width as a share of the bay.
 */
export const amphitheatre: KitModule = ([x, y, w, h], p) => {
  const bays = Math.max(6, Math.round(num(p, 'bays', 15)))
  const ryb = num(p, 'ryBase', 4)
  const ryt = num(p, 'ryTop', 6)
  const open = num(p, 'open', 0.44)
  const profileIn = nums(p, 'profile', [])
  const profile = Array.from({ length: bays }, (_, i) => profileIn[i] ?? 4)
  const innerLevel = num(p, 'inner', 3.05)
  const rx = w / 2
  const cx = x + rx
  const baseY = y + h - ryb
  const topY = y + ryt
  const phi = (j: number) => -Math.PI / 2 + (Math.PI * j) / bays
  const px = (j: number) => cx + rx * Math.sin(phi(j))
  const levelOf = (s: number) => {
    const i = Math.min(3, Math.floor(s))
    return CUM[i] + (CUM[i + 1] - CUM[i]) * (s - i)
  }
  /** y at storey level `s` on the curve at angle index `j` (may be fractional). */
  const yAt = (s: number, j: number) => {
    const c = Math.cos(phi(j))
    const yb = baseY + ryb * c
    const yt = topY - ryt * c
    return yb + (yt - yb) * (s >= 4 ? 1 : levelOf(s))
  }
  const out: SvgNode[] = []

  // Inner ring behind the broken bays, in shade.
  const low = profile.map((s) => s < innerLevel - 0.3)
  const innerPts: Pt[] = []
  const lowIdx = low.flatMap((v, j) => (v ? [j] : []))
  if (lowIdx.length) {
    const j0 = lowIdx[0],
      j1 = lowIdx[lowIdx.length - 1] + 1
    for (let j = j0; j <= j1; j++) innerPts.push([px(j), yAt(innerLevel + (j % 2 ? 0.0 : 0.1), j)])
    for (let j = j1; j >= j0; j--) innerPts.push([px(j), yAt(0, j)])
    out.push(occlude(innerPts), stroke('hair', innerPts.slice(0, j1 - j0 + 1)))
    out.push(...toneFill(innerPts, 'T4', { gap: 2.4 }))
  }

  // Wall silhouette bay by bay.
  const top: Pt[] = []
  for (let j = 0; j < bays; j++) {
    top.push([px(j), yAt(profile[j], j)], [px(j + 1), yAt(profile[j], j + 1)])
  }
  const bottom: Pt[] = []
  for (let j = bays; j >= 0; j--) bottom.push([px(j), yAt(0, j)])
  out.push(...body([...top, ...bottom], 'line'))

  // Storey courses and openings.
  for (const s of [1, 2, 3]) {
    let run: Pt[] = []
    const flush = () => {
      if (run.length > 1) out.push(stroke(s === 3 ? 'bold' : 'line', run))
      run = []
    }
    for (let j = 0; j < bays; j++) {
      if (profile[j] >= s) {
        if (!run.length) run.push([px(j), yAt(s, j)])
        run.push([px(j + 1), yAt(s, j + 1)])
      } else flush()
    }
    flush()
  }
  for (let j = 0; j < bays; j++) {
    const jm = j + 0.5
    const xm = (px(j) + px(j + 1)) / 2
    const bayW = px(j + 1) - px(j)
    for (let t = 0; t < 3; t++) {
      if (profile[j] < t + 1) continue
      const hb = yAt(t + 0.16, jm)
      const ht = yAt(t + 0.86, jm)
      const aw = Math.max(1.6, bayW * open)
      out.push(...arcade(xm, hb, ht, aw, 0.4))
    }
    if (profile[j] >= 4 && j % 2 === 0) {
      const wy = yAt(3.5, jm)
      const ww = Math.min(3, bayW * 0.34)
      out.push(fill(rectPts(xm - ww / 2, wy - 1.6, ww, 3.2)))
    }
  }
  // Pilasters: a full-height rib on every `ribs`-th pier, so the wall breaks into separate cells.
  const ribs = Math.max(0, Math.round(num(p, 'ribs', 3)))
  for (let j = ribs; ribs > 0 && j < bays; j += ribs) {
    const s = Math.min(profile[j - 1], profile[j])
    if (s > 0)
      out.push(
        stroke('line', [
          [px(j), yAt(0, j)],
          [px(j), yAt(s, j)],
        ]),
      )
  }
  // Heavy cornice over the full attic.
  let run: Pt[] = []
  const flushTop = () => {
    if (run.length > 1) out.push(stroke('bold', run))
    run = []
  }
  for (let j = 0; j < bays; j++) {
    if (profile[j] >= 4) {
      if (!run.length) run.push([px(j), yAt(4, j)])
      run.push([px(j + 1), yAt(4, j + 1)])
    } else flushTop()
  }
  flushTop()
  return out
}
