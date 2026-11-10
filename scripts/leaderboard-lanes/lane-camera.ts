// The ground lanes' kit camera, derived from LaneScene's own projection so wheel contacts, the road's skew and the
// scale stay the lane's. The car, the locomotive, the yacht and the balloon all build with it.
import { LaneScene, W } from '../../apps/next/src/client/leaderboard/lanes/draw/lane-scene'
import { drawing, type Draw } from './airliner/draw'
import type { Kit } from './airliner/kit'
import type { Camera, Pt, V3 } from './airliner/surface'

/** Draws at 4× for precision and places back at 1×, levelling the road's slope. `k` is LaneScene's scale at 1×. */
export function laneCamera(kit: Kit, k: number): { cam: Camera; draw: Draw; place: (p: Pt) => Pt } {
  const zoom = 4
  const scene = new LaneScene(k * zoom)
  const px = scene.project(W([1, 0, 0])),
    py = scene.project(W([0, 1, 0])),
    pz = scene.project(W([0, 0, 1]))
  const P = {
    ...kit.P,
    azimuth: (Math.atan2(px[0], -py[0]) * 180) / Math.PI,
    elevation: (Math.atan2(Math.hypot(px[1], py[1]), -pz[1]) * 180) / Math.PI,
    scale: Math.hypot(px[0], py[0]) / Math.sqrt(1.6),
  }
  const cam: Camera = {
    ...kit.cam,
    project: (p: V3) => kit.k.iso(p, P) as Pt,
    V: kit.G.viewOf(P),
    L: kit.G.lightOf(P),
  }
  const slope = scene.slope()
  const place = ([x, y]: Pt): Pt => [x / zoom, (y - slope * x) / zoom]
  return { cam, draw: drawing(cam, { G: kit.G, P }), place }
}
