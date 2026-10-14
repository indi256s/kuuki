// Foreground dunes: wavy crest lines across the window; below every crest the lee faces (where the
// crest descends) take wedges of horizontal hair hatching, the sunlit faces stay bare. The first
// crest erases the ground hatching below it, so the dunes read as the near sand.
import { type Pt, type SvgNode, occlude, stroke } from '../grid'
import { type KitModule, num, nums } from './util'

/**
 * `crests` lists y fractions of the box for each crest, back to front. Crests swell by `amp` with a
 * wavelength of `wave` units; each lee wedge is up to `lee` units deep (a list gives one depth per
 * crest) and the hatching rows are `gap` apart.
 */
export const dunes: KitModule = ([x, y, w, h], p) => {
  const crests = nums(p, 'crests', [0.84, 0.92])
  const amp = num(p, 'amp', 4)
  const wave = num(p, 'wave', 70)
  const gap = num(p, 'gap', 2)
  const lees = nums(p, 'lee', [8, 14])
  const bottom = y + h
  const out: SvgNode[] = []
  crests.forEach((cf, k) => {
    const base = y + h * cf
    const phase = k * 2.1 + 0.6
    const f = (Math.PI * 2) / (wave * (1 - k * 0.12))
    const crestAt = (px: number) =>
      base + amp * Math.sin(px * f + phase) + amp * 0.35 * Math.sin(px * f * 2.3 + phase * 1.7)
    const crest: Pt[] = []
    for (let px = x; px <= x + w + 2; px += 2) crest.push([px, crestAt(px)])
    if (k === 0) out.push(occlude([...crest, [x + w + 2, bottom], [x, bottom]]))
    const lee = lees[Math.min(k, lees.length - 1)]
    // The last crest with `band` is a full-width dark band down to the box bottom.
    const band = p.band === true && k === crests.length - 1
    const depthAt = (px: number) => {
      if (band) return bottom - crestAt(px)
      const slope = crestAt(px + 1) - crestAt(px - 1)
      return lee * Math.min(1, Math.max(0, slope * 0.55))
    }
    for (
      let d = 1.4;
      d < (band ? bottom - base + amp : lee);
      d += band ? num(p, 'bandGap', 2.2) : gap
    ) {
      let start: number | null = null
      for (let px = x; px <= x + w + 1; px += 1) {
        const on = depthAt(px) > d && px <= x + w
        if (on && start === null) start = px
        if (!on && start !== null) {
          if (px - start > 3) {
            out.push({
              ...stroke('hair', [
                [start, crestAt(start) + d],
                [px, crestAt(px) + d],
              ]),
              bg: true,
            })
          }
          start = null
        }
      }
    }
    out.push(stroke(k === 0 ? 'hair' : 'line', crest))
  })
  return out
}
