// Cable-car line: two pylons, a drooping cable and a small gondola. The box spans pylon to pylon;
// the left pylon foot is at the bottom-left, the right pylon foot at the bottom-right (heights vary
// by `left` and `right`, fractions of the box height).
import { type Pt, type SvgNode, fill, hline, quad, rectPts, stroke, vline } from '../grid'
import { type KitModule, num } from './util'

export const cableCar: KitModule = ([x, y, w, h], p) => {
  const base = y + h
  const lh = h * num(p, 'left', 0.5)
  const rh = h * num(p, 'right', 1)
  const lx = x + 1
  const rx = x + w - 1
  const out: SvgNode[] = []
  const a: Pt = [lx, base - lh]
  const b: Pt = [rx, base - rh]
  const stub = num(p, 'stub', h)
  out.push(
    vline('line', lx, base - lh, Math.min(base, base - lh + stub)),
    vline('line', rx, base - rh, Math.min(base, base - rh + stub)),
  )
  out.push(hline('hair', lx - 2, lx + 2, base - lh), hline('hair', rx - 2, rx + 2, base - rh))
  const sag = num(p, 'sag', 2.5)
  const cable = quad(a, [(a[0] + b[0]) / 2, Math.max(a[1], b[1]) + sag], b, 18)
  out.push(stroke('hair', cable))
  // Gondola hung from the cable at `at` along its length.
  const at = Math.round(num(p, 'at', 0.45) * 18)
  const [gx, gy] = cable[at]
  out.push(vline('hair', gx, gy, gy + 3.2))
  out.push(fill(rectPts(gx - 3.4, gy + 3.2, 6.8, 4.4)))
  return out
}
