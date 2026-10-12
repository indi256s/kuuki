// Small solids the hero figures share: round parts on each axis, rotated slabs, contact shadows and rounded outlines on a plane.
import { hull, roundRect, type P3, type Paint, type Scene } from './scene'

export const X: P3 = [1, 0, 0],
  Y: P3 = [0, 1, 0],
  NZ: P3 = [0, 0, -1]

/** Elliptical contact shadow on the floor. */
export function shadowDisc(s: Scene, cx: number, cy: number, rx: number, ry = rx) {
  const pts: P3[] = []
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * 2 * Math.PI
    pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a), 0])
  }
  s.poly(pts, 'shadow', 'none')
}

/** Rectangular contact shadow on the floor, `grow` past the footprint on every side. */
export function shadowRect(s: Scene, x: number, y: number, w: number, d: number, grow = 4) {
  s.poly(
    [
      [x - grow, y - grow, 0],
      [x + w + grow, y - grow, 0],
      [x + w + grow, y + d + grow, 0],
      [x - grow, y + d + grow, 0],
    ],
    'shadow',
    'none',
  )
}

type Round = { face?: Paint; body?: Paint; stroke?: Paint }

/** Upright cylinder (axis z); returns its top rim. */
export function cylZ(
  s: Scene,
  cx: number,
  cy: number,
  z: number,
  r: number,
  h: number,
  f: { top?: Paint; body?: Paint; stroke?: Paint } = {},
  n = 28,
) {
  const top = s.circle([cx, cy, z + h], X, Y, 0, 0, r, n),
    bottom = s.circle([cx, cy, z], X, Y, 0, 0, r, n)
  const outline = hull([...s.pp(top), ...s.pp(bottom)])
  s.poly2(outline, f.body ?? 'front', 'none')
  s.poly2(outline, 'none', f.stroke ?? 'line')
  s.poly(top, f.top ?? 'top', f.stroke ?? 'line')
  return top
}

/** Cylinder along y whose near disc faces +y (the viewer's left); returns that disc. */
export function cylY(
  s: Scene,
  cx: number,
  y: number,
  cz: number,
  r: number,
  d: number,
  f: Round = {},
  n = 28,
) {
  const near = s.circle([cx, y + d, cz], X, NZ, 0, 0, r, n),
    far = s.circle([cx, y, cz], X, NZ, 0, 0, r, n)
  const outline = hull([...s.pp(near), ...s.pp(far)])
  s.poly2(outline, f.body ?? 'side', 'none')
  s.poly2(outline, 'none', f.stroke ?? 'line')
  s.poly(near, f.face ?? 'front', f.stroke ?? 'line')
  return near
}

/** Cylinder along x whose near disc faces +x (the viewer's right); returns that disc. */
export function cylX(
  s: Scene,
  x: number,
  cy: number,
  cz: number,
  r: number,
  w: number,
  f: Round = {},
  n = 28,
) {
  const near = s.circle([x + w, cy, cz], Y, NZ, 0, 0, r, n),
    far = s.circle([x, cy, cz], Y, NZ, 0, 0, r, n)
  const outline = hull([...s.pp(near), ...s.pp(far)])
  s.poly2(outline, f.body ?? 'front', 'none')
  s.poly2(outline, 'none', f.stroke ?? 'line')
  s.poly(near, f.face ?? 'side', f.stroke ?? 'line')
  return near
}

/** A thin slab turned `a` radians in plan round its centre: the visible edges, then the top. Returns a mapper from slab-local (u, v, z) to world points. */
export function slabRot(
  s: Scene,
  cx: number,
  cy: number,
  z: number,
  w: number,
  d: number,
  h: number,
  a: number,
  f: { top?: Paint; edge?: Paint; stroke?: Paint } = {},
) {
  const c = Math.cos(a),
    sn = Math.sin(a)
  const at = (u: number, v: number, zz = z + h): P3 => [
    cx + u * c - v * sn,
    cy + u * sn + v * c,
    zz,
  ]
  const corners: [number, number][] = [
    [w / 2, -d / 2],
    [w / 2, d / 2],
    [-w / 2, d / 2],
    [-w / 2, -d / 2],
  ]
  for (let i = 0; i < 4; i++) {
    const [u0, v0] = corners[i],
      [u1, v1] = corners[(i + 1) % 4]
    const p0 = at(u0, v0, z),
      p1 = at(u1, v1, z)
    // An edge faces the viewer when its outward normal points along +x +y.
    if (p1[1] - p0[1] + (p0[0] - p1[0]) > 0)
      s.poly(
        [at(u0, v0, z), at(u1, v1, z), at(u1, v1, z + h), at(u0, v0, z + h)],
        f.edge ?? 'front',
        f.stroke ?? 'line',
      )
  }
  s.poly(
    corners.map(([u, v]) => at(u, v)),
    f.top ?? 'top',
    f.stroke ?? 'line',
  )
  return at
}

/** A rounded rectangle on the plane O + u·U + v·V, as 3D points. */
export function rrOn(
  s: Scene,
  O: P3,
  U: P3,
  V: P3,
  u: number,
  v: number,
  w: number,
  h: number,
  r: number,
): P3[] {
  const at = s.on(O, U, V)
  return roundRect(u, v, w, h, r).map(([a, b]) => at(a, b))
}
