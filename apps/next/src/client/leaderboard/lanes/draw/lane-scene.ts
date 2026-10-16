// The lane camera: the app's iso Scene (the ladder figures' kernel, tones and line weights) seen from lower down and
// turned so a vehicle's length runs level along its lane. Build-time only: scripts/leaderboard-lanes/scene-art.ts draws
// every vehicle through it and writes the static symbols the lanes load.
//
// Vehicles are modelled in metres in a local frame: +x runs to the nose (screen right), +y is the near flank (towards
// the viewer), z is up from the ground. `W` turns local into the Scene's world, PHI off the beam so the nose turns a
// little towards the viewer, as the Aircraft types ladder does. The Scene's iso view looks down at 35°; LaneScene
// squashes depth at projection time (the geometry, its normals and its shading stay true 3D) to look down at EL, which
// keeps a wing's near tip from hanging far below the lane. Last, a shear that keeps verticals vertical levels the
// local x axis, so the ground line under a vehicle is the lane's level road.

import { Scene, type P3, type Pt } from '../../../overview/iso/scene'
import { D2R } from '../../../profile/ladders/figures/parts'

/** Camera turn off the beam, towards the nose. */
export const PHI = 28 * D2R
/** Effective elevation: the Scene's iso looks down at atan(1/√2) ≈ 35.3°. */
export const EL = 30 * D2R

const CP = Math.cos(PHI),
  SP = Math.sin(PHI)
const ISO_EL = Math.atan(Math.SQRT1_2)
/** Depth (horizontal, towards the viewer) and height scales that turn the iso view into a view from EL. */
const DEPTH = Math.sin(EL) / Math.sin(ISO_EL)
const RISE = Math.cos(EL) / Math.cos(ISO_EL)

/** Local (metres; +x nose, +y near flank, +z up) to the Scene's world. Linear, so it also turns directions. */
export const W = ([x, y, z]: P3): P3 => [CP * x + SP * y, CP * y - SP * x, z]

const squash = (x: number, y: number, z: number): P3 => {
  const d = ((x + y) / 2) * (DEPTH - 1)
  return [x + d, y + d, z * RISE]
}

export class LaneScene extends Scene {
  P(x: number, y: number, z: number): Pt {
    const [a, b, c] = squash(x, y, z)
    return super.P(a, b, c)
  }
  project(p: P3): Pt {
    return super.project(squash(p[0], p[1], p[2]))
  }
  /** Screen slope of the local x axis, for the levelling shear (y' = y − slope·x). */
  slope(): number {
    const [x0, y0] = this.project(W([0, 0, 0]))
    const [x1, y1] = this.project(W([1, 0, 0]))
    return (y1 - y0) / (x1 - x0)
  }
}
